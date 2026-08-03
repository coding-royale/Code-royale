"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TetrioBattleBackground } from "@/components/battle/tetrio-battle-background";
import { BotSimulator, getBotConfig, type BotDifficulty, type BotProgress } from "@/lib/bot-player";

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

const DIFFICULTY_COLORS: Record<BotDifficulty, string> = {
  easy: "emerald",
  medium: "amber",
  hard: "rose",
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
        body: JSON.stringify({ questionId: question.id, language, code }),
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
  const accentColor = DIFFICULTY_COLORS[botDifficulty];

  const activeResult = results?.find((r) => r.index === activeTestcaseIndex);
  const activeTestcase = safeTestcases[activeTestcaseIndex];

  const isMatchOver = matchResult !== "playing";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030915]">
      <TetrioBattleBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-sky-500/10 bg-[#060d1f]/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.4em] text-amber-400/70">
                Bot Battle · {botDifficulty.toUpperCase()}
              </span>
              <h1 className="text-xl font-bold uppercase tracking-wider text-sky-50 md:text-2xl">
                {question.title}
              </h1>
            </div>
            <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-300/80">
              {question.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-5 py-2.5">
              <span className="text-[10px] uppercase tracking-[0.35em] text-sky-300/70">
                Elapsed
              </span>
              <span className="text-2xl font-bold tabular-nums text-sky-100">
                {formatDuration(elapsedTime)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-sky-400/40 bg-sky-500/15 text-sm font-bold text-sky-200">
                You
              </div>
              <span className="text-lg font-black uppercase text-amber-400">VS</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-${accentColor}-400/40 bg-${accentColor}-500/15 text-sm font-bold text-${accentColor}-200`}>
                BOT
              </div>
            </div>

            <button
              type="button"
              onClick={handleExit}
              className="rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-red-300 transition hover:border-red-400 hover:text-red-200"
            >
              {isMatchOver ? "Leave" : "Forfeit"}
            </button>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 overflow-hidden">
          {showQuestion && (
            <aside className="flex w-[300px] shrink-0 flex-col border-r border-sky-500/10 bg-[#060d1f]/60 p-5 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.35em] text-sky-400/60">Challenge</span>
                <button
                  type="button"
                  onClick={() => setShowQuestion(false)}
                  className="rounded-md border border-sky-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-sky-400/50 transition hover:border-sky-400/40 hover:text-sky-300/70"
                >
                  Hide
                </button>
              </div>
              <div className="flex-1 overflow-y-auto text-sm leading-relaxed text-sky-100/80">
                {question.description.split(/\n\n+/).map((p, i) => (
                  <p key={i} className="mb-3">{p}</p>
                ))}

                <div className="mt-5 rounded-xl bg-[#0a1530]/70 p-4">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sky-400/50">Test Cases</span>
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
                            isActive ? "border-sky-400 text-sky-50" : "border-sky-500/20 text-sky-300/60 hover:border-sky-300/50"
                          } ${
                            status === "passed" ? "border-emerald-500/50 text-emerald-300" : status === "failed" ? "border-red-500/50 text-red-300" : ""
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="rounded-lg bg-[#060e22] p-3">
                      <span className="text-[9px] uppercase tracking-wider text-sky-400/50">Input</span>
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-sky-100/80">{activeTestcase?.input ?? ""}</pre>
                    </div>
                    <div className="rounded-lg bg-[#060e22] p-3">
                      <span className="text-[9px] uppercase tracking-wider text-sky-400/50">Expected</span>
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-emerald-200/80">{activeTestcase?.output ?? ""}</pre>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-[#0a1530]/60 p-2.5">
                    <span className="uppercase tracking-wider text-sky-400/50">Time</span>
                    <p className="mt-1 text-sky-100/70">{timeComplexity}</p>
                  </div>
                  <div className="rounded-lg bg-[#0a1530]/60 p-2.5">
                    <span className="uppercase tracking-wider text-sky-400/50">Space</span>
                    <p className="mt-1 text-sky-100/70">{spaceComplexity}</p>
                  </div>
                </div>

                {topics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {topics.map((topic) => (
                      <span key={topic} className="rounded-md border border-sky-500/15 bg-sky-500/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-sky-300/60">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}

          {!showQuestion && (
            <button
              type="button"
              onClick={() => setShowQuestion(true)}
              className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded-r-lg border border-l-0 border-sky-500/20 bg-[#060d1f]/80 px-2 py-6 text-[10px] uppercase tracking-wider text-sky-400/60 backdrop-blur-sm transition hover:border-sky-400/40 hover:text-sky-300"
            >
              Q
            </button>
          )}

          <div className="flex flex-1">
            <div className="relative flex w-1/2 flex-col border-r border-sky-500/10">
              <div className="relative flex-1 p-4">
                <div className="relative z-10 flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <select
                        value={language}
                        onChange={(e) => {
                          const normalized = normalizeLanguage(e.target.value);
                          setLanguage(normalized);
                          setCode((c) => (!c.trim() ? buildTemplate(normalized, question.title) : c));
                        }}
                        className="rounded-lg border border-sky-500/25 bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-100/85 focus:border-sky-300/70 focus:outline-none"
                      >
                        {availableLanguages.map((lang) => (
                          <option key={lang} value={lang}>
                            {languageLabels[lang] ?? lang}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSubmit("run")}
                        disabled={isSubmitting || isMatchOver}
                        className="rounded-lg border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300/60 disabled:opacity-50"
                      >
                        {isSubmitting ? "Running..." : "Run"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmit("submit")}
                        disabled={isSubmitting || isMatchOver}
                        className="rounded-lg border border-emerald-500/60 bg-emerald-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200 transition hover:border-emerald-400 disabled:opacity-50"
                      >
                        {isSubmitting ? "Submitting..." : "Submit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCode("")}
                        className="rounded-lg border border-slate-600/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sky-300/60 transition hover:border-sky-400/40 hover:text-sky-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-1 overflow-hidden rounded-2xl border border-slate-600/40 bg-[#020711] shadow-[0_0_60px_rgba(56,189,248,0.12)]">
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      spellCheck={false}
                      className="code-editor h-full w-full resize-none bg-transparent p-5 text-[14px] text-sky-100/90 focus:outline-none"
                      disabled={isMatchOver}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-sky-500/10 bg-[#060d1f]/70 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-sky-400/60">
                  <span>Console</span>
                  {feedback && (
                    <span className={`rounded-md border px-3 py-1 text-[10px] ${
                      feedbackTone === "success" ? "border-emerald-500/40 text-emerald-300"
                        : feedbackTone === "error" ? "border-red-500/40 text-red-300"
                          : "border-sky-500/30 text-sky-200"
                    }`}>
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
                          : status === "pending" ? "bg-amber-400" : "bg-slate-600";
                      return (
                        <button
                          key={`${tc.id}-console`}
                          type="button"
                          onClick={() => setActiveTestcaseIndex(i)}
                          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                            i === activeTestcaseIndex ? "border-sky-400 text-sky-100" : "border-slate-600/50 text-sky-300/60 hover:border-sky-400/30"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${indicator}`} />
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="uppercase tracking-wider text-sky-400/50">Status</span>
                        <p className="mt-0.5 text-sky-100/80">
                          {activeResult ? `${activeResult.status}` : results ? "Pending" : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-sky-400/50">Time</span>
                        <p className="mt-0.5 text-sky-100/80">{activeResult?.time ?? "—"}</p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-sky-400/50">Memory</span>
                        <p className="mt-0.5 text-sky-100/80">{activeResult?.memory != null ? `${activeResult.memory}` : "—"}</p>
                      </div>
                    </div>
                    {activeResult && !activeResult.passed && activeResult.actual && (
                      <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700/40 bg-[#030915] p-2 text-[10px] text-sky-100/75">
                        {activeResult.actual}
                      </pre>
                    )}
                    {activeResult?.stderr && (
                      <pre className="mt-2 max-h-16 overflow-auto whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-200/75">
                        {activeResult.stderr}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-1/2 flex-col">
              <div className={`flex flex-col items-center justify-center border-b border-${accentColor}-500/20 bg-[#060d1f]/60 px-6 py-4`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-${accentColor}-400/40 bg-${accentColor}-500/15 text-lg font-bold text-${accentColor}-200`}>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/></svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-sky-50">{botName}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border border-${accentColor}-500/30 bg-${accentColor}-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-${accentColor}-300`}>
                        {botDifficulty} · ~{formatDuration(botConfig.estimatedSeconds)}
                      </span>
                      <span className="text-[10px] text-sky-400/50">{botProgress.statusMessage}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`px-6 py-3 border-b border-${accentColor}-500/10 bg-[#060d1f]/40`}>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-sky-400/50 mb-1">
                  <span>Bot Progress</span>
                  <span>{Math.round(botProgress.overallProgress * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out bg-${accentColor}-500`}
                    style={{ width: `${botProgress.overallProgress * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[9px] uppercase tracking-wider">
                  <span className={`text-${accentColor}-300/70`}>{botProgress.stage}</span>
                  <span className="text-sky-400/50">
                    ~{formatDuration(botProgress.estimatedTimeRemaining)} remaining
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-4">
                <div className="h-full overflow-hidden rounded-2xl border border-slate-600/40 bg-[#020711] shadow-[0_0_40px_rgba(56,189,248,0.08)]">
                  <div className="border-b border-slate-700/30 px-4 py-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-sky-400/50">
                      <span className={`h-2 w-2 rounded-full bg-${accentColor}-500`} />
                      Bot Coding Activity
                    </div>
                  </div>
                  <div className="h-[calc(100%-36px)] overflow-y-auto p-5">
                    <pre className="whitespace-pre-wrap text-[13px] font-mono text-sky-100/70">
                      {botProgress.code || (
                        <span className="italic text-sky-500/40">
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

      {isMatchOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-3xl border ${matchResult === "won" ? "border-emerald-500/25" : matchResult === "bot_won" ? "border-red-500/25" : "border-amber-500/25"} bg-[#0c1425] p-8 text-sky-100 shadow-[0_0_60px_rgba(16,185,129,0.2)]`}>
            <div className="text-center">
              <div className="text-5xl mb-4">
                {matchResult === "won" ? <svg className="mx-auto h-16 w-16 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.015 6.015 0 01-2.52.52m0 0a6.015 6.015 0 01-2.52-.52"/></svg> : matchResult === "bot_won" ? <svg className="mx-auto h-16 w-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/></svg> : <svg className="mx-auto h-16 w-16 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>}
              </div>
              <h3 className={`text-3xl font-bold uppercase tracking-wider ${
                matchResult === "won" ? "text-emerald-200" : matchResult === "bot_won" ? "text-red-200" : "text-amber-200"
              }`}>
                {matchResult === "won" ? "Victory!" : matchResult === "bot_won" ? "Bot Wins" : "Draw"}
              </h3>
              <p className="mt-3 text-sm text-sky-200/70">
                {matchResult === "won"
                  ? "You solved the problem before the bot! Excellent work."
                  : matchResult === "bot_won"
                    ? `The ${botName} solved the problem first. Try a lower difficulty or practice more.`
                    : "You solved it, but the bot finished first too."}
              </p>
              {pointsAwarded !== null && (
                <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-8 py-4">
                  <svg className="h-8 w-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300/70">Points Earned</p>
                    <p className="text-3xl font-bold text-amber-200">{pointsAwarded}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setMatchResult("playing");
                  setPointsAwarded(null);
                  setResults(null);
                  setFeedback(null);
                  setFeedbackTone(null);
                  setCode(buildTemplate(normalizedInitialLanguage, question.title));
                  setElapsedTime(0);
                  startedAtRef.current = Date.now();
                }}
                className="rounded-full border border-emerald-400/70 bg-emerald-500/20 px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition hover:border-emerald-200 hover:bg-emerald-500/30"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => router.push("/game-modes")}
                className="rounded-full border border-sky-400/60 px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-sky-100 transition hover:border-sky-200 hover:bg-sky-500/30"
              >
                Back to Modes
              </button>
            </div>
          </div>
        </div>
      )}

      {showForfeitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/25 bg-[#0c1425] p-8 text-sky-100 shadow-[0_0_60px_rgba(248,113,113,0.2)]">
            <h3 className="text-2xl font-bold uppercase tracking-wider text-red-200">
              Forfeit Match?
            </h3>
            <p className="mt-3 text-sm text-sky-200/70">
              You will lose this bot battle. Are you sure you want to forfeit?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForfeitConfirm(false)}
                className="rounded-lg border border-sky-500/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
              >
                Keep Going
              </button>
              <button
                type="button"
                onClick={handleConfirmForfeit}
                className="rounded-lg border border-red-500/60 bg-red-500/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400"
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
