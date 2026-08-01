"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";
import { useFriendPresence } from "../../lib/use-friend-presence";

const battleModes = [
  {
    title: "Battle Against Bots",
    description: "Solo queue against adaptive AI rivals tuned for practice.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
  },
  {
    title: "1v1 Duels",
    description: "Head-to-head clashes where speed and accuracy crown the champion.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: "4-Player Brawls",
    description: "1v1v1v1 chaos built for squads or rivals.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
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

const statDefinitions: Array<{ label: string; key: keyof TelemetrySummary }> = [
  { label: "Active Players", key: "activePlayers" },
  { label: "Current Visits", key: "currentVisits" },
  { label: "Matches Today", key: "matchesToday" },
];

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

  return (
    <AppShell>
      <div className="flex flex-col gap-8 p-6">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[var(--cr-bg-secondary)] to-[var(--cr-bg-tertiary)] p-8">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl font-bold text-[var(--cr-fg)] md:text-4xl">
              Welcome back, {welcomeName}
            </h1>
            <p className="mt-3 text-[var(--cr-fg-muted)]">
              Ready for your next challenge? Jump into practice mode or queue up for a real-time battle.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/practice"
                className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--cr-accent-rgb))] px-5 py-2.5 text-sm font-semibold text-[var(--cr-bg)] transition-all hover:opacity-90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Practice
              </Link>
              <Link
                href="/game-modes"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--cr-fg)] transition-all hover:bg-[var(--cr-bg-secondary)]"
              >
                Battle Mode
              </Link>
            </div>
          </div>
          {/* Decorative gradient */}
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[rgba(var(--cr-accent-rgb),0.1)] to-transparent" />
        </section>

        <section className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[var(--cr-fg)]">Connections ({friends.length})</h2>
            <Link href="/friends" className="text-sm font-medium text-[var(--cr-fg)] hover:underline">
              See all →
            </Link>
          </div>

          {friendsLoading && (
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="min-w-[90px] text-center">
                  <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-[var(--cr-bg-tertiary)]" />
                  <div className="mx-auto mt-3 h-3 w-16 animate-pulse rounded bg-[var(--cr-bg-tertiary)]" />
                </div>
              ))}
            </div>
          )}

          {!friendsLoading && shownFriends.length === 0 && (
            <div className="mt-4 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-3 text-sm text-[var(--cr-fg-muted)]">
              No friends yet. Add players from the Friends tab to see them here.
            </div>
          )}

          {!friendsLoading && shownFriends.length > 0 && (
            <div className="mt-4 flex gap-5 overflow-x-auto pb-2">
              {shownFriends.map((friend) => (
                <Link key={friend.id} href={`/profile?userId=${friend.id}`} className="group min-w-[96px] text-center">
                  <div className="relative mx-auto h-16 w-16 rounded-full bg-[var(--cr-bg-tertiary)] ring-1 ring-[var(--cr-border)] transition-all group-hover:ring-[rgba(var(--cr-accent-rgb),0.55)]">
                    <span className="flex h-full w-full items-center justify-center text-xl font-bold text-[rgb(var(--cr-accent-rgb))]">
                      {initialsFromName(friend.username)}
                    </span>
                    {friend.online && (
                      <span className="absolute left-1/2 top-full mt-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-emerald-400 ring-2 ring-[var(--cr-bg-secondary)]" />
                    )}
                  </div>
                  <p className="mt-4 truncate text-sm font-medium text-[var(--cr-fg)]">{friend.username}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Stats Row */}
        <section className="grid gap-4 sm:grid-cols-3">
          {statDefinitions.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5"
            >
              <div className="text-2xl font-bold text-[rgb(var(--cr-accent-rgb))]">{telemetry[stat.key]}</div>
              <div className="mt-1 text-sm text-[var(--cr-fg-muted)]">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* Battle Modes */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[var(--cr-fg)]">Battle Modes</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {battleModes.map((mode) => (
              <div
                key={mode.title}
                className="group rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5 transition-all hover:border-[rgba(var(--cr-accent-rgb),0.3)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(var(--cr-accent-rgb),0.1)] text-[rgb(var(--cr-accent-rgb))]">
                  {mode.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--cr-fg)]">{mode.title}</h3>
                <p className="mt-2 text-sm text-[var(--cr-fg-muted)]">{mode.description}</p>
                <Link
                  href="/game-modes"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-[rgb(var(--cr-accent-rgb))] transition-colors hover:underline"
                >
                  Play now
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity / Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Practice */}
          <section className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5">
            <h2 className="mb-4 text-lg font-semibold text-[var(--cr-fg)]">Quick Practice</h2>
            <div className="space-y-3">
              {[
                { label: "Easy", problems: "20 problems", color: "text-emerald-400" },
                { label: "Medium", problems: "35 problems", color: "text-amber-400" },
                { label: "Hard", problems: "15 problems", color: "text-red-400" },
              ].map((tier) => (
                <Link
                  key={tier.label}
                  href={`/practice?difficulty=${tier.label.toLowerCase()}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] p-4 transition-all hover:border-[rgba(var(--cr-accent-rgb),0.3)]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${tier.color}`}>{tier.label}</span>
                    <span className="text-xs text-[var(--cr-fg-muted)]">{tier.problems}</span>
                  </div>
                  <svg className="h-5 w-5 text-[var(--cr-fg-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>

          {/* Your Progress */}
          <section className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5">
            <h2 className="mb-4 text-lg font-semibold text-[var(--cr-fg)]">Your Progress</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-[var(--cr-fg-muted)]">Problems Solved</span>
                  <span className="text-[var(--cr-fg)]">{progress.solvedProblems} / {progress.totalProblems}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--cr-bg-tertiary)]">
                  <div className="h-full rounded-full bg-[rgb(var(--cr-accent-rgb))]" style={{ width: `${solvedPercent}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-[var(--cr-fg-muted)]">Current Streak</span>
                  <span className="text-[var(--cr-fg)]">{streakLabel} <svg className="inline h-4 w-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 23c-4.97 0-8-3.58-8-8 0-4.42 4-8.28 6-10 .55.77 1.39 2 2 3 .61-1.17 1.45-2.66 2-3.5C16.13 3.16 20 7.03 20 11c0 3.31-1.69 5.25-3 6.5.93.83 1.73 2.02 2 3.5.24 1.17-.12 1.76-1 2C17.91 23.67 15.11 23 12 23z"/></svg></span>
                </div>
                <div className="h-2 rounded-full bg-[var(--cr-bg-tertiary)]">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${streakPercent}%` }} />
                </div>
              </div>
              <div className="pt-2">
                <Link
                  href="/profile"
                  className="text-sm text-[rgb(var(--cr-accent-rgb))] hover:underline"
                >
                  View full profile →
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Featured Image */}
        <section className="relative overflow-hidden rounded-xl">
          <div className="relative h-48 w-full md:h-64">
            <Image
              src="/images/bluebracket.jpg"
              alt="Code battle interface"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--cr-bg)]/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--cr-accent-rgb))]">
                Live Tournaments
              </p>
              <h3 className="mt-1 text-xl font-bold text-[var(--cr-fg)]">
                Weekly Code Championship
              </h3>
              <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">
                Join 500+ players competing for the top spot
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
