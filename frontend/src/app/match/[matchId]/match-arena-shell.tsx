"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  Eye,
  Loader2,
  LogOut,
  Trophy,
  X,
} from "lucide-react";
import { TetrioBattleBackground } from "@/components/battle/tetrio-battle-background";
import { MaskedOpponentEditor } from "@/components/battle/masked-opponent-editor";
import { BrickBreaker } from "@/components/battle/brick-breaker";
import { CodeEditor } from "@/components/code-editor";
import { buildTemplate, languageLabels, normalizeLanguage } from "@/lib/code-templates";
import { formatRatingDelta } from "@/lib/match-activity";
import {
  describeOpponentActivity,
  formatClock,
  isMatchCommitted,
  opponentStateLabels,
  resolveOpponentState,
  shouldForfeitOnUnload,
} from "@/lib/match-room";
import { useMatchRoom, type MatchPlayerState } from "@/lib/use-match-room";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PracticeTestcase = {
  id: string;
  input: string;
  output: string;
};

type MatchArenaShellProps = {
  matchId: string;
  question: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    languages: string[];
    meta?: {
      timeComplexity?: string | null;
      spaceComplexity?: string | null;
      topics?: string[] | null;
    } | null;
  };
  testcases: PracticeTestcase[];
  /** Shared start instant from the server. Null while the room is filling. */
  startedAt: string | null;
  timeLimitSeconds: number;
  initialLanguage: string;
  exitHref?: string;
  /** Match shape: "1v1" | "2v2" | "ffa". Not the ranked/unranked flag. */
  matchType?: string;
  /** From the `matches.mode` column: this is what decides ELO swings. */
  isRanked?: boolean;
};

type SubmissionIntent = "run" | "submit";

type SubmissionResult = {
  index: number;
  status: string;
  actual: string;
  stderr: string | null;
  time: string | null;
  memory: number | null;
  passed: boolean;
  expected: string;
  input: string;
};

type Outcome = "won" | "lost" | "draw";

const modeLabels: Record<string, string> = {
  ranked: "Ranked 1v1",
  unranked: "1v1",
  friend: "1v1 Friend",
  "friends-2v2": "2v2",
  duos: "2v2",
  ffa: "FFA",
  "battle-royale": "4 Player",
  "rapid-fire": "Rapid Fire",
};

const emptyAttempts = {
  attempts: 0,
  bestPassed: 0,
  bestTotal: 0,
  lastActiveAt: null as string | null,
};

function initialsOf(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`.toUpperCase();
}

export function MatchArenaShell({
  matchId,
  question,
  testcases,
  startedAt,
  timeLimitSeconds,
  initialLanguage,
  exitHref = "/game-modes",
  matchType = "1v1",
  isRanked = false,
}: MatchArenaShellProps) {
  const router = useRouter();
  const normalizedInitialLanguage = normalizeLanguage(initialLanguage);
  const availableLanguages = useMemo(
    () => question.languages.map((lang) => normalizeLanguage(lang)),
    [question.languages],
  );
  const safeTestcases =
    testcases.length > 0
      ? testcases
      : [{ id: `${question.id}-fallback`, input: "", output: "" }];

  const [language, setLanguage] = useState(normalizedInitialLanguage);
  const [code, setCode] = useState(() =>
    buildTemplate(normalizedInitialLanguage, question.title),
  );
  const [results, setResults] = useState<SubmissionResult[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info" | null>(null);
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [showForfeit, setShowForfeit] = useState(false);
  const [showOpponent, setShowOpponent] = useState(false);
  const [sidePanel, setSidePanel] = useState<"problem" | "opponent">("problem");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const timeoutHandledRef = useRef(false);
  const forfeitSentRef = useRef(false);

  const { room, connected, sync, leaveRoom } = useMatchRoom(matchId, {
    startedAt,
    timeLimitSeconds,
  });

  const you = useMemo(
    () => room.players.find((player) => player.isYou) ?? null,
    [room.players],
  );
  const opponent = useMemo(
    () => room.players.find((player) => !player.isYou) ?? null,
    [room.players],
  );

  const decided = room.completedAt !== null || room.winnerId !== null;
  const isLive = room.phase === "live";
  // Once the shared start instant is written the duel is committed, countdown
  // included, so leaving must cost the match at any point from there on.
  const committed = isMatchCommitted(room.phase);
  const canPlay = isLive && !decided && !leaving;

  const outcome: Outcome | null = useMemo(() => {
    if (!decided) return null;
    if (!room.winnerId) return "draw";
    if (you && room.winnerId === you.userId) return "won";
    return "lost";
  }, [decided, room.winnerId, you]);

  // Refs mirror the live values so the unload listeners never act on stale state.
  const liveRef = useRef({ phase: room.phase, decided, leaving });
  liveRef.current = { phase: room.phase, decided, leaving };

  useEffect(() => {
    setResults(null);
    setFeedback(null);
    setFeedbackTone(null);
  }, [language]);

  useEffect(() => {
    if (activeTestcaseIndex >= safeTestcases.length) {
      setActiveTestcaseIndex(Math.max(safeTestcases.length - 1, 0));
    }
  }, [safeTestcases.length, activeTestcaseIndex]);

  /*
   * Walking out of a live duel is a forfeit, never a win.
   *
   * `pagehide` covers every real exit (link click, back button, tab close,
   * reload) and is the one lifecycle event that still gets to fire a request
   * during unload, so it uses sendBeacon. Previously leaving did nothing at
   * all, which meant an abandoned match could still be resolved as a win by
   * the timeout path.
   */
  useEffect(() => {
    if (!matchId) return;

    const fire = () => {
      const { phase, decided: isDecided, leaving: isLeaving } = liveRef.current;
      // An intentional forfeit already marked the match; do not double-send.
      if (isLeaving) return;
      if (
        !shouldForfeitOnUnload({
          phase,
          decided: isDecided,
          alreadySent: forfeitSentRef.current,
        })
      ) {
        return;
      }
      forfeitSentRef.current = true;
      const body = new Blob([JSON.stringify({ matchId, reason: "left" })], {
        type: "application/json",
      });
      navigator.sendBeacon?.("/api/match/forfeit", body);
    };

    window.addEventListener("pagehide", fire);
    return () => window.removeEventListener("pagehide", fire);
  }, [matchId]);

  // Time up: let the server decide, then pick the result up on the next poll.
  useEffect(() => {
    if (!isLive || decided || room.remainingSeconds > 0 || timeoutHandledRef.current) return;
    timeoutHandledRef.current = true;
    void (async () => {
      try {
        await fetch("/api/match/timeout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
          keepalive: true,
        });
      } catch {
        // The poll will retry the resolution on its own.
      }
      await sync();
    })();
  }, [isLive, decided, room.remainingSeconds, matchId, sync]);

  const submitForfeit = useCallback(
    async (reason: "left" | "surrender") => {
      if (forfeitSentRef.current) return;
      forfeitSentRef.current = true;
      setLeaving(true);
      setShowForfeit(false);
      try {
        await fetch("/api/match/forfeit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, reason }),
          keepalive: true,
        });
      } catch {
        // ignore — the opponent still sees the clock run out
      }
      router.push(exitHref);
    },
    [matchId, router, exitHref],
  );

  const abandonRoom = useCallback(async () => {
    setLeaving(true);
    await leaveRoom();
    router.push(exitHref);
  }, [leaveRoom, router, exitHref]);

  /*
   * A room that timed out empty releases itself.
   *
   * The "opponent never showed up" card used to sit there holding the seat
   * until the player clicked through, so the dead lobby stayed in the table and
   * could be handed back by a later status poll. Releasing it the moment it is
   * known to be abandoned keeps a corpse out of the next queue.
   */
  const abandoned = room.lobbyReason === "abandoned";
  useEffect(() => {
    if (!abandoned) return;
    void leaveRoom();
  }, [abandoned, leaveRoom]);

  const handleSubmit = useCallback(
    async (intent: SubmissionIntent) => {
      if (!canPlay) return;
      if (!code.trim()) {
        setFeedback("Write some code before running your solution.");
        setFeedbackTone("info");
        return;
      }

      setIsSubmitting(true);
      setFeedback(null);
      setFeedbackTone(null);
      setResults(null);

      try {
        const response = await fetch("/api/practice/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: question.id,
            language,
            code,
            intent,
            matchId,
          }),
        });

        if (!response.ok) {
          const data = await response
            .json()
            .catch(() => ({ error: "Submission failed." }));
          setFeedback(
            [data.detail, data.error].filter(Boolean).join(" — ") ?? "Submission failed.",
          );
          setFeedbackTone("error");
          return;
        }

        const payload = (await response.json()) as {
          passed: boolean;
          results: SubmissionResult[];
        };

        setResults(payload.results);

        if (payload.passed) {
          if (intent === "submit") {
            // Declare the win server-side; the poll confirms who it landed on.
            try {
              await fetch("/api/match/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId }),
              });
            } catch {
              // ignore — the timeout path still resolves it
            }
            await sync();
          }
          setFeedback(
            intent === "submit" ? "Correct! Claiming the win…" : "All test cases passed.",
          );
          setFeedbackTone("success");
        } else {
          setFeedback(intent === "submit" ? "Not yet. Try again!" : "Some test cases failed.");
          setFeedbackTone("error");
        }
      } catch {
        setFeedback("Couldn't run your code. Please try again.");
        setFeedbackTone("error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [canPlay, code, language, question.id, matchId, sync],
  );

  // Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits. Plain Enter never does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      event.preventDefault();
      void handleSubmit(event.shiftKey ? "submit" : "run");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  // The mode column decides the ladder, the type decides the shape. Labelling
  // the header from the type alone made every duel read as a plain "1v1" and
  // hid the rating swing on the result card.
  const typeLabel = modeLabels[matchType] ?? matchType.toUpperCase();
  const modeLabel = isRanked ? `Ranked ${typeLabel}` : typeLabel;
  const timeComplexity = question.meta?.timeComplexity ?? "TBD";
  const spaceComplexity = question.meta?.spaceComplexity ?? "TBD";
  const topics = Array.isArray(question.meta?.topics)
    ? (question.meta?.topics ?? []).filter(Boolean)
    : [];

  const resultsMap = useMemo(() => {
    if (!results) return new Map<number, SubmissionResult>();
    return new Map(results.map((r) => [r.index, r]));
  }, [results]);

  const activeResult = resultsMap.get(activeTestcaseIndex);
  const activeTestcase = safeTestcases[activeTestcaseIndex];

  const statusForIndex = (index: number) => {
    const resolved = resultsMap.get(index);
    if (resolved) return resolved.passed ? "passed" : "failed";
    if (results && !resolved) return "pending";
    return "idle";
  };

  const mySummary = you
    ? {
        attempts: you.attempts,
        bestPassed: you.bestPassed,
        bestTotal: you.bestTotal,
        lastActiveAt: you.lastActiveAt,
        solved: you.solved,
      }
    : { ...emptyAttempts, solved: false };
  const theirSummary = opponent
    ? {
        attempts: opponent.attempts,
        bestPassed: opponent.bestPassed,
        bestTotal: opponent.bestTotal,
        lastActiveAt: opponent.lastActiveAt,
        solved: opponent.solved,
      }
    : { ...emptyAttempts, solved: false };

  const opponentName = opponent?.username ?? "Opponent";
  const opponentState = resolveOpponentState(theirSummary);
  const opponentLine = describeOpponentActivity(theirSummary);

  const timerTone =
    room.remainingSeconds <= 30
      ? "text-destructive"
      : room.remainingSeconds <= 60
        ? "text-primary"
        : "text-foreground";

  const clockText =
    room.phase === "lobby"
      ? "--:--"
      : room.phase === "countdown"
        ? formatClock(room.countdownSeconds)
        : formatClock(room.remainingSeconds);

  const ratingDelta = room.ratingDelta;
  const myDelta =
    outcome === "won" && ratingDelta
      ? ratingDelta.winner
      : outcome === "lost" && ratingDelta
        ? ratingDelta.loser
        : 0;

  if (room.phase === "lobby") {
    return (
      <WaitingRoom
        modeLabel={modeLabel}
        questionTitle={question.title}
        opponentName={opponentName}
        opponentPresent={room.playersPresent >= 2}
        abandoned={abandoned}
        connected={connected}
        leaving={leaving}
        onAbandon={abandonRoom}
        exitHref={exitHref}
      />
    );
  }

  return (
    <div className="pointer-events-none relative flex h-dvh flex-col overflow-hidden bg-background text-foreground select-none">
      <TetrioBattleBackground />

      <header className="pointer-events-none relative z-20 flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
            {modeLabel}
          </span>
          <h1 className="truncate font-heading text-lg font-bold uppercase tracking-wider sm:text-xl">
            {question.title}
          </h1>
        </div>

        <Badge variant="outline" className="hidden uppercase tracking-wider sm:inline-flex">
          {question.difficulty}
        </Badge>

        {/* Below lg the side panel is a drawer, so the statement stays reachable. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open problem statement"
          className="pointer-events-auto lg:hidden"
        >
          <BookOpen className="size-4" />
          Problem
        </Button>

        {/* The opponent is always one click away, with their live numbers on it. */}
        <button
          type="button"
          onClick={() => setShowOpponent(true)}
          aria-label={`Opponent status: ${opponentStateLabels[opponentState]}. ${opponentLine}. Open details.`}
          className="pointer-events-auto group order-last flex min-w-0 items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/70 sm:order-none sm:ml-auto"
        >
          <Avatar className="size-9 border-2 border-red-500/40 bg-red-500/15">
            <AvatarFallback className="bg-transparent text-xs font-bold text-red-500">
              {initialsOf(opponentName)}
            </AvatarFallback>
            <span
              className={`absolute -right-0.5 -bottom-0.5 z-10 size-2.5 rounded-full ring-2 ring-background ${
                opponent?.solved
                  ? "bg-emerald-500"
                  : opponentState === "testing"
                    ? "animate-pulse bg-amber-500"
                    : "bg-muted-foreground/50"
              }`}
            />
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold uppercase tracking-wider">
              {opponentName}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {opponentStateLabels[opponentState]} · {opponentLine}
            </span>
          </span>
          <Eye className="size-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
        </button>

        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Time
          </span>
          <span className={`font-mono text-2xl font-bold tabular-nums ${timerTone}`}>
            {clockText}
          </span>
        </div>

        {/* The only exit in the arena. */}
        <Button
          type="button"
          variant="outline"
          disabled={!committed || decided || leaving}
          onClick={() => setShowForfeit(true)}
          className="pointer-events-auto border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Forfeit
        </Button>
      </header>

      <div className="pointer-events-none relative z-10 flex min-h-0 flex-1">
        {/*
          Side panel: a permanent column on wide screens, an explicit drawer on
          narrow ones. It is never opened by a stray click on the background —
          only by its own tab, its own header button, or its own close button.
        */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close problem statement"
            onClick={() => setDrawerOpen(false)}
            className="pointer-events-auto fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}

        <aside
          className={`pointer-events-auto flex w-[19rem] shrink-0 flex-col border-r bg-muted/20 backdrop-blur-sm ${
            drawerOpen
              ? "fixed inset-y-0 left-0 z-40"
              : "pointer-events-none fixed inset-y-0 left-0 z-40 -translate-x-full"
          } lg:pointer-events-auto lg:static lg:z-auto lg:translate-x-0`}
        >
          <div className="flex items-center gap-1 border-b p-2">
            <PanelTab active={sidePanel === "problem"} onClick={() => setSidePanel("problem")}>
              <BookOpen className="size-3" />
              Problem
            </PanelTab>
            <PanelTab active={sidePanel === "opponent"} onClick={() => setSidePanel("opponent")}>
              <Eye className="size-3" />
              Opponent
            </PanelTab>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close panel"
              className="ml-auto lg:hidden"
            >
              <X className="size-4" />
            </Button>
          </div>

          {sidePanel === "problem" ? (
            <div className="min-h-0 flex-1 select-text overflow-y-auto p-4 text-sm leading-relaxed text-foreground/80">
              {question.description.replace(/\\n/g, "\n").split(/\n\n+/).map((p, i) => (
                <p key={i} className="mb-3">
                  {p}
                </p>
              ))}

              <div className="mt-5 rounded-xl border bg-card/60 p-4 shadow-sm">
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Test Cases
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {safeTestcases.map((tc, i) => {
                    const status = statusForIndex(i);
                    const isActive = i === activeTestcaseIndex;
                    return (
                      <button
                        key={tc.id ?? i}
                        type="button"
                        onClick={() => setActiveTestcaseIndex(i)}
                        className={`rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition ${
                          status === "passed"
                            ? "border-emerald-500/50 text-emerald-500"
                            : status === "failed"
                              ? "border-red-500/50 text-red-500"
                              : isActive
                                ? "border-foreground text-foreground"
                                : "border-border text-muted-foreground hover:border-foreground/40"
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Input
                    </span>
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-foreground/80">
                      {activeTestcase?.input ?? ""}
                    </pre>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Expected
                    </span>
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">
                      {activeTestcase?.output ?? ""}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border bg-card/50 p-2.5">
                  <span className="uppercase tracking-wider text-muted-foreground">Time</span>
                  <p className="mt-1 text-foreground/70">{timeComplexity}</p>
                </div>
                <div className="rounded-lg border bg-card/50 p-2.5">
                  <span className="uppercase tracking-wider text-muted-foreground">Space</span>
                  <p className="mt-1 text-foreground/70">{spaceComplexity}</p>
                </div>
              </div>

              {topics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {topics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-[9px] uppercase tracking-wider">
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              <OpponentCard
                name={opponentName}
                state={opponentState}
                line={opponentLine}
                rating={opponent?.rating ?? 0}
              />
              <div className="min-h-0 flex-1">
                <MaskedOpponentEditor opponentName={opponentName} />
              </div>
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="pointer-events-none flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <div className="pointer-events-auto flex items-center gap-3">
              <Select
                value={language}
                onValueChange={(value) => {
                  if (value === null) return;
                  const normalized = normalizeLanguage(value);
                  // Swap only when the editor is untouched: still holding the
                  // default template for the current language or empty.
                  const currentTemplate = buildTemplate(language, question.title);
                  const untouched = code.trim() === "" || code === currentTemplate;
                  setLanguage(normalized);
                  if (untouched) setCode(buildTemplate(normalized, question.title));
                }}
              >
                <SelectTrigger size="sm" className="text-[11px] font-semibold uppercase tracking-wider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {languageLabels[lang] ?? lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canPlay || isSubmitting}
                onClick={(event) => {
                  event.currentTarget.blur();
                  void handleSubmit("run");
                }}
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              >
                {isSubmitting ? "Running…" : "Run"}
                <kbd className="ml-1 hidden text-[9px] font-normal opacity-60 sm:inline">
                  ⌘⏎
                </kbd>
              </Button>
              <Button
                type="button"
                disabled={!canPlay || isSubmitting}
                onClick={(event) => {
                  event.currentTarget.blur();
                  void handleSubmit("submit");
                }}
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>

          {/* Height must flow through flex, not `h-full`: a percentage height
              on a grandchild of a flex column does not resolve, and Monaco
              silently collapses to 5x5 with no lines rendered. */}
          <div className="flex min-h-0 flex-1 p-3">
            <div className="pointer-events-auto flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
              <CodeEditor
                language={language}
                value={code}
                onChange={setCode}
                readOnly={!canPlay}
              />
            </div>
          </div>

          <div className="pointer-events-auto max-h-[11rem] shrink-0 overflow-y-auto border-t bg-muted/20 px-4 py-3 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span>Console</span>
              {feedback && (
                <span
                  className={`rounded-md border px-3 py-1 tracking-normal ${
                    feedbackTone === "success"
                      ? "border-emerald-500/40 text-emerald-500"
                      : feedbackTone === "error"
                        ? "border-red-500/40 text-red-500"
                        : "border-border text-foreground"
                  }`}
                >
                  {feedback}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <div className="flex flex-wrap gap-1.5">
                {safeTestcases.map((tc, i) => {
                  const status = statusForIndex(i);
                  return (
                    <button
                      key={`${tc.id}-console`}
                      type="button"
                      onClick={() => setActiveTestcaseIndex(i)}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                        i === activeTestcaseIndex
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/40"
                      }`}
                    >
                      {status === "passed" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : status === "failed" ? (
                        <X className="size-3 text-red-500" />
                      ) : status === "pending" ? (
                        <Clock className="size-3 text-amber-500" />
                      ) : null}
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="min-w-[16rem] flex-1">
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="min-w-0">
                    <span className="uppercase tracking-wider text-muted-foreground">Status</span>
                    <p className="mt-0.5 truncate text-foreground/80">
                      {activeResult
                        ? `${activeResult.status} ${activeResult.passed ? "(passed)" : ""}`
                        : results
                          ? "Pending"
                          : "—"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span className="uppercase tracking-wider text-muted-foreground">Time</span>
                    <p className="mt-0.5 truncate text-foreground/80">{activeResult?.time ?? "—"}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="uppercase tracking-wider text-muted-foreground">Memory</span>
                    <p className="mt-0.5 truncate text-foreground/80">
                      {activeResult?.memory != null ? `${activeResult.memory}` : "—"}
                    </p>
                  </div>
                </div>
                {activeResult && !activeResult.passed && activeResult.actual && (
                  <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-2 text-[10px] text-foreground/75">
                    {activeResult.actual}
                  </pre>
                )}
                {activeResult?.stderr && (
                  <pre className="mt-2 max-h-16 overflow-auto whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-500">
                    {activeResult.stderr}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Shared 3-2-1: both players see the same number at the same moment. */}
      {room.phase === "countdown" && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Both in the arena
            </span>
            <span className="font-mono text-8xl font-black tabular-nums text-primary">
              {room.countdownSeconds}
            </span>
            <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Same clock for both of you
            </span>
          </div>
        </div>
      )}

      {!connected && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/90 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Reconnecting
        </div>
      )}

      {/* Forfeit: the only way out, and it says exactly what it costs. */}
      <Dialog open={showForfeit} onOpenChange={setShowForfeit}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </span>
            <DialogHeader className="items-center gap-2">
              <DialogTitle className="text-xl font-bold uppercase tracking-wider text-destructive">
                Forfeit this match?
              </DialogTitle>
              <DialogDescription>
                Your opponent is declared the winner and the duel ends right now.
              </DialogDescription>
            </DialogHeader>
            {isRanked && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                Ranked forfeit costs ELO points.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Navigating away or closing this tab does the same thing.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/40 p-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setShowForfeit(false)}>
              Keep fighting
            </Button>
            <Button type="button" variant="destructive" onClick={() => void submitForfeit("surrender")}>
              Forfeit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Opponent detail: the "how is my rival doing" answer, one click away. */}
      <Dialog open={showOpponent} onOpenChange={setShowOpponent}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <DialogHeader className="gap-1">
              <DialogTitle className="flex items-center gap-2 text-base font-bold uppercase tracking-wider">
                <Eye className="size-4" />
                {opponentName}
              </DialogTitle>
              <DialogDescription>
                Real progress from their arena. Their code stays hidden.
              </DialogDescription>
            </DialogHeader>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowOpponent(false)}>
              Close
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Their runs" value={String(theirSummary.attempts)} />
              <StatTile
                label="Best"
                value={
                  theirSummary.bestTotal > 0
                    ? `${theirSummary.bestPassed}/${theirSummary.bestTotal}`
                    : "—"
                }
              />
              <StatTile label="Status" value={opponentStateLabels[opponentState]} />
              <StatTile
                label="Your runs"
                value={String(mySummary.attempts)}
                tone={mySummary.attempts > theirSummary.attempts ? "good" : undefined}
              />
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Last activity {describeOpponentActivity(theirSummary)}
            </p>

            <div className="mt-4 h-56">
              <MaskedOpponentEditor opponentName={opponentName} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <OutcomeDialog
        outcome={outcome}
        forfeit={room.forfeit}
        opponentLeft={room.opponentLeft}
        timedOut={room.timedOut}
        questionTitle={question.title}
        mySummary={mySummary}
        theirSummary={theirSummary}
        opponentName={opponentName}
        ratingDelta={myDelta}
        showRating={isRanked && ratingDelta !== null}
        exitHref={exitHref}
      />
    </div>
  );
}

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good";
}) {
  return (
    <div className="rounded-lg border bg-card/60 p-2.5">
      <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <p
        className={`mt-1 truncate text-sm font-semibold ${tone === "good" ? "text-emerald-500" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function OpponentCard({
  name,
  state,
  line,
  rating,
}: {
  name: string;
  state: string;
  line: string;
  rating: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-card/60 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <Activity className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {name}
        </span>
      </span>
      <span className="shrink-0 text-right text-[10px] uppercase tracking-wider text-foreground">
        {opponentStateLabels[state as keyof typeof opponentStateLabels] ?? state}
        {rating > 0 ? ` · ${rating}` : ""}
      </span>
      <span className="sr-only">{line}</span>
    </div>
  );
}

function WaitingRoom({
  modeLabel,
  questionTitle,
  opponentName,
  opponentPresent,
  abandoned,
  connected,
  leaving,
  onAbandon,
  exitHref,
}: {
  modeLabel: string;
  questionTitle: string;
  opponentName: string;
  opponentPresent: boolean;
  abandoned: boolean;
  connected: boolean;
  leaving: boolean;
  onAbandon: () => void;
  exitHref: string;
}) {
  return (
    <div className="relative flex h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-background p-4 text-foreground sm:p-6">
      <TetrioBattleBackground />
      <div className="relative z-10 grid w-full max-w-3xl gap-6 lg:grid-cols-[1fr_20rem] lg:items-center">
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card/90 p-8 text-center shadow-xl backdrop-blur-md">
        {abandoned ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-7 text-destructive" />
            </span>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                {modeLabel}
              </span>
              <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">
                Opponent never showed up
              </h1>
              <p className="text-sm text-muted-foreground">
                The room stayed empty, so nothing was started. No rating was touched.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              disabled={leaving}
              onClick={() => {
                window.location.href = exitHref;
              }}
            >
              Back to game modes
            </Button>
          </>
        ) : (
          <>
            <div className="relative flex size-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/15">
                <Loader2 className="size-7 animate-spin text-primary" />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
                {modeLabel}
              </span>
              <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">
                Waiting for {opponentName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {questionTitle} is locked in. The clock starts for both of you at the
                same moment, so nobody loses time to a slow page.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <SeatChip label="You" filled />
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">vs</span>
              <SeatChip label={opponentName} filled={opponentPresent} />
            </div>

            {!connected && (
              <p className="text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Reconnecting to the room…
              </p>
            )}

            <Button type="button" variant="outline" disabled={leaving} onClick={onAbandon}>
              Leave the room
            </Button>
          </>
        )}
        </div>

        {/* Holding the room is dead time too. Capped so the card and the board
            always both fit on a short screen. */}
        {!abandoned && (
          <div className="mx-auto w-full max-w-sm rounded-2xl border bg-card/90 p-4 shadow-xl backdrop-blur-md lg:max-w-none">
            <BrickBreaker title="Warm up" />
          </div>
        )}
      </div>
    </div>
  );
}

function SeatChip({ label, filled }: { label: string; filled: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        filled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      }`}
    >
      <span className={`size-2 rounded-full ${filled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
      <span className="max-w-[8rem] truncate">{label}</span>
    </span>
  );
}

function OutcomeDialog({
  outcome,
  forfeit,
  opponentLeft,
  timedOut,
  questionTitle,
  mySummary,
  theirSummary,
  opponentName,
  ratingDelta,
  showRating,
  exitHref,
}: {
  outcome: Outcome | null;
  forfeit: boolean;
  opponentLeft: boolean;
  timedOut: boolean;
  questionTitle: string;
  mySummary: { attempts: number; bestPassed: number; bestTotal: number; solved: boolean };
  theirSummary: { attempts: number; bestPassed: number; bestTotal: number; solved: boolean };
  opponentName: string;
  ratingDelta: number;
  showRating: boolean;
  exitHref: string;
}) {
  const router = useRouter();

  const tone =
    outcome === "won"
      ? "text-emerald-600 dark:text-emerald-400"
      : outcome === "lost"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  const title =
    outcome === "won" ? "Victory!" : outcome === "lost" ? "Defeated" : "Draw";

  const line = (() => {
    if (outcome === "won") {
      return opponentLeft
        ? `${opponentName} left the arena. The duel is yours.`
        : `You solved ${questionTitle} before ${opponentName}.`;
    }
    if (outcome === "lost") {
      if (opponentLeft) return `${opponentName} left the arena mid-duel.`;
      if (forfeit) return `${opponentName} forfeited.`;
      if (timedOut) return `${opponentName} got a passing submission in first.`;
      return `${opponentName} solved it first.`;
    }
    return timedOut
      ? "Time ran out with no winning submission."
      : "Nobody got a winning submission in.";
  })();

  const scoreFor = (summary: { attempts: number; bestPassed: number; bestTotal: number }) =>
    summary.attempts === 0
      ? "no runs"
      : summary.bestTotal > 0
        ? `${summary.bestPassed}/${summary.bestTotal}`
        : `${summary.attempts} ${summary.attempts === 1 ? "run" : "runs"}`;

  return (
    <Dialog
      open={outcome !== null}
      onOpenChange={(open) => {
        if (!open && outcome) router.push(exitHref);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <div className="flex flex-col items-center gap-4 p-6 text-center sm:p-7">
          <span
            className={`flex size-16 items-center justify-center rounded-full ${
              outcome === "won" ? "bg-emerald-500/10" : outcome === "lost" ? "bg-red-500/10" : "bg-amber-500/10"
            }`}
          >
            {outcome === "won" ? (
              <Trophy className="size-8 text-emerald-500" />
            ) : outcome === "lost" ? (
              <X className="size-8 text-red-500" />
            ) : (
              <Clock className="size-8 text-amber-500" />
            )}
          </span>

          <DialogHeader className="items-center gap-2">
            <DialogTitle className={`font-heading text-2xl font-bold uppercase tracking-wider ${tone}`}>
              {title}
            </DialogTitle>
            <DialogDescription className="max-w-[22rem] leading-relaxed">{line}</DialogDescription>
          </DialogHeader>

          <div className="grid w-full grid-cols-2 gap-2">
            <StatTile label="Your runs" value={String(mySummary.attempts)} />
            <StatTile label="Your best" value={scoreFor(mySummary)} />
            <StatTile
              label={`${opponentName} runs`}
              value={String(theirSummary.attempts)}
            />
            <StatTile label="Their best" value={scoreFor(theirSummary)} />
          </div>

          {showRating && (
            <div
              className={`flex w-full flex-col items-center gap-1 rounded-xl border px-4 py-3 ${
                ratingDelta > 0
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : ratingDelta < 0
                    ? "border-red-500/30 bg-red-500/10"
                    : "border-border bg-muted/40"
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                Rating change
              </span>
              <span
                className={`font-mono text-3xl font-bold ${
                  ratingDelta > 0 ? "text-emerald-500" : ratingDelta < 0 ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {formatRatingDelta(ratingDelta)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/40 p-4 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/leaderboard")}
            className="w-full sm:w-auto"
          >
            Leaderboard
          </Button>
          <Button
            type="button"
            onClick={() => router.push(exitHref)}
            className="w-full sm:w-auto"
          >
            Back to Modes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { MatchPlayerState };
