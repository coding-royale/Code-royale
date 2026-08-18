"use client";

import { useState, useMemo, useEffect } from "react";
import { Trophy } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/* ── League tier config ─────────────────────────────────── */
type League = "bronze" | "silver" | "gold" | "platinum" | "diamond";

const leagueTiers: {
  id: League;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  minTrophies: number;
}[] = [
  { id: "bronze",   label: "Bronze",   color: "text-amber-700 dark:text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-700/40",   icon: <Trophy className="size-4" />, minTrophies: 0 },
  { id: "silver",   label: "Silver",   color: "text-slate-400",   bg: "bg-slate-500/15",   border: "border-slate-400/40",   icon: <Trophy className="size-4" />, minTrophies: 1000 },
  { id: "gold",     label: "Gold",     color: "text-amber-400",   bg: "bg-amber-500/20",   border: "border-amber-400/40",   icon: <Trophy className="size-4" />, minTrophies: 2500 },
  { id: "platinum", label: "Platinum", color: "text-cyan-300",    bg: "bg-cyan-500/15",    border: "border-cyan-400/40",    icon: <Trophy className="size-4" />, minTrophies: 5000 },
  { id: "diamond",  label: "Diamond",  color: "text-violet-300",  bg: "bg-violet-500/15",  border: "border-violet-400/40",  icon: <Trophy className="size-4" />, minTrophies: 10000 },
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

  const rankBadgeClass = (rank: number) =>
    rank === 1
      ? "bg-amber-500/20 text-amber-500"
      : rank === 2
        ? "bg-slate-400/20 text-slate-300 dark:text-slate-400"
        : rank === 3
          ? "bg-orange-500/20 text-orange-500"
          : "bg-muted text-muted-foreground";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Leaderboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Compete, climb ranks, and dominate the leagues
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-card px-4 py-2 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">
              {realTimeCount} player{realTimeCount !== 1 ? "s" : ""} ranked
            </span>
          </div>
        </div>

        {/* Your Rank Card */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 bg-accent text-accent-foreground">
                <AvatarFallback className="text-lg font-bold">{myUserId ? "You" : "?"}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm text-muted-foreground">Your Status</div>
                {isUnranked ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">Unranked</span>
                    <Badge variant="secondary">Play a match to get ranked!</Badge>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-foreground">
                      {myRating.toLocaleString()} Trophies
                    </span>
                    {myLeague && (
                      <Badge
                        variant="secondary"
                        className={cn(getTierConfig(myLeague).bg, getTierConfig(myLeague).color)}
                      >
                        {getTierConfig(myLeague).icon} {getTierConfig(myLeague).label}
                      </Badge>
                    )}
                    {myRank && (
                      <Badge variant="secondary" className="text-muted-foreground">
                        Rank #{myRank}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* W/L */}
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{myWins}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
              <div>
                <div className="text-lg font-bold text-destructive">{myLosses}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{myWins + myLosses}</div>
                <div className="text-xs text-muted-foreground">Played</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* League Tiers */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Leagues
          </h2>
          <Tabs
            value={selectedLeague}
            onValueChange={(value) => setSelectedLeague(value as League | "all")}
          >
            <TabsList variant="line" className="h-auto flex-wrap justify-start gap-1 rounded-lg bg-transparent p-0">
              <TabsTrigger
                value="all"
                className={cn(
                  "rounded-lg border border-transparent px-3 py-2",
                  selectedLeague === "all" && "border-border bg-card text-foreground shadow-sm"
                )}
              >
                All Leagues
              </TabsTrigger>
              {leagueTiers.map((tier) => (
                <TabsTrigger
                  key={tier.id}
                  value={tier.id}
                  className={cn(
                    "rounded-lg border border-transparent px-3 py-2",
                    selectedLeague === tier.id && cn(tier.border, tier.bg, tier.color, "border shadow-sm")
                  )}
                >
                  {tier.icon} {tier.label}
                  <span className="ml-1 opacity-60">({tier.minTrophies.toLocaleString()}+)</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Leaderboard Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedLeague === "all"
                ? "Global Leaderboard"
                : `${getTierConfig(selectedLeague as League).icon} ${getTierConfig(selectedLeague as League).label} League`}
            </CardTitle>
          </CardHeader>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Trophies</TableHead>
                <TableHead className="text-right">W</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">League</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="size-7 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : sortedPlayers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    {selectedLeague === "all"
                      ? "No players yet. Be the first to compete!"
                      : "No players in this league yet"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedPlayers.map((player, idx) => {
                  const league = getLeague(player.rating);
                  const tierCfg = getTierConfig(league);
                  const rank = idx + 1;
                  const isMe = player.id === myUserId;
                  return (
                    <TableRow key={player.id} className={cn(isMe && "bg-accent/40")}>
                      <TableCell>
                        <span className={cn(
                          "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                          rankBadgeClass(rank)
                        )}>
                          {rank}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 bg-accent text-accent-foreground">
                            <AvatarFallback className="text-xs font-bold">
                              {initialsFromName(player.username)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn("font-medium", isMe && "text-primary")}>
                            {player.username} {isMe && <span className="text-xs opacity-60">(you)</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                          <Trophy className="size-3.5" />
                          {player.rating.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400">
                        {player.wins}
                      </TableCell>
                      <TableCell className="text-right text-sm text-destructive">
                        {player.losses}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className={cn(tierCfg.bg, tierCfg.color)}>
                          {tierCfg.icon} {tierCfg.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Top 10 in Your League */}
        {!isUnranked && myLeague && myLeaguePlayers.length > 0 && (
          <Card className="mt-8 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getTierConfig(myLeague).icon} Top 10 in Your League ({getTierConfig(myLeague).label})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {myLeaguePlayers.map((player, idx) => {
                const tierCfg = getTierConfig(myLeague);
                const isMe = player.id === myUserId;
                return (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-accent/50",
                      isMe && "bg-accent/40"
                    )}
                  >
                    <span className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                      tierCfg.bg,
                      tierCfg.color
                    )}>
                      {idx + 1}
                    </span>
                    <Avatar className="size-9 bg-accent text-accent-foreground">
                      <AvatarFallback className="text-xs font-bold">
                        {initialsFromName(player.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className={cn("font-medium", isMe && "text-primary")}>
                        {player.username} {isMe && <span className="text-xs opacity-60">(you)</span>}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-500">
                      <Trophy className="size-3.5" />
                      {player.rating.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* League Progression Info */}
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            League Progression
          </h2>
          <div className="grid gap-3 sm:grid-cols-5">
            {leagueTiers.map((tier, i) => {
              const isMyLeague = myLeague === tier.id;
              return (
                <div
                  key={tier.id}
                  className={cn(
                    "relative rounded-xl border p-4 text-center shadow-sm transition-all hover:shadow-md",
                    isMyLeague
                      ? cn(tier.border, tier.bg, "ring-2")
                      : "border-border bg-card"
                  )}
                >
                  {isMyLeague && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary-plate px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      YOU
                    </div>
                  )}
                  <div className="text-2xl">{tier.icon}</div>
                  <div className={cn("mt-1 text-sm font-semibold", tier.color)}>{tier.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {tier.minTrophies === 0 ? "0" : tier.minTrophies.toLocaleString()}+ trophies
                  </div>
                  {i < leagueTiers.length - 1 && (
                    <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-muted-foreground sm:block">
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
