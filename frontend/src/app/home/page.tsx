"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Flame, Play, Swords, Users } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";
import { useFriendPresence } from "../../lib/use-friend-presence";
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
  const [welcomeName, setWelcomeName] = useState("Coder");

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
      try {
        const res = await fetch("/api/telemetry/summary", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Partial<TelemetrySummary>;
        if (!alive) return;
        setTelemetry((prev) => ({
          activePlayers: typeof json.activePlayers === "number" ? json.activePlayers : prev.activePlayers,
          currentVisits: typeof json.currentVisits === "number" ? json.currentVisits : prev.currentVisits,
          matchesToday: typeof json.matchesToday === "number" ? json.matchesToday : prev.matchesToday,
        }));
      } catch {
        // ignore
      }
    };

    const fetchProgress = async () => {
      try {
        const res = await fetch("/api/profile/progress", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Partial<ProgressSummary>;
        if (!alive) return;
        setProgress((prev) => ({
          solvedProblems: typeof json.solvedProblems === "number" ? json.solvedProblems : prev.solvedProblems,
          totalProblems: typeof json.totalProblems === "number" ? json.totalProblems : prev.totalProblems,
          streakDays: typeof json.streakDays === "number" ? json.streakDays : prev.streakDays,
        }));
      } catch {
        // ignore
      }
    };

    void fetchTelemetry();
    void fetchProgress();

    const fetchWelcomeName = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!alive || error || !data.user) return;

        const fallbackName =
          (data.user.user_metadata?.display_name as string | undefined)?.trim() ||
          (data.user.email ? data.user.email.split("@")[0] : "") ||
          "Coder";

        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("username")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!alive) return;

        if (userError) {
          setWelcomeName(fallbackName);
          return;
        }

        const resolvedName =
          (typeof userRow?.username === "string" ? userRow.username.trim() : "") || fallbackName;

        setWelcomeName(resolvedName);
      } catch {
        // ignore
      }
    };

    void fetchWelcomeName();

    const interval = window.setInterval(fetchTelemetry, 10_000);
    const progressInterval = window.setInterval(fetchProgress, 20_000);

    return () => {
      alive = false;
      window.clearInterval(interval);
      window.clearInterval(progressInterval);
    };
  }, []);

  const solvedDenominator = Math.max(progress.totalProblems, 1);
  const solvedPercent = Math.min(100, Math.round((progress.solvedProblems / solvedDenominator) * 100));
  const streakLabel = `${progress.streakDays} day${progress.streakDays === 1 ? "" : "s"}`;
  const streakPercent = Math.min(100, progress.streakDays * 20);
  const shownFriends = friends.slice(0, 14);

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Matches Today", value: telemetry.matchesToday.toLocaleString() },
    { label: "Online Now", value: telemetry.activePlayers.toLocaleString() },
    { label: "Problems Solved", value: `${progress.solvedProblems}`, hint: `of ${progress.totalProblems}` },
    { label: "Streak", value: streakLabel },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
        {/* Primary action */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary via-muted/50 to-background p-8 shadow-sm ring-1 ring-foreground/10 sm:p-10">
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                Welcome back, {welcomeName}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Ready to battle?
              </h1>
              <p className="mt-2 text-muted-foreground">
                Quick match against a rival. About 10 minutes, ranked.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <LinkButton size="lg" href="/game-modes" className="px-8 py-4 text-base">
                <Swords data-icon="inline-start" />
                Find a Match
              </LinkButton>
              <LinkButton variant="ghost" href="/practice">
                <Play data-icon="inline-start" />
                Practice instead
              </LinkButton>
            </div>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-accent/20 to-transparent" />
        </section>

        {/* Glanceable stats */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="shadow-sm">
              <CardContent className="flex flex-col gap-1">
                <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                  {stat.hint ? ` · ${stat.hint}` : ""}
                </span>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Quick mode shortcuts */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Quick Play</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {battleModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <Card
                  key={mode.title}
                  className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-base font-semibold">{mode.title}</h3>
                    <p className="text-sm text-muted-foreground">{mode.description}</p>
                    <LinkButton
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-fit pl-0 text-accent-foreground hover:bg-transparent hover:underline"
                      href={mode.href}
                    >
                      Play now
                      <ArrowRight data-icon="inline-end" />
                    </LinkButton>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Live friends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span>Online Friends ({friends.length})</span>
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
                      {friend.online && (
                        <span className="absolute -bottom-0.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-emerald-500 ring-2 ring-background" />
                      )}
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
                  { label: "Easy", problems: "20 problems", className: "bg-emerald-500" },
                  { label: "Medium", problems: "35 problems", className: "bg-amber-500" },
                  { label: "Hard", problems: "15 problems", className: "bg-rose-500" },
                ].map((tier) => (
                  <Link
                    key={tier.label}
                    href={`/practice?difficulty=${tier.label.toLowerCase()}`}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm transition-all hover:border-ring hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`size-2 rounded-full ${tier.className}`} />
                      <span className="text-sm font-medium">{tier.label}</span>
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
              <Progress value={streakPercent}>
                <div className="flex w-full items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    {streakLabel}
                    <Flame className="size-4 text-amber-500" />
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
