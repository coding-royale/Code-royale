"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, UserPlus } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { supabase } from "../../lib/supabase-browser";
import { fetchAvatarMap, getAvatarUrl } from "@/lib/avatars";
import {
  computeRelationship,
  partitionConnections,
  type ConnectionRow,
  type Relationship,
} from "@/lib/friends";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  username: string | null;
  rating?: number | null;
};

type ActiveTab = "search" | "friends" | "pending";

type FriendListItem = {
  id: string;
  username: string;
  rating: number;
  friendCount: number;
};

function FriendsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const paramTab = searchParams.get("tab");
  const urlTab =
    paramTab === "friends" || paramTab === "pending" || paramTab === "search"
      ? paramTab
      : null;
  const [tabState, setTabState] = useState<ActiveTab>("friends");
  // URL wins when ?tab= is present (e.g. deep links from the app shell);
  // otherwise user clicks drive the state.
  const activeTab = urlTab ?? tabState;

  const changeTab = (tab: ActiveTab) => {
    setTabState(tab);
    if (urlTab) router.replace(pathname);
  };
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UserRow[]>([]);
  const [connectionRows, setConnectionRows] = useState<ConnectionRow[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendListItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendListItem[]>([]);
  const [relationshipByUserId, setRelationshipByUserId] = useState<Record<string, Relationship>>({});
  const [friendCountByUserId, setFriendCountByUserId] = useState<Record<string, number>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  // Aggressive cache: keep friends payload for 5m in memory + sessionStorage (stale-while-revalidate)
  const FRIENDS_TTL_MS = 5 * 60 * 1000;
  const friendsCacheRef = useRef<Map<string, { payload: { friends: FriendListItem[]; incoming: FriendListItem[]; outgoing: FriendListItem[]; rows: ConnectionRow[]; counts: Record<string, number>; avatars: Record<string, string | null> }; expiresAt: number }>>(new Map());
  const SEARCH_TTL_MS = 30_000;
  const searchCacheRef = useRef<Map<string, { users: UserRow[]; counts: Record<string, number>; avatars: Record<string, string | null>; expiresAt: number }>>(new Map());

  const getDisplayName = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Unknown";
  };

  const loadFriendCounts = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) {
      return {} as Record<string, number>;
    }

    const response = await fetch(`/api/friends/meta?userIds=${encodeURIComponent(userIds.join(","))}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {} as Record<string, number>;
    }

    const payload = (await response.json()) as { counts?: Record<string, number> };
    return payload.counts ?? {};
  }, []);

  const buildRelationshipMap = (users: UserRow[], rows: ConnectionRow[], currentViewerId: string) => {
    const relMap: Record<string, Relationship> = {};
    for (const user of users) {
      if (user.id === currentViewerId) {
        relMap[user.id] = "none";
      } else {
        relMap[user.id] = computeRelationship(currentViewerId, user.id, rows);
      }
    }
    return relMap;
  };

  const loadConnections = useCallback(async (currentViewerId: string, opts?: { useCache?: boolean }) => {
    const useCache = opts?.useCache ?? true;
    const cacheKey = `friends:${currentViewerId}`;
    const now = Date.now();

    // Check memory cache first (instant)
    if (useCache) {
      const hit = friendsCacheRef.current.get(cacheKey);
      if (hit && hit.expiresAt > now) {
        setConnectionRows(hit.payload.rows);
        setFriends(hit.payload.friends);
        setIncomingRequests(hit.payload.incoming);
        setOutgoingRequests(hit.payload.outgoing);
        setFriendCountByUserId((prev) => ({ ...prev, ...hit.payload.counts }));
        setAvatarMap((prev) => ({ ...prev, ...hit.payload.avatars }));
        setLoadingConnections(false);
        // Revalidate in background after 2s stale-while-revalidate
        setTimeout(() => void loadConnections(currentViewerId, { useCache: false }), 2000);
        return;
      }
      // Try sessionStorage for cross-reload instant
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { payload: { friends: FriendListItem[]; incoming: FriendListItem[]; outgoing: FriendListItem[]; rows: ConnectionRow[]; counts: Record<string, number>; avatars: Record<string, string | null> }; expiresAt: number };
          if (parsed.expiresAt > now) {
            friendsCacheRef.current.set(cacheKey, parsed);
            setConnectionRows(parsed.payload.rows);
            setFriends(parsed.payload.friends);
            setIncomingRequests(parsed.payload.incoming);
            setOutgoingRequests(parsed.payload.outgoing);
            setFriendCountByUserId((prev) => ({ ...prev, ...parsed.payload.counts }));
            setAvatarMap((prev) => ({ ...prev, ...parsed.payload.avatars }));
            setLoadingConnections(false);
            setTimeout(() => void loadConnections(currentViewerId, { useCache: false }), 2000);
            return;
          }
        }
      } catch {}
    }

    setLoadingConnections(true);

    const { data: rowsData, error: rowsError } = await supabase
      .from("connections")
      .select("user_id,connection_id,status")
      .or(`user_id.eq.${currentViewerId},connection_id.eq.${currentViewerId}`);

    if (rowsError) {
      setError(rowsError.message);
      setConnectionRows([]);
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoadingConnections(false);
      return;
    }

    const rows = (rowsData ?? []) as ConnectionRow[];
    setConnectionRows(rows);

    const { incomingIds, outgoingIds, friendIds } = partitionConnections(rows, currentViewerId);
    const uniqueIds = Array.from(new Set([...incomingIds, ...outgoingIds, ...friendIds]));

    if (uniqueIds.length === 0) {
      const emptyPayload = { friends: [], incoming: [], outgoing: [], rows, counts: {}, avatars: {} };
      friendsCacheRef.current.set(cacheKey, { payload: emptyPayload, expiresAt: now + FRIENDS_TTL_MS });
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ payload: emptyPayload, expiresAt: now + FRIENDS_TTL_MS })); } catch {}
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoadingConnections(false);
      return;
    }

    const [{ data: usersData, error: usersError }, avatars, counts] = await Promise.all([
      supabase.from("users").select("id,username,rating").in("id", uniqueIds),
      fetchAvatarMap(uniqueIds),
      loadFriendCounts(uniqueIds),
    ]);

    if (usersError) {
      setError(usersError.message);
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoadingConnections(false);
      return;
    }

    const users = (usersData ?? []) as UserRow[];
    const userMap = new Map(users.map((user) => [user.id, user]));
    setFriendCountByUserId((prev) => ({ ...prev, ...counts }));
    setAvatarMap((prev) => ({ ...prev, ...avatars }));

    const toListItem = (userId: string): FriendListItem => {
      const user = userMap.get(userId);
      return {
        id: userId,
        username: getDisplayName(user?.username),
        rating: typeof user?.rating === "number" ? user.rating : 0,
        friendCount: counts[userId] ?? 0,
      };
    };

    const sortByName = (a: FriendListItem, b: FriendListItem) => a.username.localeCompare(b.username);

    const incoming = incomingIds.map(toListItem).sort(sortByName);
    const outgoing = outgoingIds.map(toListItem).sort(sortByName);
    const fr = friendIds.map(toListItem).sort(sortByName);

    setIncomingRequests(incoming);
    setOutgoingRequests(outgoing);
    setFriends(fr);

    const payload = { friends: fr, incoming, outgoing, rows, counts, avatars };
    friendsCacheRef.current.set(cacheKey, { payload, expiresAt: now + FRIENDS_TTL_MS });
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ payload, expiresAt: now + FRIENDS_TTL_MS })); } catch {}
    setLoadingConnections(false);
  }, [loadFriendCounts]);

  useEffect(() => {
    let mounted = true;
    const loadViewer = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (authError) {
        setViewerId(null);
        setLoadingConnections(false);
        return;
      }

      const currentViewerId = data.user?.id ?? null;
      setViewerId(currentViewerId);

      if (currentViewerId) {
        await loadConnections(currentViewerId);
      } else {
        setLoadingConnections(false);
      }
    };
    void loadViewer();
    return () => { mounted = false; };
  }, [loadConnections]);

  const handleSearch = async () => {
    if (!canSearch) {
      setError("Type at least 2 characters to search.");
      return;
    }

    const cacheKey = trimmedQuery.toLowerCase();
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setResults(cached.users);
      setFriendCountByUserId((prev) => ({ ...prev, ...cached.counts }));
      setAvatarMap((prev) => ({ ...prev, ...cached.avatars }));
      if (viewerId && cached.users.length > 0) {
        setRelationshipByUserId(buildRelationshipMap(cached.users, connectionRows, viewerId));
      }
      return;
    }

    setSearching(true);
    setError(null);
    setResults([]);
    setRelationshipByUserId({});

    const { data: userRows, error: usersError } = await supabase
      .from("users")
      .select("id,username,rating")
      .ilike("username", `%${trimmedQuery}%`)
      .order("username", { ascending: true })
      .limit(20);

    if (usersError) {
      setSearching(false);
      setError(usersError.message);
      return;
    }

    const users = (userRows ?? []) as UserRow[];
    setResults(users);

    const [counts, avatars] = await Promise.all([
      loadFriendCounts(users.map((user) => user.id)),
      fetchAvatarMap(users.map((u) => u.id)),
    ]);
    setFriendCountByUserId((prev) => ({ ...prev, ...counts }));
    setAvatarMap((prev) => ({ ...prev, ...avatars }));
    searchCacheRef.current.set(cacheKey, { users, counts, avatars, expiresAt: Date.now() + SEARCH_TTL_MS });

    if (!viewerId || users.length === 0) {
      setSearching(false);
      return;
    }

    setRelationshipByUserId(buildRelationshipMap(users, connectionRows, viewerId));
    setSearching(false);
  };

  const handleAddFriend = async (userId: string) => {
    if (!viewerId) return;
    const { error: requestError } = await supabase
      .from("connections")
      .insert({ user_id: viewerId, connection_id: userId, status: "pending" });

    if (requestError) {
      setError(requestError.message);
      return;
    }

    await loadConnections(viewerId, { useCache: false });
    setRelationshipByUserId((prev) => ({ ...prev, [userId]: "outgoing_pending" }));
  };

  const handleAccept = async (userId: string) => {
    if (!viewerId) return;
    const { error: acceptError } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .match({ user_id: userId, connection_id: viewerId });

    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    await loadConnections(viewerId, { useCache: false });
    setRelationshipByUserId((prev) => ({ ...prev, [userId]: "friends" }));
  };

  const handleDecline = async (userId: string) => {
    if (!viewerId) return;

    const { error: declineError } = await supabase
      .from("connections")
      .delete()
      .match({ user_id: userId, connection_id: viewerId, status: "pending" });

    if (declineError) {
      setError(declineError.message);
      return;
    }

    await loadConnections(viewerId, { useCache: false });
    setRelationshipByUserId((prev) => ({ ...prev, [userId]: "none" }));
  };

  const handleCancelOutgoing = async (userId: string) => {
    if (!viewerId) return;

    const { error: cancelError } = await supabase
      .from("connections")
      .delete()
      .match({ user_id: viewerId, connection_id: userId, status: "pending" });

    if (cancelError) {
      setError(cancelError.message);
      return;
    }

    await loadConnections(viewerId, { useCache: false });
    setRelationshipByUserId((prev) => ({ ...prev, [userId]: "none" }));
  };

  const incomingCount = incomingRequests.length;

  const renderUserLine = (user: FriendListItem, kind: "incoming" | "outgoing" | "friend") => {
    const isSelf = user.id === viewerId;
    const profileHref = isSelf ? "/profile" : `/profile?userId=${user.id}`;
    const avatarUrl = getAvatarUrl(user.id, user.username, avatarMap);

    return (
      <Card key={`${kind}-${user.id}`}>
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={avatarUrl ?? undefined} alt={user.username} />
              <AvatarFallback className="text-sm font-medium">
                {user.username[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <Link
                href={profileHref}
                className="block truncate text-sm font-medium hover:underline"
              >
                {user.username}
              </Link>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>Rating: {user.rating}</span>
                <span>Friends: {user.friendCount}</span>
              </div>
            </div>
          </div>

          {kind === "incoming" && (
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={() => handleAccept(user.id)} size="sm">
                Accept
              </Button>
              <Button onClick={() => handleDecline(user.id)} variant="outline" size="sm">
                Decline
              </Button>
            </div>
          )}
          {kind === "outgoing" && (
            <Button
              onClick={() => handleCancelOutgoing(user.id)}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              Cancel Request
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-6">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Friends</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search for players and manage your connections.
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={(value) => changeTab(value as ActiveTab)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start gap-4">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="pending">
              Pending{incomingCount > 0 ? ` (${incomingCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex flex-col gap-4">
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Search by username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={!canSearch || searching}>
                {searching ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Search data-icon="inline-start" />
                )}
                Search
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {results.length > 0 && (
              <Card>
                {results.map((user, i) => {
                  const relationship = relationshipByUserId[user.id] ?? "none";
                  const isSelf = user.id === viewerId;

                  return (
                    <CardContent
                      key={user.id}
                      className={`flex items-center justify-between gap-3 p-4 ${
                        i !== results.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarImage src={getAvatarUrl(user.id, user.username ?? "Unknown", avatarMap) ?? undefined} alt={user.username ?? "Unknown"} />
                          <AvatarFallback className="text-sm font-medium">
                            {(user.username ?? "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={isSelf ? "/profile" : `/profile?userId=${user.id}`}
                              className="truncate text-sm font-medium hover:underline"
                            >
                              {user.username ?? "Unknown"}
                            </Link>
                            {relationship === "friends" && (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                              >
                                Friends
                              </Badge>
                            )}
                          </div>
                          {user.rating !== undefined && (
                            <p className="text-xs text-muted-foreground">Rating: {user.rating ?? 0}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Friends: {friendCountByUserId[user.id] ?? 0}
                          </p>
                        </div>
                      </div>
                      {!isSelf && (
                        <div className="shrink-0">
                          {relationship === "none" && (
                            <Button onClick={() => handleAddFriend(user.id)} variant="outline" size="sm">
                              <UserPlus data-icon="inline-start" />
                              Add Friend
                            </Button>
                          )}
                          {relationship === "outgoing_pending" && (
                            <span className="text-xs text-muted-foreground">Request Sent</span>
                          )}
                          {relationship === "incoming_pending" && (
                            <Button onClick={() => handleAccept(user.id)} size="sm">
                              Accept
                            </Button>
                          )}
                          {relationship === "friends" && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            >
                              Friends
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  );
                })}
              </Card>
            )}

            {results.length === 0 && !searching && trimmedQuery.length >= 2 && (
              <Card className="p-8 text-center">
                <CardContent className="p-0">
                  <p className="text-sm text-muted-foreground">
                    No users found matching &quot;{trimmedQuery}&quot;
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="friends" className="flex flex-col gap-3">
            {loadingConnections && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}
            {!loadingConnections && friends.length === 0 && (
              <Card className="p-8 text-center">
                <CardContent className="flex flex-col items-center gap-3 p-0">
                  <p className="text-sm text-muted-foreground">No friends yet</p>
                  <Button variant="link" onClick={() => changeTab("search")}>
                    Search for players →
                  </Button>
                </CardContent>
              </Card>
            )}
            {!loadingConnections && friends.length > 0 && friends.map((user) => renderUserLine(user, "friend"))}
          </TabsContent>

          <TabsContent value="pending" className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Incoming Requests
              </h2>
              {incomingRequests.length === 0 ? (
                <Card className="p-5">
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    No incoming requests.
                  </CardContent>
                </Card>
              ) : (
                incomingRequests.map((user) => renderUserLine(user, "incoming"))
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Sent By You</h2>
              {outgoingRequests.length === 0 ? (
                <Card className="p-5">
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    No outgoing requests.
                  </CardContent>
                </Card>
              ) : (
                outgoingRequests.map((user) => renderUserLine(user, "outgoing"))
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export default function FriendsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="mx-auto w-full max-w-3xl p-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-4 h-16 w-full" />
            <Skeleton className="mt-3 h-16 w-full" />
          </div>
        </AppShell>
      }
    >
      <FriendsContent />
    </Suspense>
  );
}
