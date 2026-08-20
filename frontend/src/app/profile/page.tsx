"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Clock, Flag, Loader2, MoreVertical, Settings, Shield, Trophy, UserPlus } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { LinkButton } from "../../components/ui/link-button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { supabase } from "../../lib/supabase-browser";
import { computeRelationship, type ConnectionRow } from "@/lib/friends";

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  awarded_at: string;
};

type UserRow = {
  id: string;
  username: string | null;
  avatarUrl?: string | null;
  rating: number | null;
  wins: number | null;
  losses: number | null;
  team_name?: string | null;
  club_id?: string | null;
  club_name?: string | null;
  club_logo?: string | null;
  club_trophies?: number | null;
  badges?: Badge[];
};

type RelationshipStatus =
  | "none"
  | "incoming_pending"
  | "outgoing_pending"
  | "friends"
  | "blocked"
  | "blocked_by_other";

function getRankFromRating(rating: number) {
  if (rating >= 600) return { name: "Gold", color: "text-amber-500" };
  if (rating >= 400) return { name: "Silver", color: "text-slate-400" };
  if (rating >= 200) return { name: "Bronze", color: "text-orange-500" };
  return { name: "Unranked", color: "text-muted-foreground" };
}

function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "CR";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "C";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? "R"}`.toUpperCase();
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const targetUserIdParam = searchParams.get("userId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [isFriendWithViewer, setIsFriendWithViewer] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>("none");
  const [actionBusy, setActionBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Harassment");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const resolvedUserId = targetUserIdParam ?? viewerUserId;
  const isSelf = Boolean(resolvedUserId && viewerUserId && resolvedUserId === viewerUserId);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError) {
        setError(authError.message);
        setViewerUserId(null);
      } else {
        setViewerUserId(authData.user?.id ?? null);
      }

      const idToLoad = targetUserIdParam ?? authData.user?.id;
      if (!idToLoad) {
        setError("You must be signed in to view profiles.");
        setLoading(false);
        return;
      }

      const [friendCountResponse, relationshipResult] = await Promise.all([
        fetch(`/api/friends/meta?userIds=${encodeURIComponent(idToLoad)}`, { cache: "no-store" }),
        authData.user?.id && authData.user.id !== idToLoad
          ? supabase
              .from("connections")
            .select("user_id,connection_id,status")
              .or(`and(user_id.eq.${authData.user.id},connection_id.eq.${idToLoad}),and(user_id.eq.${idToLoad},connection_id.eq.${authData.user.id})`)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mounted) return;

      if (friendCountResponse.ok) {
        const payload = (await friendCountResponse.json()) as { counts?: Record<string, number> };
        setFriendCount(payload.counts?.[idToLoad] ?? 0);
      } else {
        setFriendCount(0);
      }

      const connectionRows = (relationshipResult.data ?? []) as ConnectionRow[];

      // When the viewer is unauthenticated the relationship query resolves to
      // empty rows, so passing a placeholder viewer id is behavior-identical.
      const resolvedRelationship = computeRelationship(
        authData.user?.id ?? "",
        idToLoad,
        connectionRows,
      );

      setRelationshipStatus(resolvedRelationship);

      const hasFriendConnection = resolvedRelationship === "friends";
      setIsFriendWithViewer(hasFriendConnection);

      const [
        { data: userRow, error: profileError },
        { data: badgesData },
        clubMembership,
        { data: statsRow },
      ] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, rating, wins, losses, team_name")
          .eq("id", idToLoad)
          .maybeSingle(),
        supabase
          .from("user_badges")
          .select(`
            awarded_at,
            badge:badges (
              id,
              name,
              description,
              icon
            )
          `)
          .eq("user_id", idToLoad),
        supabase
          .from("club_members")
          .select("club_id")
          .eq("user_id", idToLoad)
          .maybeSingle(),
        supabase
          .from("player_stats")
          .select("avatar_url")
          .eq("user_id", idToLoad)
          .maybeSingle(),
      ]);

      let clubInfo:
        | { id: string; name: string; logo: string; trophies: number }
        | null = null;

      const membershipRow = clubMembership?.data as { club_id?: string } | null;
      if (membershipRow?.club_id) {
        const { data: clubRow } = await supabase
          .from("clubs")
          .select("id, name, logo, trophies")
          .eq("id", membershipRow.club_id)
          .maybeSingle();
        if (clubRow) {
          clubInfo = clubRow as { id: string; name: string; logo: string; trophies: number };
        }
      }

      if (!mounted) return;

      if (profileError) {
        setError(profileError.message);
      } else if (!userRow) {
        setError("User not found.");
      } else {
        const parsedBadges = ((badgesData ?? []) as unknown as Array<{
          awarded_at: string;
          badge: { id: string; name: string; description: string; icon: string } | null;
        }>)
          .flatMap((b) => {
            if (!b.badge) return [];
            return [{
              id: b.badge.id,
              name: b.badge.name,
              description: b.badge.description,
              icon: b.badge.icon,
              awarded_at: b.awarded_at,
            }];
          });
        
        setProfile({
          ...userRow as UserRow,
          avatarUrl:
            (typeof statsRow?.avatar_url === "string" && statsRow.avatar_url) || null,
          badges: parsedBadges,
          club_id: clubInfo?.id ?? null,
          club_name: clubInfo?.name ?? null,
          club_logo: clubInfo?.logo ?? null,
          club_trophies: clubInfo?.trophies ?? null
        });
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [targetUserIdParam]);

  const displayName = profile?.username || "Anonymous";
  const initials = initialsFromName(displayName);
  const rating = profile?.rating ?? 0;
  const rank = getRankFromRating(rating);
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const sendFriendRequest = async () => {
    if (!viewerUserId || !resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const { error: requestError } = await supabase
      .from("connections")
      .insert({ user_id: viewerUserId, connection_id: resolvedUserId, status: "pending" });

    if (requestError) {
      setError(requestError.message);
      setActionBusy(false);
      return;
    }

    setRelationshipStatus("outgoing_pending");
    setActionBusy(false);
  };

  const acceptFriendRequest = async () => {
    if (!viewerUserId || !resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const { error: acceptError } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .match({ user_id: resolvedUserId, connection_id: viewerUserId });

    if (acceptError) {
      setError(acceptError.message);
      setActionBusy(false);
      return;
    }

    setRelationshipStatus("friends");
    setIsFriendWithViewer(true);
    setFriendCount((prev) => prev + 1);
    setActionBusy(false);
  };

  const declineFriendRequest = async () => {
    if (!viewerUserId || !resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const { error: declineError } = await supabase
      .from("connections")
      .delete()
      .match({ user_id: resolvedUserId, connection_id: viewerUserId, status: "pending" });

    if (declineError) {
      setError(declineError.message);
      setActionBusy(false);
      return;
    }

    setRelationshipStatus("none");
    setActionBusy(false);
  };

  const updateBlockStatus = async (action: "block" | "unblock") => {
    if (!resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const response = await fetch("/api/friends/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        targetUserId: resolvedUserId,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to update block status right now.");
      setActionBusy(false);
      return;
    }

    if (action === "block") {
      setRelationshipStatus("blocked");
      setIsFriendWithViewer(false);
    } else {
      setRelationshipStatus("none");
    }

    setActionBusy(false);
    setMenuOpen(false);
  };

  const submitReport = () => {
    setReportSubmitted(true);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              {error}
              <Link href="/auth/login" className="text-sm underline underline-offset-3">
                Sign in to view profile
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="flex flex-wrap items-start gap-6 p-6">
                <Avatar className="size-24 text-2xl font-bold">
                  {profile?.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={displayName} className="rounded-full" />
                  ) : (
                    <AvatarFallback>{initials}</AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  {!isSelf && (
                    <div className="relative z-10 mb-2 flex justify-end">
                      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="outline" size="icon" aria-label="Open profile actions">
                              <MoreVertical />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          {relationshipStatus !== "blocked" ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => void updateBlockStatus("block")}
                            >
                              <Shield data-icon="inline-start" />
                              Block User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => void updateBlockStatus("unblock")}>
                              <Shield data-icon="inline-start" />
                              Unblock User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setReportModalOpen(true);
                              setReportSubmitted(false);
                              setMenuOpen(false);
                            }}
                          >
                            <Flag data-icon="inline-start" />
                            Report User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-heading text-2xl font-bold tracking-tight">{displayName}</h1>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${rank.color}`}>
                      {rank.name}
                    </span>
                    {!isSelf && isFriendWithViewer && (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                        Friends
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Friends: {friendCount}</p>
                  {profile?.team_name && (
                    <p className="mt-1 text-sm text-muted-foreground">Team: {profile.team_name}</p>
                  )}
                  {profile?.club_name && (
                    <Link
                      href={profile.club_id ? `/clubs/${profile.club_id}` : "/clubs"}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span className="text-lg">{profile.club_logo || "≡ƒÅå"}</span>
                      <span className="font-medium">{profile.club_name}</span>
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Trophy className="size-3" />
                        {(profile.club_trophies ?? 0).toLocaleString()}
                      </span>
                    </Link>
                  )}

                  {profile?.badges && profile.badges.length > 0 && (
                    <div className="mt-4">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Badges ({profile.badges.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.badges.map((badge) => (
                          <Tooltip key={badge.id}>
                            <TooltipTrigger
                              render={
                                <div className="flex size-11 cursor-help items-center justify-center rounded-lg border bg-card text-xl shadow-sm transition-colors hover:border-accent-foreground/30">
                                  {badge.icon}
                                </div>
                              }
                            />
                            <TooltipContent>
                              <p className="font-semibold">{badge.name}</p>
                              <p className="text-xs text-muted-foreground">{badge.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSelf && (
                    <LinkButton variant="outline" href="/settings" className="mt-4">
                      <Settings data-icon="inline-start" />
                      Edit Profile
                    </LinkButton>
                  )}
                  {!isSelf && relationshipStatus === "none" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendFriendRequest}
                      disabled={actionBusy}
                      className="mt-4"
                    >
                      <UserPlus data-icon="inline-start" />
                      {actionBusy ? "Sending..." : "Add Friend"}
                    </Button>
                  )}
                  {!isSelf && relationshipStatus === "incoming_pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={acceptFriendRequest}
                        disabled={actionBusy}
                      >
                        {actionBusy ? "Updating..." : "Accept Request"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={declineFriendRequest}
                        disabled={actionBusy}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                  {!isSelf && relationshipStatus === "outgoing_pending" && (
                    <Badge variant="secondary" className="mt-4">
                      Request Sent
                    </Badge>
                  )}
                  {!isSelf && relationshipStatus === "blocked" && (
                    <Badge variant="outline" className="mt-4 border-rose-500/30 text-rose-500">
                      User blocked
                    </Badge>
                  )}
                  {!isSelf && relationshipStatus === "blocked_by_other" && (
                    <Badge variant="outline" className="mt-4 border-rose-500/30 text-rose-500">
                      You are blocked by this user
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <section className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-accent-foreground">{rating}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Rating</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-500">{wins}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Wins</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{losses}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Losses</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{winRate}%</div>
                  <div className="mt-1 text-xs text-muted-foreground">Win Rate</div>
                </CardContent>
              </Card>
            </section>

            {/* Recent Activity */}
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Clock className="size-12 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <Link href="/practice" className="text-sm text-accent-foreground underline underline-offset-3">
                      Start practicing ΓåÆ
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-lg font-semibold">Achievements</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { name: "First Win", description: "Win your first match", unlocked: wins > 0 },
                    { name: "5-Win Streak", description: "Win 5 matches in a row", unlocked: false },
                    { name: "Problem Solver", description: "Solve 50 practice problems", unlocked: false },
                  ].map((achievement) => (
                    <div
                      key={achievement.name}
                      className={`rounded-lg border p-4 transition-all ${
                        achievement.unlocked
                          ? "border-accent-foreground/30 bg-accent/40 shadow-sm"
                          : "opacity-50"
                      }`}
                    >
                      <div className="text-sm font-medium">{achievement.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{achievement.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Report Modal */}
        <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
          <DialogContent className="w-full max-w-lg gap-5 p-6">
            {!reportSubmitted ? (
              <>
                <DialogHeader>
                  <DialogTitle>Report {displayName}</DialogTitle>
                  <DialogDescription>
                    Tell us what happened. This is a demo flow for now.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-2">
                  {["Harassment", "Cheating", "Spam", "Inappropriate Name"].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReportReason(reason)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                        reportReason === reason
                          ? "border-accent-foreground/40 bg-accent/60 shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <Textarea
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                  placeholder="Describe the issue..."
                  className="h-28"
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setReportModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={submitReport}>
                    Submit Report
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Report Submitted</DialogTitle>
                  <DialogDescription>
                    Our moderators will review your report. Thank you for helping keep Code Royale safe.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setReportModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="mx-auto w-full max-w-4xl p-6">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-40 w-full" />
              <div className="grid grid-cols-4 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
          </div>
        </AppShell>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
