"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../../components/app-shell";

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
          <div className="flex items-center justify-center py-12 text-sm text-[var(--cr-fg-muted)]">
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[var(--cr-border)] border-t-[rgb(var(--cr-accent-rgb))]" />
            Loading club...
          </div>
        </div>
      </AppShell>
    );
  }

  if (!club) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6 text-center">
            <p className="text-[var(--cr-fg-muted)]">{error ?? "Club not found."}</p>
            <button
              onClick={() => router.push("/clubs")}
              className="mt-4 rounded-lg bg-[rgb(var(--cr-accent-rgb))] px-4 py-2 text-sm font-medium text-white"
            >
              Back to Clubs
            </button>
          </div>
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
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/clubs"
            className="text-sm text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
          >
            ← Back to Clubs
          </Link>
          {isMyClub ? (
            <button
              onClick={() => void handleLeave()}
              disabled={actionBusy}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionBusy ? "Leaving..." : "Leave Club"}
            </button>
          ) : isFull ? (
            <span className="rounded-lg bg-[var(--cr-bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--cr-fg-muted)]">
              Full
            </span>
          ) : (
            <button
              onClick={() => void handleJoin()}
              disabled={actionBusy}
              className="rounded-lg bg-[rgb(var(--cr-accent-rgb))] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionBusy
                ? "Working..."
                : club.privacy === "private"
                  ? (isInviteLink ? "Request via Invite" : "Request to Join")
                  : (isInviteLink ? "Join via Invite" : "Join Club")}
            </button>
          )}
        </div>

        {isInviteLink && !isMyClub && !isFull && (
          <div className="mb-4 rounded-lg border border-[rgba(var(--cr-accent-rgb),0.4)] bg-[rgba(var(--cr-accent-rgb),0.12)] px-4 py-3 text-sm text-[var(--cr-fg)]">
            You opened an invite link for this club.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className={`flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br ${
              emblemOptions.find((e) => e.id === club.emblem)?.color ?? "from-blue-500 to-cyan-500"
            } text-4xl`}>
              {club.logo}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[var(--cr-fg)]">{club.name}</h1>
                {club.privacy === "private" && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                    Private
                  </span>
                )}
                {isHost && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                    You are the host
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">
                Created {new Date(club.created_at).toLocaleDateString()}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--cr-fg-muted)]">
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a4 4 0 0 0 3 3.87A6 6 0 0 0 11 14.9V17H8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-3v-2.1a6 6 0 0 0 4-3.99 4 4 0 0 0 3-3.87V5a1 1 0 0 0-1-1Z"/>
                  </svg>
                  {club.trophies.toLocaleString()} Trophies
                </span>
                <span>•</span>
                <span>{club.memberCount}/{club.max_members} Members</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
          <div className="border-b border-[var(--cr-border)] px-4 py-3">
            <h2 className="font-semibold text-[var(--cr-fg)]">Members</h2>
          </div>
          <div className="divide-y divide-[var(--cr-border)]">
            {club.members.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--cr-fg-muted)]">No members yet</div>
            ) : (
              club.members.map((player, idx) => (
                <div key={player.id} className="flex items-center gap-4 p-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-amber-500/20 text-amber-400"
                    : idx === 1 ? "bg-slate-400/20 text-slate-300"
                    : "bg-orange-500/20 text-orange-400"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--cr-accent-rgb),0.15)] text-xs font-bold text-[rgb(var(--cr-accent-rgb))]">
                    {player.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--cr-fg)]">
                        {player.username}
                        {player.id === viewer?.viewerId && <span className="ml-1 text-xs text-[var(--cr-fg-muted)]">(you)</span>}
                      </span>
                      {player.role === "host" && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">HOST</span>
                      )}
                      {player.role === "elder" && (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">ELDER</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-amber-400">
                    {player.trophies.toLocaleString()} trophies
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}