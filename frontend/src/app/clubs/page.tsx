"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Crown, Lock, Search, Swords, Trophy, Users } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

type ClubPrivacy = "public" | "private";
type MaxMembers = 10 | 20 | 30 | 40;

/* ── Types ──────────────────────────────────────────────── */
interface ClubMember {
  id: string;
  username: string;
  avatar: string;
  trophies: number;
  role: "host" | "elder" | "member";
}

interface Club {
  id: string;
  name: string;
  logo: string;
  emblem: string;
  trophies: number;
  members: number;
  maxMembers: number;
  privacy: ClubPrivacy;
  rank: number;
  description?: string;
  topPlayers: ClubMember[];
}

type ApiClub = {
  id: string;
  name: string;
  logo: string;
  emblem: string;
  privacy: ClubPrivacy;
  max_members: number;
  trophies: number;
  owner_id: string;
  created_at: string;
  memberCount: number;
  topPlayers: ClubMember[];
};

function normalizeClub(club: ApiClub, index: number): Club {
  return {
    id: club.id,
    name: club.name,
    logo: club.logo,
    emblem: club.emblem,
    trophies: club.trophies ?? 0,
    members: club.memberCount ?? 0,
    maxMembers: club.max_members ?? 20,
    privacy: club.privacy ?? "public",
    rank: index + 1,
    topPlayers: club.topPlayers ?? [],
  };
}

const logoOptions = ["⚔", "🐉", "◎", "⚡", "🔥", "🏆", "💎", "🚀", "👑", "🦁", "🐺", "🦅"];
const emblemOptions = [
  { id: "sword",     name: "Sword",     color: "from-red-500 to-orange-500" },
  { id: "shield",    name: "Shield",    color: "from-slate-500 to-slate-400" },
  { id: "crown",     name: "Crown",     color: "from-amber-500 to-yellow-500" },
  { id: "star",      name: "Star",      color: "from-blue-600 to-sky-500" },
  { id: "lightning", name: "Lightning", color: "from-amber-400 to-orange-500" },
  { id: "fire",      name: "Fire",      color: "from-orange-500 to-red-500" },
  { id: "dragon",    name: "Dragon",    color: "from-emerald-600 to-teal-500" },
  { id: "target",    name: "Target",    color: "from-rose-500 to-red-400" },
];

function emblemColor(emblem: string) {
  return emblemOptions.find((e) => e.id === emblem)?.color ?? "from-slate-500 to-slate-400";
}

/* ── Hover tooltip component ────────────────────────────── */
function ClubHoverCard({ club }: { club: Club }) {
  return (
    <div className="pointer-events-none absolute right-full top-0 z-50 mr-2 w-72 rounded-xl border bg-popover p-4 shadow-lg animate-in fade-in-0 zoom-in-95">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg bg-gradient-to-br ${emblemColor(club.emblem)} text-xl`}>
          {club.logo}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{club.name}</span>
            {club.privacy === "private" && <Lock className="size-3.5 text-amber-500" />}
          </div>
          <div className="text-xs text-muted-foreground">{club.members}/{club.maxMembers} members</div>
        </div>
      </div>

      {club.description && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{club.description}</p>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
        <Trophy className="size-4 text-amber-500" />
        <span className="text-sm font-semibold text-amber-500">{club.trophies.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">Total Trophies</span>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Top 3 Players
        </div>
        <div className="flex flex-col gap-1.5">
          {club.topPlayers.map((player, i) => (
            <div key={player.id} className="flex items-center gap-2">
              <span
                className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  i === 0
                    ? "bg-amber-500/20 text-amber-500"
                    : i === 1
                      ? "bg-muted text-muted-foreground"
                      : "bg-orange-500/20 text-orange-500"
                }`}
              >
                {i + 1}
              </span>
              <div className="flex size-6 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                {player.avatar}
              </div>
              <span className="flex-1 truncate text-xs font-medium">{player.username}</span>
              <span className="text-[10px] text-amber-500">{player.trophies.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hoverable club row ─────────────────────────────────── */
function ClubRow({
  club,
  myClub,
  onJoin,
  onOpen,
}: {
  club: Club;
  myClub: Club | null;
  onJoin: (club: Club) => void;
  onOpen: (clubId: string) => void;
}) {
  const [showHover, setShowHover] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setShowHover(true), 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setShowHover(false);
  };

  const isInClub = !!myClub;
  const isMyClub = myClub?.id === club.id;
  const isFull = club.members >= club.maxMembers;

  return (
    <div
      className="relative flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-muted/50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("button") || target?.closest("a")) return;
        onOpen(club.id);
      }}
    >
      {showHover && !isMyClub && <ClubHoverCard club={club} />}

      <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${emblemColor(club.emblem)} text-2xl`}>
        {club.logo}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{club.name}</span>
          {club.privacy === "private" && <Lock className="size-4 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{club.members}/{club.maxMembers} members</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Trophy className="size-3.5 text-amber-500" />
            {club.trophies.toLocaleString()}
          </span>
        </div>
      </div>

      {isMyClub ? (
        <Badge variant="outline" className="shrink-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          Joined
        </Badge>
      ) : isFull ? (
        <Badge variant="secondary" className="shrink-0">
          Full
        </Badge>
      ) : isInClub ? (
        <Badge
          variant="secondary"
          className="shrink-0 cursor-not-allowed"
          title="Leave your current club first"
        >
          In a Club
        </Badge>
      ) : (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onJoin(club);
          }}
          className="shrink-0"
        >
          {club.privacy === "private" ? "Request" : "Join"}
        </Button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Main Clubs Page
   ────────────────────────────────────────────────────────── */
export default function ClubsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showBrowse, setShowBrowse] = useState(false);

  // Create club form state
  const [clubName, setClubName] = useState("");
  const [selectedLogo, setSelectedLogo] = useState(logoOptions[0]);
  const [selectedEmblem, setSelectedEmblem] = useState(emblemOptions[0].id);
  const [privacy, setPrivacy] = useState<ClubPrivacy>("public");
  const [maxMembers, setMaxMembers] = useState<MaxMembers>(20);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const [myClub, setMyClub] = useState<Club | null>(null);
  const [clubList, setClubList] = useState<Club[]>([]);
  const [myClubMembers, setMyClubMembers] = useState<ClubMember[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/clubs/list", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Failed to load clubs (${response.status})`);
      }
      const payload = (await response.json()) as { clubs: ApiClub[]; myClub: ApiClub | null };
      const clubs = (payload.clubs ?? []).map(normalizeClub);
      setClubList(clubs);
      setMyClub(payload.myClub ? normalizeClub(payload.myClub, clubs.findIndex((c) => c.id === payload.myClub?.id)) : null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to load clubs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  const loadClubMembers = useCallback(async () => {
    if (!myClub) return;
    try {
      const response = await fetch(`/api/clubs/detail?clubId=${encodeURIComponent(myClub.id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        club: { members: ClubMember[] };
        viewer?: { viewerId?: string | null };
      };
      setMyClubMembers(payload.club?.members ?? []);
      if (payload.viewer?.viewerId) {
        setViewerId(payload.viewer.viewerId);
      }
    } catch (err) {
      console.error("Failed to load club members", err);
    }
  }, [myClub]);

  useEffect(() => {
    if (myClub && !showBrowse) {
      void loadClubMembers();
    }
  }, [myClub, showBrowse, loadClubMembers]);

  const filteredClubs = clubList.filter((club) =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClub = async () => {
    if (!clubName.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/clubs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clubName,
          logo: selectedLogo,
          emblem: selectedEmblem,
          privacy,
          maxMembers,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; club?: ApiClub };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create club right now.");
      }

      if (payload.club) {
        const newClub = normalizeClub(payload.club, 0);
        setClubList((prev) => [newClub, ...prev.filter((c) => c.id !== newClub.id)]);
        setMyClub(newClub);
      }
      setShowCreateModal(false);
      setClubName("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to create club.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClub = async (club: Club) => {
    if (myClub) return; // Already in a club
    setActionBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/clubs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: club.id }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to join this club right now.");
      }

      if (payload.status === "request_sent") {
        alert(`Request sent to join ${club.name}! The club host will review your request.`);
        return;
      }

      // Joined successfully — refresh so member counts update
      await loadClubs();
      setShowBrowse(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to join this club.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!myClub) return;
    if (!confirm("Are you sure you want to leave this club?")) return;
    setActionBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/clubs/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to leave your club right now.");
      }

      setMyClub(null);
      await loadClubs();
      setShowBrowse(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to leave your club.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleOpenClub = (clubId: string) => {
    router.push(`/clubs/${clubId}`);
  };

  const getInviteLink = () => {
    if (!myClub) return "";
    if (typeof window === "undefined") return `/clubs/${myClub.id}?invite=1`;
    return `${window.location.origin}/clubs/${myClub.id}?invite=1`;
  };

  const handleCopyInviteLink = async () => {
    const inviteLink = getInviteLink();
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  const handleCopyShareText = async () => {
    if (!myClub) return;
    const message = [
      `Join my club "${myClub.name}" in Code Royale!`,
      `Club rank: #${myClub.rank}`,
      `Average games/week: 0`,
      getInviteLink(),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  /* ── If user has a club, show "My Club" view by default ── */
  if (myClub && !showBrowse) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-5xl p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Club</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your club and compete with teammates
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowBrowse(true)}>
              <Search data-icon="inline-start" />
              Browse Clubs
            </Button>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-start gap-6 p-6">
              <div className={`flex size-20 items-center justify-center rounded-xl bg-gradient-to-br ${emblemColor(myClub.emblem)} text-4xl`}>
                {myClub.logo}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold tracking-tight">{myClub.name}</h2>
                  {myClub.privacy === "private" && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                      Private
                    </Badge>
                  )}
                </div>
                {myClub.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{myClub.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Trophy className="size-4 text-amber-500" />
                    {myClub.trophies.toLocaleString()} Trophies
                  </span>
                  <span>•</span>
                  <span>{myClub.members}/{myClub.maxMembers} Members</span>
                  <span>•</span>
                  <span>Rank #{myClub.rank}</span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => void handleLeaveClub()}
                disabled={actionBusy}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {actionBusy ? "Leaving..." : "Leave Club"}
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/game-modes?mode=club-battle"
              className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Swords className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">Battle Club Members</div>
                  <div className="text-xs text-muted-foreground">Practice with your teammates</div>
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="group rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Users className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">Invite Friends</div>
                  <div className="text-xs text-muted-foreground">Grow your club roster</div>
                </div>
              </div>
            </button>
          </div>

          <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
            <DialogContent className="w-full max-w-xl gap-5 p-6">
              <DialogHeader className="flex-row items-center justify-between">
                <DialogTitle>Invite Friends</DialogTitle>
              </DialogHeader>
              <DialogDescription>
                Share your club link with friends. They can open it and join your club directly.
              </DialogDescription>

              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Invite link
                </div>
                <div className="break-all text-sm">{getInviteLink()}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Average games/week</div>
                  <div className="mt-1 text-xl font-semibold">0</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Open slots</div>
                  <div className="mt-1 text-xl font-semibold">
                    {Math.max(myClub.maxMembers - myClub.members, 0)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleCopyInviteLink}>
                  {copyState === "copied" ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                  Copy this link
                </Button>
                <Button type="button" variant="outline" onClick={handleCopyShareText}>
                  Share to YouTube
                </Button>
                <Button type="button" variant="outline" onClick={handleCopyShareText}>
                  Share to LinkedIn
                </Button>
                <Button type="button" variant="outline" onClick={handleCopyShareText}>
                  Share to Twitter
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                {copyState === "copied" && "Copied to clipboard."}
                {copyState === "failed" && "Could not copy. Please copy manually."}
                {copyState === "idle" && "Share buttons currently copy the ready-to-share message."}
              </div>
            </DialogContent>
          </Dialog>

          <Card className="mt-6">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">Members</h3>
            </div>
            <div className="flex flex-col divide-y">
              {/* You */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">
                  Y
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">You</span>
                    {(() => {
                      const myRole = myClubMembers.find((m) => m.id === viewerId)?.role;
                      if (myRole === "host") {
                        return (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                            HOST
                          </Badge>
                        );
                      }
                      if (myRole === "elder") {
                        return (
                          <Badge variant="outline" className="border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                            ELDER
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {myClubMembers.find((m) => m.id === viewerId)?.trophies.toLocaleString() ?? 0} trophies contributed
                  </div>
                </div>
              </div>

              {/* Other members */}
              {myClubMembers.filter((p) => p.id !== viewerId).map((player) => (
                <div key={player.id} className="flex items-center gap-4 p-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">
                    {player.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.username}</span>
                      {player.role === "host" && (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                          HOST
                        </Badge>
                      )}
                      {player.role === "elder" && (
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                          ELDER
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.trophies.toLocaleString()} trophies contributed
                    </div>
                  </div>
                </div>
              ))}

              {myClubMembers.length <= 1 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No other members yet</p>
                  <p className="mt-1 text-xs">Invite friends to join your club!</p>
                </div>
              )}
            </div>
          </Card>

          {myClub.privacy === "private" && (
            <Card className="mt-6">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">Join Requests</h3>
              </div>
              <div className="p-8 text-center text-sm text-muted-foreground">
                No pending requests
              </div>
            </Card>
          )}
        </div>
      </AppShell>
    );
  }

  /* ── No club OR user clicked "Browse Clubs" ──────────── */
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clubs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {myClub
                ? "Browse other clubs (leave your current club first to join another)"
                : "Join a club to compete with teammates and earn bonus trophies"}
            </p>
          </div>
          <div className="flex gap-2">
            {myClub && (
              <Button onClick={() => setShowBrowse(false)}>
                ← Back to My Club
              </Button>
            )}
            {!myClub && (
              <Button onClick={() => setShowCreateModal(true)}>
                + Create Club
              </Button>
            )}
          </div>
        </div>

        {myClub && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <Crown className="size-5 shrink-0 text-amber-500" />
            <span className="text-sm text-amber-600 dark:text-amber-300">
              You are already in <strong>{myClub.name}</strong>. Leave your club first to join a different one.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="py-2.5 pl-10"
          />
        </div>

        <Card>
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Clubs to Join</h2>
          </div>
          <div className="flex flex-col divide-y">
            {loading ? (
              <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                <span className="mr-2 size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                Loading clubs...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-sm text-destructive">{error}</div>
            ) : filteredClubs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? `No clubs found matching "${searchQuery}".`
                  : "No clubs yet. Create one to get started."}
              </div>
            ) : (
              filteredClubs.map((club) => (
                <ClubRow
                  key={club.id}
                  club={club}
                  myClub={myClub}
                  onJoin={handleJoinClub}
                  onOpen={handleOpenClub}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ── Create Club Modal ───────────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-full max-w-lg gap-5 p-6">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle>Create a New Club</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="club-name">Club Name</Label>
              <Input
                id="club-name"
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Enter club name..."
                maxLength={24}
              />
              <p className="text-xs text-muted-foreground">{clubName.length}/24</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Club Logo</Label>
              <div className="flex flex-wrap gap-2">
                {logoOptions.map((logo) => (
                  <button
                    key={logo}
                    type="button"
                    onClick={() => setSelectedLogo(logo)}
                    aria-label={`Logo ${logo}`}
                    className={`flex size-11 items-center justify-center rounded-lg text-xl transition-all ${
                      selectedLogo === logo
                        ? "bg-accent ring-2 ring-ring"
                        : "bg-muted hover:bg-muted/60"
                    }`}
                  >
                    {logo}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Club Emblem</Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {emblemOptions.map((emblem) => (
                  <button
                    key={emblem.id}
                    type="button"
                    onClick={() => setSelectedEmblem(emblem.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
                      selectedEmblem === emblem.id
                        ? "ring-2 ring-ring"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <div className={`size-7 rounded-full bg-gradient-to-br ${emblem.color}`} />
                    <span className="text-[9px] text-muted-foreground">{emblem.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Privacy</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPrivacy("public")}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    privacy === "public"
                      ? "border-primary/40 bg-accent/60 shadow-sm"
                      : "hover:bg-muted/60"
                  }`}
                >
                  <span className="text-sm font-medium">Public</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">Anyone can join</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacy("private")}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    privacy === "private"
                      ? "border-primary/40 bg-accent/60 shadow-sm"
                      : "hover:bg-muted/60"
                  }`}
                >
                  <span className="text-sm font-medium">Private</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">Approve requests</p>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Max Members</Label>
              <div className="grid grid-cols-4 gap-2">
                {([10, 20, 30, 40] as MaxMembers[]).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setMaxMembers(num)}
                    className={`rounded-lg border py-2 text-center transition-all ${
                      maxMembers === num
                        ? "border-primary/40 bg-accent/60 shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="text-base font-semibold">{num}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <div className="flex items-center gap-3">
                <div className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${emblemColor(selectedEmblem)} text-2xl`}>
                  {selectedLogo}
                </div>
                <div>
                  <div className="font-semibold">{clubName || "Club Name"}</div>
                  <div className="text-xs text-muted-foreground">
                    {privacy === "private" ? "Private" : "Public"} • Max {maxMembers}
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => void handleCreateClub()}
              disabled={!clubName.trim() || creating}
              size="lg"
            >
              {creating ? "Creating..." : "Create Club"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}