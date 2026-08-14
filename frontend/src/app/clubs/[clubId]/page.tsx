"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, Trophy } from "lucide-react";

import { AppShell } from "../../../components/app-shell";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

type ClubPrivacy = "public" | "private";

type ClubMember = {
  id: string;
  username: string;
  avatar: string;
  trophies: number;
  role: "host" | "elder" | "member";
};

type Club = {
  id: string;
  name: string;
  logo: string;
  emblem: string;
  trophies: number;
  privacy: ClubPrivacy;
  max_members: number;
  owner_id: string;
  created_at: string;
  memberCount: number;
  members: ClubMember[];
};

type ViewerState = {
  viewerId: string;
  isMember: boolean;
  role: "host" | "elder" | "member" | null;
};

const emblemOptions = [
  { id: "sword",     color: "from-red-500 to-orange-500" },
  { id: "shield",    color: "from-blue-500 to-cyan-500" },
  { id: "crown",     color: "from-amber-500 to-yellow-500" },
  { id: "star",      color: "from-purple-500 to-pink-500" },
  { id: "lightning", color: "from-cyan-500 to-blue-500" },
  { id: "fire",      color: "from-orange-500 to-red-500" },
  { id: "dragon",    color: "from-emerald-500 to-teal-500" },
  { id: "target",    color: "from-rose-500 to-pink-500" },
];

function emblemColor(emblem: string) {
  return emblemOptions.find((e) => e.id === emblem)?.color ?? "from-blue-500 to-cyan-500";
}

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = typeof params.clubId === "string" ? params.clubId : "";
  const isInviteLink = searchParams.get("invite") === "1";

  const [club, setClub] = useState<Club | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadClub = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clubs/detail?clubId=${encodeURIComponent(clubId)}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Club not found");
      }
      const payload = (await response.json()) as { club: Club; viewer: ViewerState };
      setClub(payload.club);
      setViewer(payload.viewer);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Club not found.");
      setClub(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      void loadClub();
    }
  }, [clubId]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-6">
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <span className="mr-2 size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            Loading club...
          </div>
        </div>
      </AppShell>
    );
  }

  if (!club) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl p-6">
          <Card className="p-6 text-center">
            <CardContent className="flex flex-col items-center gap-4 p-0">
              <p className="text-muted-foreground">{error ?? "Club not found."}</p>
              <Button onClick={() => router.push("/clubs")}>Back to Clubs</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const isMyClub = Boolean(viewer?.isMember);
  const isInClub = Boolean(viewer?.isMember);
  const isFull = club.memberCount >= club.max_members;
  const isHost = viewer?.role === "host";

  const handleJoin = async () => {
    if (isInClub || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/clubs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to join this club right now.");
      }

      if (payload.status === "request_sent") {
        alert(`Request sent to join ${club.name}! The club host will review your request.`);
        return;
      }

      await loadClub();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to join this club.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!isMyClub || actionBusy) return;
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
        throw new Error(payload.error ?? "Unable to leave this club right now.");
      }

      router.push("/clubs");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to leave this club.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/clubs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft data-icon="inline-start" />
            Back to Clubs
          </Link>
          {isMyClub ? (
            <Button
              variant="outline"
              onClick={() => void handleLeave()}
              disabled={actionBusy}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              {actionBusy ? "Leaving..." : "Leave Club"}
            </Button>
          ) : isFull ? (
            <Badge variant="secondary">Full</Badge>
          ) : isInClub ? (
            <Badge variant="secondary">In a Club</Badge>
          ) : (
            <Button onClick={() => void handleJoin()} disabled={actionBusy}>
              {actionBusy
                ? "Working..."
                : club.privacy === "private"
                  ? (isInviteLink ? "Request via Invite" : "Request to Join")
                  : (isInviteLink ? "Join via Invite" : "Join Club")}
            </Button>
          )}
        </div>

        {isInviteLink && !isMyClub && !isFull && (
          <Alert className="mb-4 border-accent bg-accent/40">
            <AlertDescription>
              You opened an invite link for this club.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-wrap items-start gap-6 p-6">
            <div className={`flex size-20 items-center justify-center rounded-xl bg-gradient-to-br ${emblemColor(club.emblem)} text-4xl`}>
              {club.logo}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
                {club.privacy === "private" && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <Lock data-icon="inline-start" />
                    Private
                  </Badge>
                )}
                {isHost && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                    You are the host
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {new Date(club.created_at).toLocaleDateString()}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Trophy className="size-4 text-amber-500" />
                  {club.trophies.toLocaleString()} Trophies
                </span>
                <span>•</span>
                <span>{club.memberCount}/{club.max_members} Members</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Members</h2>
          </div>
          <div className="flex flex-col divide-y">
            {club.members.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No members yet</div>
            ) : (
              club.members.map((player, idx) => (
                <div key={player.id} className="flex items-center gap-4 p-4">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0
                        ? "bg-amber-500/20 text-amber-500"
                        : idx === 1
                          ? "bg-muted text-muted-foreground"
                          : "bg-orange-500/20 text-orange-500"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {player.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {player.username}
                        {player.id === viewer?.viewerId && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                      </span>
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
                  </div>
                  <div className="text-sm font-semibold text-amber-500">
                    {player.trophies.toLocaleString()} trophies
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}