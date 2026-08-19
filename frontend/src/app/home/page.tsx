"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Flame, Swords, Users } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { useFriendPresence } from "../../lib/use-friend-presence";
import { cachedFetch } from "../../lib/cached-fetch";
import { getFreshCachedProfile, subscribeProfileCache } from "../../lib/user-profile-cache";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const battleModes = [
  {
    title: "Bot Battle",
    description: "Race an AI rival. Choose your difficulty.",
    href: "/bot-battle",
    icon: Bot,
  },
  {
    title: "1v1 Duel",
    description: "Head-to-head. Speed and accuracy win.",
    href: "/game-modes",
    icon: Swords,
  },
  {
    title: "4-Player Brawl",
    description: "Chaos with friends. Last solver standing.",
    href: "/game-modes",
    icon: Users,
  },
];

type TelemetrySummary = {
  activePlayers: number;
  currentVisits: number;
  matchesToday: number;
};

type ProgressSummary = {
  solvedProblems: number;
  totalProblems: number;
  streakDays: number;
};

function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "CR";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "C";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? "R"}`.toUpperCase();
}

export default function HomePage() {
  const { friends, loading: friendsLoading } = useFriendPresence();
  // Read the cached identity synchronously on the client — the greeting never
  // flashes an empty "Coder" on refresh (app-shell keeps the cache fresh).
  const welcomeName = useSyncExternalStore(
    subscribeProfileCache,
    () => getFreshCachedProfile()?.username ?? "Coder",
    () => "Coder",
  );

  const [telemetry, setTelemetry] = useState<TelemetrySummary>({
    activePlayers: 0,
    currentVisits: 0,
    matchesToday: 0,
  });
  const [progress, setProgress] = useState<ProgressSummary>({
    solvedProblems: 0,
    totalProblems: 0,
    streakDays: 0,
  });

  useEffect(() => {
    let alive = true;

    const fetchTelemetry = async () => {
      const json = await cachedFetch<Partial<TelemetrySummary>>("/api/telemetry/summary", {
        ttlMs: 60_000,
      });
      if (!alive || !json) return;
      setTelemetry((prev) => ({
        activePlayers: typeof json.activePlayers === "number" ? json.activePlayers : prev.activePlayers,
        currentVisits: typeof json.currentVisits === "number" ? json.currentVisits : prev.currentVisits,
        matchesToday: typeof json.matchesToday === "number" ? json.matchesToday : prev.matchesToday,
      }));
    };

    const fetchProgress = async () => {
      const json = await cachedFetch<Partial<ProgressSummary>>("/api/profile/progress", {
        ttlMs: 120_000,
      });
      if (!alive || !json) return;
      setProgress((prev) => ({
        solvedProblems: typeof json.solvedProblems === "number" ? json.solvedProblems : prev.solvedProblems,
        totalProblems: typeof json.totalProblems === "number" ? json.totalProblems : prev.totalProblems,
        streakDays: typeof json.streakDays === "number" ? json.streakDays : prev.streakDays,
      }));
    };

    void fetchTelemetry();
    void fetchProgress();

    const interval = window.setInterval(fetchTelemetry, 30_000);
    const progressInterval = window.setInterval(fetchProgress, 60_000);

    return () => {
      alive = false;
      window.clearInterval(interval);
      window.clearInterval(progressInterval);
    };
  }, []);

  const solvedDenominator = Math.max(progress.totalProblems, 1);
  const solvedPercent = Math.min(100, Math.round((progress.solvedProblems / solvedDenominator) * 100));
  const shownFriends = friends.slice(0, 14);

  return (
    <AppShell>
      <div className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
        {/* Primary action */}
        <section className="sheet-deploy sheet relative overflow-hidden rounded-xl bg-card p-8 shadow-md ring-1 ring-black/8 dark:ring-white/10 sm:p-10">
          <div aria-hidden="true" className="parallelogram absolute -top-px right-8 hidden h-1 w-24 bg-primary sm:block" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">

                Ready to battle {welcomeName}?
              </h1>
            </div>
            <div className="flex flex-col items-start md:items-end">
              <LinkButton size="lg" href="/game-modes" className="px-8 py-4 text-base">
                <Swords data-icon="inline-start" />
                Find a Match
              </LinkButton>
            </div>
          </div>
          <div className="relative z-10 mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
              <Swords className="size-3.5" />
              <span className="font-mono">{telemetry.matchesToday.toLocaleString()}</span> matches today
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
              <Users className="size-3.5" />
              <span className="font-mono">{telemetry.activePlayers.toLocaleString()}</span> online now
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
              <CheckCircle2 className="size-3.5" />
              <span className="font-mono">
                {progress.solvedProblems}/{progress.totalProblems}
              </span>{" "}
              problems solved
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-primary">
              <Flame className="size-3.5" />
              {progress.streakDays} day streak
            </span>
          </div>
        </section>

        {/* Quick mode shortcuts */}
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">Quick Play</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {battleModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <Card
                  key={mode.title}
                  className="group h-fit transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Link
                    href={mode.href}
                    className="flex items-center gap-2.5 py-2 pl-3 pr-3.5"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                      <Icon className="size-4" />
                    </div>
                    <h3 className="min-w-0 flex-1 truncate text-lg font-semibold">
                      {mode.title}
                    </h3>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Live friends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Friends ({friends.length})</span>
              <LinkButton variant="ghost" size="sm" href="/friends">
                See all
                <ArrowRight data-icon="inline-end" />
              </LinkButton>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friendsLoading && (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="min-w-[90px] text-center">
                    <Skeleton className="mx-auto size-16 rounded-full" />
                    <Skeleton className="mx-auto mt-3 h-3 w-16" />
                  </div>
                ))}
              </div>
            )}

            {!friendsLoading && shownFriends.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                No friends yet. Add players from the Friends tab to see them here.
              </div>
            )}

            {!friendsLoading && shownFriends.length > 0 && (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {shownFriends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile?userId=${friend.id}`}
                    className="group min-w-[96px] text-center"
                  >
                    <div className="relative mx-auto size-16">
                      <Avatar className="size-16 ring-1 ring-foreground/10 transition group-hover:ring-2 group-hover:ring-ring">
                        <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                          {initialsFromName(friend.username)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <p className="mt-3 truncate text-sm font-medium">{friend.username}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent results + progress */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Results</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Your match history shows up here after your first battle.
                </p>
                <LinkButton variant="link" href="/game-modes" className="mt-2">
                  Start your first match
                  <ArrowRight data-icon="inline-end" />
                </LinkButton>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Easy", problems: "20 problems", textClass: "text-[var(--chart-3)]" },
                  { label: "Medium", problems: "35 problems", textClass: "text-[var(--chart-1)]" },
                  { label: "Hard", problems: "15 problems", textClass: "text-[var(--chart-4)]" },
                ].map((tier) => (
                  <Link
                    key={tier.label}
                    href={`/practice?difficulty=${tier.label.toLowerCase()}`}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm transition-all hover:border-ring hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${tier.textClass}`}>{tier.label}</span>
                      <span className="text-xs text-muted-foreground">{tier.problems}</span>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Progress value={solvedPercent}>
                <div className="flex w-full items-center justify-between text-sm">
                  <span className="text-muted-foreground">Problems Solved</span>
                  <span className="font-medium">
                    {progress.solvedProblems} / {progress.totalProblems}
                  </span>
                </div>
              </Progress>
              <Badge variant="outline" className="w-fit">
                {solvedPercent}% of the problem library
              </Badge>
              <div className="pt-1">
                <LinkButton variant="ghost" size="sm" className="h-auto p-0 text-accent-foreground hover:bg-transparent hover:underline" href="/profile">
                  View full profile
                  <ArrowRight data-icon="inline-end" />
                </LinkButton>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
