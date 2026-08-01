"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";

/* ── League tier config ─────────────────────────────────── */
type League = "bronze" | "silver" | "gold" | "platinum" | "diamond";

const leagueTiers: {
  id: League;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
  minTrophies: number;
}[] = [
  { id: "bronze",   label: "Bronze",   color: "text-amber-700",   bg: "bg-amber-900/30",   border: "border-amber-700/40",   icon: "🥉", minTrophies: 0 },
  { id: "silver",   label: "Silver",   color: "text-slate-300",   bg: "bg-slate-600/20",   border: "border-slate-400/40",   icon: "🥈", minTrophies: 1000 },
  { id: "gold",     label: "Gold",     color: "text-amber-400",   bg: "bg-amber-500/20",   border: "border-amber-400/40",   icon: "🥇", minTrophies: 2500 },
  { id: "platinum", label: "Platinum", color: "text-cyan-300",    bg: "bg-cyan-500/15",    border: "border-cyan-400/40",    icon: "💎", minTrophies: 5000 },
  { id: "diamond",  label: "Diamond",  color: "text-violet-300",  bg: "bg-violet-500/15",  border: "border-violet-400/40",  icon: "👑", minTrophies: 10000 },
];

function getLeague(trophies: number): League {
  if (trophies >= 10000) return "diamond";
  if (trophies >= 5000) return "platinum";
  if (trophies >= 2500) return "gold";
  if (trophies >= 1000) return "silver";
  return "bronze";
}

function getTierConfig(league: League) {
  return leagueTiers.find((t) => t.id === league)!;
}

/* ── Real player type ────────────────────────────────────── */
type LeaderboardPlayer = {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
};

function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? ""}`.toUpperCase();
}

/* ── Component ──────────────────────────────────────────── */
export default function LeaderboardPage() {
  const [selectedLeague, setSelectedLeague] = useState<League | "all">("all");
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myWins, setMyWins] = useState(0);
  const [myLosses, setMyLosses] = useState(0);
  const [realTimeCount, setRealTimeCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const fetchLeaderboard = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (alive && user?.id) {
          setMyUserId(user.id);

          const { data: userRow } = await supabase
            .from("users")
            .select("rating,wins,losses")
            .eq("id", user.id)
            .maybeSingle();

          if (alive && userRow) {
            setMyRating(typeof userRow.rating === "number" ? userRow.rating : 0);
            setMyWins(typeof userRow.wins === "number" ? userRow.wins : 0);
            setMyLosses(typeof userRow.losses === "number" ? userRow.losses : 0);
          }
        }

        // Get all players ranked by rating
        const { data: allPlayers } = await supabase
          .from("users")
          .select("id,username,rating,wins,losses")
          .order("rating", { ascending: false })
          .limit(100);

        if (alive && allPlayers) {
          const mapped: LeaderboardPlayer[] = allPlayers.map((p) => ({
            id: p.id as string,
            username: (p.username as string) ?? "Anonymous",
            rating: typeof p.rating === "number" ? p.rating : 0,
            wins: typeof p.wins === "number" ? p.wins : 0,
            losses: typeof p.losses === "number" ? p.losses : 0,
          }));
          setPlayers(mapped);
          setRealTimeCount(mapped.length);
        }
      } catch (err) {
        console.error("Failed to load leaderboard", err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchLeaderboard();

    // Refresh every 10 seconds for real-time feel
    const interval = setInterval(fetchLeaderboard, 10_000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const isUnranked = myRating === 0 && myWins === 0 && myLosses === 0;
  const myLeague = isUnranked ? null : getLeague(myRating);

  const sortedPlayers = useMemo(() => {
    if (selectedLeague === "all") return players;
    return players.filter((p) => getLeague(p.rating) === selectedLeague);
  }, [players, selectedLeague]);

  const myLeaguePlayers = useMemo(() => {
    if (!myLeague) return [];
    return players
      .filter((p) => getLeague(p.rating) === myLeague)
      .slice(0, 10);
  }, [players, myLeague]);

  const myRank = useMemo(() => {
    if (!myUserId) return null;
    const idx = players.findIndex((p) => p.id === myUserId);
    return idx >= 0 ? idx + 1 : null;
  }, [players, myUserId]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--cr-fg)]">Leaderboard</h1>
            <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">
              Compete, climb ranks, and dominate the leagues
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-[var(--cr-fg-muted)]">
              {realTimeCount} player{realTimeCount !== 1 ? "s" : ""} ranked
            </span>
          </div>
        </div>

        {/* Your Rank Card */}
        <div className="mb-6 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--cr-accent-rgb),0.2)] text-lg font-bold text-[rgb(var(--cr-accent-rgb))]">
                {myUserId ? "You" : "?"}
              </div>
              <div>
                <div className="text-sm text-[var(--cr-fg-muted)]">Your Status</div>
                {isUnranked ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold text-[var(--cr-fg)]">Unranked</span>
                    <span className="rounded bg-[var(--cr-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--cr-fg-muted)]">
                      Play a match to get ranked!
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold text-[var(--cr-fg)]">
                      {myRating.toLocaleString()} Trophies
                    </span>
                    {myLeague && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${getTierConfig(myLeague).bg} ${getTierConfig(myLeague).color}`}>
                        {getTierConfig(myLeague).icon} {getTierConfig(myLeague).label}
                      </span>
                    )}
                    {myRank && (
                      <span className="rounded bg-[var(--cr-bg-tertiary)] px-2 py-0.5 text-xs text-[var(--cr-fg-muted)]">
                        Rank #{myRank}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* W/L */}
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-400">{myWins}</div>
                <div className="text-xs text-[var(--cr-fg-muted)]">Wins</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-400">{myLosses}</div>
                <div className="text-xs text-[var(--cr-fg-muted)]">Losses</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--cr-fg)]">{myWins + myLosses}</div>
                <div className="text-xs text-[var(--cr-fg-muted)]">Played</div>
              </div>
            </div>
          </div>
        </div>

        {/* League Tiers */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--cr-fg-muted)]">
            Leagues
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedLeague("all")}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                selectedLeague === "all"
                  ? "bg-[rgba(var(--cr-accent-rgb),0.15)] text-[rgb(var(--cr-accent-rgb))] ring-1 ring-[rgb(var(--cr-accent-rgb))]"
                  : "bg-[var(--cr-bg-secondary)] text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
              }`}
            >
              All Leagues
            </button>
            {leagueTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedLeague(tier.id)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  selectedLeague === tier.id
                    ? `${tier.bg} ${tier.color} ring-1 ${tier.border}`
                    : "bg-[var(--cr-bg-secondary)] text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
                }`}
              >
                {tier.icon} {tier.label}
                <span className="ml-1 opacity-60">({tier.minTrophies.toLocaleString()}+)</span>
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
          <div className="border-b border-[var(--cr-border)] px-4 py-3">
            <h2 className="font-semibold text-[var(--cr-fg)]">
              {selectedLeague === "all"
                ? "Global Leaderboard"
                : `${getTierConfig(selectedLeague as League).icon} ${getTierConfig(selectedLeague as League).label} League`}
            </h2>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[3rem_1fr_6rem_5rem_5rem_5rem] items-center gap-2 border-b border-[var(--cr-border)] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--cr-fg-muted)]">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Trophies</span>
            <span className="text-right">W</span>
            <span className="text-right">L</span>
            <span className="text-right">League</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--cr-border)]">
            {loading ? (
              <div className="p-8 text-center text-sm text-[var(--cr-fg-muted)]">
                Loading leaderboard...
              </div>
            ) : sortedPlayers.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--cr-fg-muted)]">
                {selectedLeague === "all"
                  ? "No players yet. Be the first to compete!"
                  : "No players in this league yet"}
              </div>
            ) : (
              sortedPlayers.map((player, idx) => {
                const league = getLeague(player.rating);
                const tierCfg = getTierConfig(league);
                const rank = idx + 1;
                const isMe = player.id === myUserId;
                return (
                  <div
                    key={player.id}
                    className={`grid grid-cols-[3rem_1fr_6rem_5rem_5rem_5rem] items-center gap-2 px-4 py-3 transition-colors hover:bg-[var(--cr-bg-tertiary)] ${
                      rank <= 3 ? "bg-[var(--cr-bg-tertiary)]/50" : ""
                    } ${isMe ? "ring-1 ring-[rgba(var(--cr-accent-rgb),0.3)]" : ""}`}
                  >
                    {/* Rank */}
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      rank === 1
                        ? "bg-amber-500/20 text-amber-400"
                        : rank === 2
                        ? "bg-slate-400/20 text-slate-300"
                        : rank === 3
                        ? "bg-orange-500/20 text-orange-400"
                        : "text-[var(--cr-fg-muted)]"
                    }`}>
                      {rank}
                    </div>

                    {/* Player */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--cr-accent-rgb),0.15)] text-xs font-bold text-[rgb(var(--cr-accent-rgb))]">
                        {initialsFromName(player.username)}
                      </div>
                      <span className={`font-medium ${isMe ? "text-[rgb(var(--cr-accent-rgb))]" : "text-[var(--cr-fg)]"}`}>
                        {player.username} {isMe && <span className="text-xs opacity-60">(you)</span>}
                      </span>
                    </div>

                    {/* Trophies */}
                    <div className="text-right">
                      <span className="flex items-center justify-end gap-1 font-semibold text-amber-400">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 4h-1V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a4 4 0 0 0 3 3.87A6 6 0 0 0 11 14.9V17H8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-3v-2.1a6 6 0 0 0 4-3.99 4 4 0 0 0 3-3.87V5a1 1 0 0 0-1-1Z"/>
                        </svg>
                        {player.rating.toLocaleString()}
                      </span>
                    </div>

                    {/* Wins */}
                    <div className="text-right text-sm text-emerald-400">{player.wins}</div>

                    {/* Losses */}
                    <div className="text-right text-sm text-red-400">{player.losses}</div>

                    {/* League */}
                    <div className="flex justify-end">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${tierCfg.bg} ${tierCfg.color}`}>
                        {tierCfg.icon} {tierCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top 10 in Your League */}
        {!isUnranked && myLeague && myLeaguePlayers.length > 0 && (
          <div className="mt-8 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
            <div className="border-b border-[var(--cr-border)] px-4 py-3">
              <h2 className="font-semibold text-[var(--cr-fg)]">
                {getTierConfig(myLeague).icon} Top 10 in Your League ({getTierConfig(myLeague).label})
              </h2>
            </div>
            <div className="divide-y divide-[var(--cr-border)]">
              {myLeaguePlayers.map((player, idx) => {
                const tierCfg = getTierConfig(myLeague);
                const isMe = player.id === myUserId;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--cr-bg-tertiary)] ${isMe ? "ring-1 ring-[rgba(var(--cr-accent-rgb),0.3)]" : ""}`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${tierCfg.bg} ${tierCfg.color}`}>
                      {idx + 1}
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--cr-accent-rgb),0.15)] text-xs font-bold text-[rgb(var(--cr-accent-rgb))]">
                      {initialsFromName(player.username)}
                    </div>
                    <div className="flex-1">
                      <span className={`font-medium ${isMe ? "text-[rgb(var(--cr-accent-rgb))]" : "text-[var(--cr-fg)]"}`}>
                        {player.username} {isMe && <span className="text-xs opacity-60">(you)</span>}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 4h-1V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a4 4 0 0 0 3 3.87A6 6 0 0 0 11 14.9V17H8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-3v-2.1a6 6 0 0 0 4-3.99 4 4 0 0 0 3-3.87V5a1 1 0 0 0-1-1Z"/>
                      </svg>
                      {player.rating.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* League Progression Info */}
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--cr-fg-muted)]">
            League Progression
          </h2>
          <div className="grid gap-3 sm:grid-cols-5">
            {leagueTiers.map((tier, i) => {
              const isMyLeague = myLeague === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`relative rounded-lg border p-4 text-center transition-all ${
                    isMyLeague
                      ? `${tier.border} ${tier.bg} ring-2 ${tier.border}`
                      : "border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]"
                  }`}
                >
                  {isMyLeague && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-[rgb(var(--cr-accent-rgb))] px-2 py-0.5 text-[10px] font-bold text-white">
                      YOU
                    </div>
                  )}
                  <div className="text-2xl">{tier.icon}</div>
                  <div className={`mt-1 text-sm font-semibold ${tier.color}`}>{tier.label}</div>
                  <div className="mt-0.5 text-xs text-[var(--cr-fg-muted)]">
                    {tier.minTrophies === 0 ? "0" : tier.minTrophies.toLocaleString()}+ trophies
                  </div>
                  {i < leagueTiers.length - 1 && (
                    <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-[var(--cr-fg-muted)] sm:block">
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
