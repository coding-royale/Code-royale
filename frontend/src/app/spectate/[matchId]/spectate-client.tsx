"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Eye, Swords, Trophy } from "lucide-react";
import { TetrioBattleBackground } from "@/components/battle/tetrio-battle-background";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type SpectateSnapshot = {
  matchId: string;
  mode: string;
  status: "live" | "finished";
  question: { title: string; description: string; difficulty: string } | null;
  players: Array<{ id: string; username: string; rating: number; isWinner: boolean }>;
  timeLimitSeconds: number;
  startedAt: string;
  winnerUsername: string | null;
};

function formatDuration(seconds: number) {
  const mins = Math.floor(Math.max(seconds, 0) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (Math.max(seconds, 0) % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "CR";
  return trimmed.slice(0, 2).toUpperCase();
}

export function SpectateClient({ initial }: { initial: SpectateSnapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (snapshot.status === "finished") return;
    const clock = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, [snapshot.status]);

  useEffect(() => {
    if (snapshot.status === "finished") return;
    let alive = true;
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/spectate/${snapshot.matchId}`);
        if (!alive || !res.ok) return;
        const data = (await res.json()) as SpectateSnapshot;
        setSnapshot(data);
        if (data.status === "finished") window.clearInterval(interval);
      } catch {
        // ignore transient errors
      }
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [snapshot.matchId, snapshot.status]);

  const secondsLeft = useMemo(() => {
    const started = Date.parse(snapshot.startedAt);
    if (!Number.isFinite(started)) return snapshot.timeLimitSeconds;
    // nowTick re-renders every second so the countdown stays live.
    const elapsed = Math.floor((nowTick - started) / 1000);
    return Math.max(snapshot.timeLimitSeconds - elapsed, 0);
  }, [snapshot.startedAt, snapshot.timeLimitSeconds, nowTick]);

  const [left, right] = [snapshot.players[0], snapshot.players[1]];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <TetrioBattleBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Eye className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                Spectating · {snapshot.mode}
              </p>
              <h1 className="font-heading text-xl font-bold uppercase tracking-wider">
                {snapshot.question?.title ?? "Live match"}
              </h1>
            </div>
            {snapshot.question && (
              <Badge variant="outline" className="uppercase tracking-wider">
                {snapshot.question.difficulty}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-5 py-2.5">
              <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                {snapshot.status === "live" ? "Left" : "Over"}
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums">
                {snapshot.status === "live" ? formatDuration(secondsLeft) : "—"}
              </span>
            </div>
            <Button type="button" variant="outline" onClick={() => router.push("/home")}>
              Leave
            </Button>
          </div>
        </header>

        <Card>
          <CardContent className="flex items-center justify-center gap-6 p-6 sm:gap-10">
            {left && (
              <div className="flex flex-col items-center gap-2 text-center">
                <Avatar className={`size-14 border-2 text-lg font-bold ${left.isWinner ? "border-emerald-500/60" : ""}`}>
                  <AvatarFallback>{initials(left.username)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold">{left.username}</p>
                <p className="font-mono text-xs text-muted-foreground">{left.rating} rating</p>
              </div>
            )}
            <span className="text-2xl font-black uppercase text-primary">VS</span>
            {right && (
              <div className="flex flex-col items-center gap-2 text-center">
                <Avatar className={`size-14 border-2 text-lg font-bold ${right.isWinner ? "border-emerald-500/60" : ""}`}>
                  <AvatarFallback>{initials(right.username)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold">{right.username}</p>
                <p className="font-mono text-xs text-muted-foreground">{right.rating} rating</p>
              </div>
            )}
          </CardContent>
        </Card>

        {snapshot.status === "finished" ? (
          <Card className="ring-emerald-500/20">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <Trophy className="size-10 text-emerald-500" />
              <h2 className="text-2xl font-bold uppercase tracking-wider">Match over</h2>
              <p className="text-sm text-muted-foreground">
                {snapshot.winnerUsername ? `${snapshot.winnerUsername} takes the duel.` : "Nobody solved it in time."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Swords className="size-5 shrink-0 text-primary" />
              Live now — both players are solving. You will see the result here the moment someone submits.
            </CardContent>
          </Card>
        )}

        {snapshot.question && (
          <Card>
            <CardContent className="prose-sm p-6">
              <h2 className="mb-3 text-lg font-bold">Problem</h2>
              {snapshot.question.description
                .replace(/\\n/g, "\n")
                .split(/\n\n+/)
                .map((p, i) => (
                  <p key={i} className="mb-3 text-sm leading-relaxed text-foreground/80">
                    {p}
                  </p>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
