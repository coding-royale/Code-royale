"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Clock, Eye, Trophy, X } from "lucide-react";
import { TetrioBattleBackground } from "@/components/battle/tetrio-battle-background";
import { MaskedOpponentEditor } from "@/components/battle/masked-opponent-editor";
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
  initialTimer: number;
  initialLanguage: string;
  exitHref?: string;
  matchMode?: string;
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

const languageLabels: Record<string, string> = {
  node: "JavaScript (Node)",
  javascript: "JavaScript (Node)",
  python: "Python 3",
  cpp: "C++",
  java: "Java",
  c: "C",
};

const codeTemplates: Record<string, string> = {
  node: `// TODO: solve "${"${title}"}"\nfunction solve(raw) {\n  // write your solution\n  return raw;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(String(solve(input)));\n`,
  javascript: `// TODO: solve "${"${title}"}"\nfunction solve(raw) {\n  // write your solution\n  return raw;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(String(solve(input)));\n`,
  python: `# TODO: solve "${"${title}"}"\ndef solve(raw: str) -> str:\n    # write your solution\n    return raw\n\nimport sys\ninput_data = sys.stdin.read().strip()\nprint(solve(input_data))\n`,
  cpp: `// TODO: solve "${"${title}"}"\n#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& raw) {\n    // enter your code here\n    return raw;\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    stringstream buffer;\n    buffer << cin.rdbuf();\n    string input = buffer.str();\n\n    cout << solve(input);\n    return 0;\n}\n`,
  java: `// TODO: solve "${"${title}"}"\nimport java.io.*;\nimport java.util.*;\n\npublic class Main {\n  private static String solve(String raw) {\n    // enter your code here\n    return raw;\n  }\n\n  public static void main(String[] args) throws Exception {\n    StringBuilder sb = new StringBuilder();\n    try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {\n      String line;\n      while ((line = br.readLine()) != null) {\n        if (sb.length() > 0) sb.append("\\n");\n        sb.append(line);\n      }\n    }\n    System.out.print(solve(sb.toString()));\n  }\n}\n`,
  c: `// TODO: solve "${"${title}"}"\n#include <stdio.h>\n#include <string.h>\n\nvoid solve(const char *raw) {\n  // write your solution\n  printf("%s", raw);\n}\n\nint main(void) {\n  char buffer[1 << 16];\n  size_t length = fread(buffer, 1, sizeof(buffer) - 1, stdin);\n  buffer[length] = '\\0';\n  solve(buffer);\n  return 0;\n}\n`,
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.max(seconds % 60, 0)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalizeLanguage = (value: string) => {
  if (value === "javascript") {
    return "node";
  }
  return value;
};

const buildTemplate = (language: string, title: string) => {
  const key = normalizeLanguage(language);
  const template = codeTemplates[key];
  if (!template) {
    return `// ${title}\n// Write your solution here\n`;
  }
  return template.replaceAll("${title}", title);
};

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

type MatchOutcome = {
  status: "won" | "lost" | "draw" | "timeout";
  winnerId?: string;
  ratingDelta?: { winner: number; loser: number };
};

export function MatchArenaShell({
  question,
  testcases,
  initialTimer,
  initialLanguage,
  exitHref = "/game-modes",
  matchMode = "ranked",
}: MatchArenaShellProps) {
  const router = useRouter();
  const pathname = usePathname();
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
  const [timerSeconds, setTimerSeconds] = useState(initialTimer);
  const [code, setCode] = useState(() =>
    buildTemplate(normalizedInitialLanguage, question.title),
  );
  const [results, setResults] = useState<SubmissionResult[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<
    "success" | "error" | "info" | null
  >(null);
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);
  const [matchOutcome, setMatchOutcome] = useState<MatchOutcome | null>(null);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const hasAutoCompletedRef = useRef(false);

  const matchId = useMemo(() => {
    const found = pathname?.match(/^\/match\/([^/?#]+)/);
    return found?.[1] ?? null;
  }, [pathname]);

  // Countdown — drives the existing timeout auto-complete path.
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for match completion via Supabase browser client
  useEffect(() => {
    if (!matchId || matchOutcome) return;

    let alive = true;

    const checkMatchStatus = async () => {
      if (!alive || !matchId) return;
      try {
        // Use the Supabase browser client to check match metadata
        const { supabase } = await import("@/lib/supabase-browser");
        const { data: matchRow } = await supabase
          .from("matches")
          .select("metadata")
          .eq("id", matchId)
          .single();

        if (!alive || !matchRow) return;

        const meta = matchRow.metadata && typeof matchRow.metadata === "object"
          ? matchRow.metadata as Record<string, unknown>
          : null;

        const winnerId = meta?.winner_id;
        if (typeof winnerId === "string" && winnerId) {
          const ratingDelta = meta?.rating_delta as { winner: number; loser: number } | undefined;
          const isTimeout = meta?.timed_out === true;

          // Determine if current user won or lost
          const { data: { user } } = await supabase.auth.getUser();
          const currentUserId = user?.id;

          let status: "won" | "lost" | "draw" = "draw";
          if (winnerId === currentUserId) {
            status = "won";
          } else if (winnerId !== currentUserId) {
            status = "lost";
          }

          setMatchOutcome({
            status: isTimeout && !winnerId ? "draw" : status,
            winnerId,
            ratingDelta,
          });
        }
      } catch {
        // ignore transient errors
      }
    };

    const interval = setInterval(checkMatchStatus, 3000);
    // Also check immediately
    void checkMatchStatus();

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [matchId, matchOutcome]);

  // Auto-complete on timeout
  useEffect(() => {
    if (timerSeconds > 0 || matchOutcome || hasAutoCompletedRef.current || !matchId) return;

    hasAutoCompletedRef.current = true;

    const completeOnTimeout = async () => {
      try {
        const res = await fetch("/api/match/timeout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });
        const data = await res.json() as {
          winnerId?: string | null;
          draw?: boolean;
          ratingDelta?: { winner: number; loser: number };
        };

        const { supabase } = await import("@/lib/supabase-browser");
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;

        if (data.draw) {
          setMatchOutcome({ status: "draw" });
        } else if (data.winnerId === currentUserId) {
          setMatchOutcome({ status: "won", winnerId: data.winnerId, ratingDelta: data.ratingDelta });
        } else {
          setMatchOutcome({ status: "lost", winnerId: data.winnerId ?? undefined, ratingDelta: data.ratingDelta });
        }
      } catch {
        setMatchOutcome({ status: "timeout" });
      }
    };

    void completeOnTimeout();
  }, [timerSeconds, matchOutcome, matchId]);

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

  const timerState = useMemo(() => {
    if (timerSeconds === 0) return "TIME UP";
    return formatDuration(timerSeconds);
  }, [timerSeconds]);

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

  const handleExitRequest = () => setShowExitConfirm(true);
  const handleStayInSession = () => setShowExitConfirm(false);

  const handleForfeit = async () => {
    setShowForfeitConfirm(false);
    if (!matchId) {
      router.push(exitHref);
      return;
    }
    try {
      await fetch("/api/match/forfeit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
    } catch {
      // ignore
    }
    setMatchOutcome({ status: "lost" });
  };

  const handleSubmit = async (intent: SubmissionIntent) => {
    if (!code.trim()) {
      setFeedback("Write some code before running your solution.");
      setFeedbackTone("info");
      return;
    }

    if (matchOutcome) return; // Match already over

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
        }),
      });

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: "Submission failed." }));
        setFeedback(data.error ?? "Submission failed.");
        setFeedbackTone("error");
        return;
      }

      const payload = (await response.json()) as {
        passed: boolean;
        results: SubmissionResult[];
      };

      setResults(payload.results);

      if (payload.passed) {
        if (intent === "submit" && matchId) {
          const completeRes = await fetch("/api/match/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId }),
          });
          const completeData = await completeRes.json() as {
            ok?: boolean;
            winnerId?: string;
            alreadyCompleted?: boolean;
            ratingDelta?: { winner: number; loser: number };
          };

          const { supabase } = await import("@/lib/supabase-browser");
          const { data: { user } } = await supabase.auth.getUser();
          const currentUserId = user?.id;

          if (completeData.winnerId === currentUserId) {
            setMatchOutcome({ status: "won", winnerId: completeData.winnerId, ratingDelta: completeData.ratingDelta });
          } else if (completeData.alreadyCompleted) {
            setMatchOutcome({ status: "lost", winnerId: completeData.winnerId, ratingDelta: completeData.ratingDelta });
          } else {
            setMatchOutcome({ status: "won", winnerId: completeData.winnerId, ratingDelta: completeData.ratingDelta });
          }
        }
        setFeedback(
          intent === "submit"
            ? "Correct! All test cases passed."
            : "All test cases passed.",
        );
        setFeedbackTone("success");
      } else {
        setFeedback(
          intent === "submit" ? "Not yet. Try again!" : "Some test cases failed.",
        );
        setFeedbackTone("error");
      }
    } catch (error) {
      console.error("Submission error", error);
      setFeedback("Couldn't run your code. Please try again.");
      setFeedbackTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeLabel = modeLabels[matchMode] ?? matchMode.toUpperCase();
  const opponentTag = modeLabel.includes("2v2") ? "T2" : modeLabel.includes("FFA") ? "FFA" : "R";
  const timerTone =
    timerSeconds <= 30
      ? "text-destructive"
      : timerSeconds <= 60
        ? "text-primary"
        : "text-foreground";

  return (
    <>
      <div className="relative min-h-screen overflow-hidden">
        <TetrioBattleBackground />

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b bg-background/80 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
                  {modeLabel}
                </span>
                <h1 className="font-heading text-xl font-bold uppercase tracking-wider md:text-2xl">
                  {question.title}
                </h1>
              </div>
              <Badge variant="outline" className="uppercase tracking-wider">
                {question.difficulty}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-5 py-2.5">
                <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Time
                </span>
                <span className={`font-mono text-2xl font-bold tabular-nums ${timerTone}`}>
                  {timerState}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Avatar className="size-10 border-2 text-sm font-bold">
                  <AvatarFallback>You</AvatarFallback>
                </Avatar>
                <span className="text-lg font-black uppercase text-primary">VS</span>
                <Avatar className="size-10 border-2 border-red-500/40 bg-red-500/15 text-sm font-bold">
                  <AvatarFallback className="text-red-500">{opponentTag}</AvatarFallback>
                </Avatar>
                <div className="hidden flex-col sm:flex">
                  <span className="text-sm font-medium">Opponent</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    solving…
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={matchOutcome ? () => router.push(exitHref) : handleExitRequest}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {matchOutcome ? "Leave Match" : "Surrender"}
              </Button>
            </div>
          </header>

          <div className="relative z-10 flex flex-1 overflow-hidden">
            <aside className="flex w-[320px] shrink-0 flex-col border-r bg-muted/20 p-4 backdrop-blur-sm">
              {/* Problem / Opponent switcher */}
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex rounded-lg bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setShowQuestion(true)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                      showQuestion
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <BookOpen className="size-3" />
                    Problem
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuestion(false)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                      !showQuestion
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="size-3" />
                    Opponent
                  </button>
                </div>
              </div>

              {showQuestion ? (
                <div className="flex-1 overflow-y-auto text-sm leading-relaxed text-foreground/80">
                  {question.description.split(/\n\n+/).map((p, i) => (
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
                      <span className="uppercase tracking-wider text-muted-foreground">
                        Time
                      </span>
                      <p className="mt-1 text-foreground/70">{timeComplexity}</p>
                    </div>
                    <div className="rounded-lg border bg-card/50 p-2.5">
                      <span className="uppercase tracking-wider text-muted-foreground">
                        Space
                      </span>
                      <p className="mt-1 text-foreground/70">{spaceComplexity}</p>
                    </div>
                  </div>

                  {topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topics.map((topic) => (
                        <Badge
                          key={topic}
                          variant="secondary"
                          className="text-[9px] uppercase tracking-wider"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1">
                  <MaskedOpponentEditor opponentName="Opponent" />
                </div>
              )}
            </aside>

            <div className="relative flex min-w-0 flex-1 flex-col">
              <div className="relative flex-1 p-4">
                <div className="relative z-10 flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Select
                        value={language}
                        onValueChange={(value) => {
                          if (value === null) return;
                          const normalized = normalizeLanguage(value);
                          setLanguage(normalized);
                          setCode((c) =>
                            !c.trim()
                              ? buildTemplate(normalized, question.title)
                              : c,
                          );
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
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {languageLabels[language] ?? language}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSubmit("run")}
                        disabled={isSubmitting}
                        className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                      >
                        {isSubmitting ? "Running..." : "Run"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSubmit("submit")}
                        disabled={isSubmitting}
                        className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                      >
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCode("")}
                        className="text-[10px] font-semibold uppercase tracking-wider"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      spellCheck={false}
                      className="code-editor h-full w-full resize-none bg-transparent p-5 text-[14px] text-foreground/90 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t bg-muted/20 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  <span>Console</span>
                  {feedback && (
                    <span
                      className={`rounded-md border px-3 py-1 text-[10px] ${
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

                <div className="mt-3 flex gap-3">
                  <div className="flex gap-1.5">
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

                  <div className="flex-1 overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="uppercase tracking-wider text-muted-foreground">
                          Status
                        </span>
                        <p className="mt-0.5 text-foreground/80">
                          {activeResult
                            ? `${activeResult.status} ${activeResult.passed ? "(passed)" : ""}`
                            : results
                              ? "Pending"
                              : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-muted-foreground">
                          Time
                        </span>
                        <p className="mt-0.5 text-foreground/80">
                          {activeResult?.time ?? "—"}
                        </p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-muted-foreground">
                          Memory
                        </span>
                        <p className="mt-0.5 text-foreground/80">
                          {activeResult?.memory != null
                            ? `${activeResult.memory}`
                            : "—"}
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
            </div>
          </div>
        </div>
      </div>

      {/* Surrender confirm */}
      <Dialog open={showExitConfirm && !matchOutcome} onOpenChange={setShowExitConfirm}>
        <DialogContent className="w-full max-w-md gap-5 p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold uppercase tracking-wider text-destructive">
              Surrender Match?
            </DialogTitle>
            <DialogDescription>
              You will forfeit this battle. Are you sure you want to surrender?
            </DialogDescription>
          </DialogHeader>
          {matchMode === "ranked" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                Ranked Match Warning
              </p>
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                Surrendering a ranked match will cost you ELO points. Quit at your own risk.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleStayInSession}>
              Keep Fighting
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setShowExitConfirm(false);
                setShowForfeitConfirm(true);
              }}
            >
              Surrender
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forfeit confirm */}
      <Dialog open={showForfeitConfirm} onOpenChange={setShowForfeitConfirm}>
        <DialogContent className="w-full max-w-md gap-5 p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold uppercase tracking-wider text-destructive">
              Confirm Surrender
            </DialogTitle>
            <DialogDescription>
              Your opponent will be declared the winner. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowForfeitConfirm(false)}>
              Go Back
            </Button>
            <Button type="button" variant="destructive" onClick={handleForfeit}>
              Surrender Match
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match outcome */}
      <Dialog open={Boolean(matchOutcome)} onOpenChange={() => {}}>
        <DialogContent className="w-full max-w-lg gap-6 p-8 text-center">
          <DialogHeader className="items-center gap-2">
            <DialogTitle
              className={`text-3xl font-bold uppercase tracking-wider ${
                matchOutcome?.status === "won"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : matchOutcome?.status === "lost"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
              }`}
            >
              <span className="flex flex-col items-center gap-2">
                {matchOutcome?.status === "won" ? (
                  <Trophy className="size-16 text-emerald-500" />
                ) : (
                  <X className="size-16" />
                )}
                {matchOutcome?.status === "won"
                  ? "Victory!"
                  : matchOutcome?.status === "lost"
                    ? "Defeated"
                    : matchOutcome?.status === "timeout"
                      ? "Time's Up!"
                      : "Draw"}
              </span>
            </DialogTitle>
            <DialogDescription>
              {matchOutcome?.status === "won"
                ? "You solved the problem before your opponent!"
                : matchOutcome?.status === "lost"
                  ? "Your opponent solved the problem first. Better luck next time."
                  : matchOutcome?.status === "timeout"
                    ? "Time ran out. No one solved the problem."
                    : "Neither player solved the problem in time."}
            </DialogDescription>
          </DialogHeader>

          {matchOutcome?.ratingDelta && matchMode === "ranked" && (
            <div className="flex justify-center gap-6">
              <div
                className={`rounded-2xl border px-6 py-4 ${
                  matchOutcome.status === "won"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10"
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Rating Change
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    matchOutcome.status === "won"
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {matchOutcome.status === "won"
                    ? `+${matchOutcome.ratingDelta.winner}`
                    : matchOutcome.ratingDelta.loser}
                </p>
              </div>
            </div>
          )}

          {matchOutcome?.status === "draw" && matchMode === "ranked" && (
            <div className="inline-flex items-center gap-3 self-center rounded-2xl border bg-muted/40 px-6 py-4">
              <p className="text-sm text-muted-foreground">No rating change</p>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/game-modes")}
              className="px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em]"
            >
              Back to Modes
            </Button>
            <Button
              type="button"
              onClick={() => router.push("/leaderboard")}
              className="px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em]"
            >
              Leaderboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
