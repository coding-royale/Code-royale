"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, BookOpen, Eye, Trophy, Zap } from "lucide-react";
import { TetrioBattleBackground } from "@/components/battle/tetrio-battle-background";
import { MaskedOpponentEditor } from "@/components/battle/masked-opponent-editor";
import { BotSimulator, getBotConfig, type BotDifficulty, type BotProgress } from "@/lib/bot-player";
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
import { Progress } from "@/components/ui/progress";import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Testcase = {
  id: string;
  input: string;
  output: string;
};

type BotArenaProps = {
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
  testcases: Testcase[];
  botDifficulty: BotDifficulty;
  userId: string;
};

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
  node: `function solve(raw) {\n  // enter your code here\n  return raw;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(String(solve(input)));\n`,
  javascript: `function solve(raw) {\n  // enter your code here\n  return raw;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(String(solve(input)));\n`,
  python: `def solve(raw: str) -> str:\n    # write your solution\n    return raw\n\nimport sys\ninput_data = sys.stdin.read().strip()\nprint(solve(input_data))\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& raw) {\n    // enter your code here\n    return raw;\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    stringstream buffer;\n    buffer << cin.rdbuf();\n    string input = buffer.str();\n\n    cout << solve(input);\n    return 0;\n}\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  private static String solve(String raw) {\n    // enter your code here\n    return raw;\n  }\n\n  public static void main(String[] args) throws Exception {\n    StringBuilder sb = new StringBuilder();\n    try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {\n      String line;\n      while ((line = br.readLine()) != null) {\n        if (sb.length() > 0) sb.append("\\n");\n        sb.append(line);\n      }\n    }\n    System.out.print(solve(sb.toString()));\n  }\n}\n`,
  c: `#include <stdio.h>\n#include <string.h>\n\nvoid solve(const char *raw) {\n  // enter your code here\n  printf("%s", raw);\n}\n\nint main(void) {\n  char buffer[1 << 16];\n  size_t length = fread(buffer, 1, sizeof(buffer) - 1, stdin);\n  buffer[length] = '\\0';\n  solve(buffer);\n  return 0;\n}\n`,
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.max(seconds % 60, 0).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalizeLanguage = (value: string) => {
  if (value === "javascript") return "node";
  return value;
};

const buildTemplate = (language: string, title: string) => {
  const key = normalizeLanguage(language);
  const template = codeTemplates[key];
  if (!template) return `// ${title}\n// Write your solution here\n`;
  return template.replaceAll("${title}", title);
};

const BOT_NAMES: Record<BotDifficulty, string> = {
  easy: "Novice Bot",
  medium: "Adept Bot",
  hard: "Elite Bot",
};

const DIFFICULTY_STYLES: Record<
  BotDifficulty,
  { border: string; bg: string; text: string; dot: string; chip: string }
> = {
  easy: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/15",
    text: "text-emerald-500",
    dot: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  medium: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/15",
    text: "text-amber-500",
    dot: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  hard: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/15",
    text: "text-rose-500",
    dot: "bg-rose-500",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-500",
  },
};

const SOLUTION_CODE_BY_LANG: Record<string, string> = {
  node: `function solve(raw) {\n  const lines = raw.trim().split('\\n');\n  const nums = lines[0].split(',').map(Number);\n  let sum = 0;\n  for (const n of nums) {\n    if (n > 0) sum += n;\n  }\n  return String(sum);\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(solve(input));`,
  python: `def solve(raw: str) -> str:\n    nums = [int(x) for x in raw.strip().split(',')]\n    total = sum(n for n in nums if n > 0)\n    return str(total)\n\nimport sys\ninput_data = sys.stdin.read().strip()\nprint(solve(input_data))`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& raw) {\n    stringstream ss(raw);\n    string token;\n    int sum = 0;\n    while (getline(ss, token, ',')) {\n        int n = stoi(token);\n        if (n > 0) sum += n;\n    }\n    return to_string(sum);\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    stringstream buffer;\n    buffer << cin.rdbuf();\n    cout << solve(buffer.str());\n    return 0;\n}`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  private static String solve(String raw) {\n    int sum = 0;\n    for (String s : raw.trim().split(",")) {\n      int n = Integer.parseInt(s.trim());\n      if (n > 0) sum += n;\n    }\n    return String.valueOf(sum);\n  }\n\n  public static void main(String[] args) throws Exception {\n    StringBuilder sb = new StringBuilder();\n    try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {\n      String line;\n      while ((line = br.readLine()) != null) {\n        if (sb.length() > 0) sb.append("\\n");\n        sb.append(line);\n      }\n    }\n    System.out.print(solve(sb.toString()));\n  }\n}`,
  c: `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\nvoid solve(const char *raw) {\n    char copy[1024];\n    strcpy(copy, raw);\n    int sum = 0;\n    char *token = strtok(copy, ",");\n    while (token) {\n        int n = atoi(token);\n        if (n > 0) sum += n;\n        token = strtok(NULL, ",");\n    }\n    printf("%d", sum);\n}\n\nint main(void) {\n    char buffer[1 << 16];\n    size_t length = fread(buffer, 1, sizeof(buffer) - 1, stdin);\n    buffer[length] = '\\0';\n    solve(buffer);\n    return 0;\n}`,
};

export function BotBattleArenaClient({
  question,
  testcases,
  botDifficulty,
}: BotArenaProps) {
  const router = useRouter();
  const normalizedInitialLanguage = normalizeLanguage(question.languages[0] ?? "javascript");
  const availableLanguages = useMemo(
    () => question.languages.map(normalizeLanguage),
    [question.languages],
  );
  const safeTestcases = testcases.length > 0 ? testcases : [{ id: "fallback", input: "", output: "" }];

  const [language, setLanguage] = useState(normalizedInitialLanguage);
  const [code, setCode] = useState(() => buildTemplate(normalizedInitialLanguage, question.title));
  const [results, setResults] = useState<SubmissionResult[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info" | null>(null);
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [showQuestion, setShowQuestion] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [matchResult, setMatchResult] = useState<"playing" | "won" | "lost" | "bot_won" | "draw">("playing");
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  const [botProgress, setBotProgress] = useState<BotProgress>({
    overallProgress: 0,
    stage: "thinking",
    code: "",
    statusMessage: "Initializing...",
    estimatedTimeRemaining: 0,
  });

  const botConfig = useMemo(() => getBotConfig(botDifficulty), [botDifficulty]);
  const botSimRef = useRef<BotSimulator | null>(null);
  const startedAtRef = useRef(Date.now());

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

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const targetCode = SOLUTION_CODE_BY_LANG[language] ?? SOLUTION_CODE_BY_LANG.node ?? "";
    const sim = new BotSimulator(
      botDifficulty,
      targetCode,
      (progress) => setBotProgress(progress),
      () => {
        if (matchResult === "playing") {
          setMatchResult("bot_won");
        }
      },
    );
    botSimRef.current = sim;
    sim.start();

    return () => {
      sim.stop();
    };
  }, [botDifficulty, language, matchResult]);

  useEffect(() => {
    if (matchResult === "bot_won") {
      setFeedback("Bot solved the problem first! Better luck next time.");
      setFeedbackTone("error");
    }
  }, [matchResult]);

  const statusForIndex = (index: number) => {
    if (!results) return "idle";
    const resolved = results.find((r) => r.index === index);
    if (resolved) return resolved.passed ? "passed" : "failed";
    return "pending";
  };

  const handleSubmit = async (intent: "run" | "submit") => {
    if (!code.trim()) {
      setFeedback("Write some code before running.");
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
        body: JSON.stringify({ questionId: question.id, language, code, intent }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Submission failed." }));
        setFeedback(data.error ?? "Submission failed.");
        setFeedbackTone("error");
        return;
      }

      const payload = (await response.json()) as {
        passed: boolean;
        results: SubmissionResult[];
      };

      setResults(payload.results);

      if (payload.passed && intent === "submit") {
        const botFinishedFirst = matchResult === "bot_won";
        const won = !botFinishedFirst;

        if (won) {
          setMatchResult("won");
          setFeedback("All test cases passed! You beat the bot!");
          setFeedbackTone("success");
        } else {
          setMatchResult("draw");
          setFeedback("You solved it, but the bot beat you to it!");
          setFeedbackTone("info");
        }

        const timeTaken = Math.floor((Date.now() - startedAtRef.current) / 1000);

        try {
          const scoreRes = await fetch("/api/bot-battle/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              difficulty: botDifficulty,
              won,
              timeTakenSeconds: timeTaken,
            }),
          });
          const scoreData = await scoreRes.json();
          setPointsAwarded(scoreData.pointsAwarded ?? 0);
        } catch {
          setPointsAwarded(0);
        }
      } else if (payload.passed) {
        setFeedback("All test cases passed. Submit to finish!");
        setFeedbackTone("success");
      } else {
        setFeedback("Some test cases failed. Keep trying!");
        setFeedbackTone("error");
      }
    } catch {
      setFeedback("Couldn't run your code. Please try again.");
      setFeedbackTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = () => {
    if (isMatchOver) {
      router.push("/game-modes");
    } else {
      setShowForfeitConfirm(true);
    }
  };

  const handleConfirmForfeit = () => {
    setShowForfeitConfirm(false);
    router.push("/game-modes");
  };

  const timeComplexity = question.meta?.timeComplexity ?? "TBD";
  const spaceComplexity = question.meta?.spaceComplexity ?? "TBD";
  const topics = Array.isArray(question.meta?.topics) ? question.meta.topics.filter(Boolean) : [];

  const botName = BOT_NAMES[botDifficulty];
  const difficultyStyle = DIFFICULTY_STYLES[botDifficulty];

  const activeResult = results?.find((r) => r.index === activeTestcaseIndex);
  const activeTestcase = safeTestcases[activeTestcaseIndex];

  const isMatchOver = matchResult !== "playing";

  const handlePlayAgain = useCallback(() => {
    setMatchResult("playing");
    setPointsAwarded(null);
    setResults(null);
    setFeedback(null);
    setFeedbackTone(null);
    setCode(buildTemplate(normalizedInitialLanguage, question.title));
    setElapsedTime(0);
    startedAtRef.current = Date.now();
  }, [normalizedInitialLanguage, question.title]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <TetrioBattleBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b bg-background/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.4em] text-amber-500">
                Bot Battle · {botDifficulty.toUpperCase()}
              </span>
              <h1 className="text-xl font-bold uppercase tracking-wider md:text-2xl">
                {question.title}
              </h1>
            </div>
            <Badge variant="outline" className="uppercase tracking-wider">
              {question.difficulty}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-5 py-2.5">
              <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                Elapsed
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {formatDuration(elapsedTime)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Avatar className="size-10 border-2 border-border text-sm font-bold">
                <AvatarFallback>You</AvatarFallback>
              </Avatar>
              <span className="text-lg font-black uppercase text-amber-500">VS</span>
              <Avatar className={`size-10 border-2 ${difficultyStyle.border} ${difficultyStyle.bg} text-sm font-bold`}>
                <AvatarFallback className={difficultyStyle.text}>BOT</AvatarFallback>
              </Avatar>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleExit}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {isMatchOver ? "Leave" : "Forfeit"}
            </Button>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 overflow-hidden">
          <aside className="flex w-[300px] shrink-0 flex-col border-r bg-muted/20 p-4 backdrop-blur-sm">
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
                  <p key={i} className="mb-3">{p}</p>
                ))}

                <div className="mt-5 rounded-xl border bg-card/60 p-4 shadow-sm">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Test Cases</span>
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
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Input</span>
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-foreground/80">{activeTestcase?.input ?? ""}</pre>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Expected</span>
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">{activeTestcase?.output ?? ""}</pre>
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
                <div className="min-h-0 flex-1">
                  <MaskedOpponentEditor opponentName={botName} code={botProgress.code} />
                </div>
              )}
            </aside>

          <div className="flex flex-1">
            <div className="relative flex w-1/2 flex-col border-r">
              <div className="relative flex-1 p-4">
                <div className="relative z-10 flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Select
                      value={language}
                      onValueChange={(value) => {
                        if (value === null) return;
                        const normalized = normalizeLanguage(value);
                        setLanguage(normalized);
                        setCode((c) => (!c.trim() ? buildTemplate(normalized, question.title) : c));
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

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSubmit("run")}
                        disabled={isSubmitting || isMatchOver}
                        className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                      >
                        {isSubmitting ? "Running..." : "Run"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSubmit("submit")}
                        disabled={isSubmitting || isMatchOver}
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
                      disabled={isMatchOver}
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
                      const indicator = status === "passed" ? "bg-emerald-500"
                        : status === "failed" ? "bg-red-500"
                          : status === "pending" ? "bg-amber-500" : "bg-muted-foreground/50";
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
                          <span className={`size-1.5 rounded-full ${indicator}`} />
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="uppercase tracking-wider text-muted-foreground">Status</span>
                        <p className="mt-0.5 text-foreground/80">
                          {activeResult ? `${activeResult.status}` : results ? "Pending" : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-muted-foreground">Time</span>
                        <p className="mt-0.5 text-foreground/80">{activeResult?.time ?? "—"}</p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-muted-foreground">Memory</span>
                        <p className="mt-0.5 text-foreground/80">{activeResult?.memory != null ? `${activeResult.memory}` : "—"}</p>
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

            <div className="flex w-1/2 flex-col">
              <div className={`flex flex-col items-center justify-center border-b ${difficultyStyle.border} bg-muted/20 px-6 py-4`}>
                <div className="flex items-center gap-3">
                  <Avatar className={`size-12 border-2 ${difficultyStyle.border} ${difficultyStyle.bg} text-lg font-bold`}>
                    <AvatarFallback className={difficultyStyle.text}>
                      <Bot className="size-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-bold">{botName}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[9px] font-semibold uppercase tracking-wider ${difficultyStyle.chip}`}>
                        {botDifficulty} · ~{formatDuration(botConfig.estimatedSeconds)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{botProgress.statusMessage}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`border-b ${difficultyStyle.border} bg-muted/10 px-6 py-3`}>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Bot Progress</span>
                  <span>{Math.round(botProgress.overallProgress * 100)}%</span>
                </div>
                <Progress value={botProgress.overallProgress * 100} className="w-full" />
                <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-wider">
                  <span className={difficultyStyle.text}>{botProgress.stage}</span>
                  <span className="text-muted-foreground">
                    ~{formatDuration(botProgress.estimatedTimeRemaining)} remaining
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-4">
                <div className="h-full overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="border-b px-4 py-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span className={`size-2 rounded-full ${difficultyStyle.dot}`} />
                      Bot Coding Activity
                    </div>
                  </div>
                  <div className="h-[calc(100%-36px)] overflow-y-auto p-5">
                    <pre className="whitespace-pre-wrap font-mono text-[13px] text-foreground/70">
                      {botProgress.code || (
                        <span className="italic text-muted-foreground">
                          {botProgress.stage === "thinking" ? "Thinking about the problem..." : "// writing solution..."}
                        </span>
                      )}
                      <span className="animate-pulse">▊</span>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isMatchOver} onOpenChange={() => {}}>
        <DialogContent className="w-full max-w-lg gap-6 p-8 text-center">
          <DialogHeader className="items-center gap-2">
            <DialogTitle className={`text-3xl font-bold uppercase tracking-wider ${
              matchResult === "won"
                ? "text-emerald-600 dark:text-emerald-400"
                : matchResult === "bot_won"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
            }`}>
              {matchResult === "won" ? (
                <span className="flex flex-col items-center gap-2">
                  <Trophy className="size-16 text-emerald-500" />
                  Victory!
                </span>
              ) : matchResult === "bot_won" ? (
                <span className="flex flex-col items-center gap-2">
                  <Bot className="size-16 text-red-500" />
                  Bot Wins
                </span>
              ) : (
                <span className="flex flex-col items-center gap-2">
                  <Zap className="size-16 text-amber-500" />
                  Draw
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {matchResult === "won"
                ? "You solved the problem before the bot! Excellent work."
                : matchResult === "bot_won"
                  ? `The ${botName} solved the problem first. Try a lower difficulty or practice more.`
                  : "You solved it, but the bot finished first too."}
            </DialogDescription>
          </DialogHeader>

          {pointsAwarded !== null && (
            <div className="inline-flex items-center gap-3 self-center rounded-2xl border border-amber-500/30 bg-amber-500/10 px-8 py-4">
              <Trophy className="size-8 text-amber-500" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-amber-500/80">Points Earned</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pointsAwarded}</p>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Button
              type="button"
              onClick={handlePlayAgain}
              className="px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em]"
            >
              Play Again
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/game-modes")}
              className="px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em]"
            >
              Back to Modes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showForfeitConfirm} onOpenChange={setShowForfeitConfirm}>
        <DialogContent className="w-full max-w-md gap-5 p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold uppercase tracking-wider text-destructive">
              Forfeit Match?
            </DialogTitle>
            <DialogDescription>
              You will lose this bot battle. Are you sure you want to forfeit?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForfeitConfirm(false)}
              className="text-xs font-semibold uppercase tracking-[0.25em]"
            >
              Keep Going
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmForfeit}
              className="text-xs font-semibold uppercase tracking-[0.25em]"
            >
              Forfeit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
