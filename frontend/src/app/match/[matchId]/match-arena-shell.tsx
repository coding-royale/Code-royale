"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TetrioBattleBackground } from "@/components/battle/tetrio-battle-background";
import { OpponentActivityPanel } from "@/components/battle/opponent-activity-panel";

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
  cpp: `// TODO: solve "${"${title}"}"\n#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& raw) {\n    // write your solution\n    return raw;\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    stringstream buffer;\n    buffer << cin.rdbuf();\n    string input = buffer.str();\n\n    cout << solve(input);\n    return 0;\n}\n`,
  java: `// TODO: solve "${"${title}"}"\nimport java.io.*;\nimport java.util.*;\n\npublic class Main {\n  private static String solve(String raw) {\n    // write your solution\n    return raw;\n  }\n\n  public static void main(String[] args) throws Exception {\n    StringBuilder sb = new StringBuilder();\n    try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {\n      String line;\n      while ((line = br.readLine()) != null) {\n        if (sb.length() > 0) sb.append("\\n");\n        sb.append(line);\n      }\n    }\n    System.out.print(solve(sb.toString()));\n  }\n}\n`,
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
  const [isTimerActive, setIsTimerActive] = useState(true);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (!isTimerActive) return prev;
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive]);

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

  const matchId = useMemo(() => {
    const found = pathname?.match(/^\/match\/([^/?#]+)/);
    return found?.[1] ?? null;
  }, [pathname]);

  const statusForIndex = (index: number) => {
    const resolved = resultsMap.get(index);
    if (resolved) return resolved.passed ? "passed" : "failed";
    if (results && !resolved) return "pending";
    return "idle";
  };

  const handleExitRequest = () => setShowExitConfirm(true);
  const handleStayInSession = () => setShowExitConfirm(false);
  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    router.push(exitHref);
  };

  const handleSubmit = async (intent: SubmissionIntent) => {
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
          void fetch("/api/match/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId }),
          });
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
      setFeedback(
        "Unable to reach the judge. Check your configuration and try again.",
      );
      setFeedbackTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeLabel = modeLabels[matchMode] ?? matchMode.toUpperCase();

  return (
    <>
      <div className="battle-bg relative min-h-screen overflow-hidden">
        <TetrioBattleBackground />

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-sky-500/10 bg-[#060d1f]/80 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.4em] text-amber-400/70">
                  {modeLabel}
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
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5">
                <span className="text-[10px] uppercase tracking-[0.35em] text-amber-300/70">
                  Time
                </span>
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    timerSeconds <= 30
                      ? "text-red-400"
                      : timerSeconds <= 60
                        ? "text-amber-300"
                        : "text-sky-100"
                  }`}
                >
                  {timerState}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-sky-400/40 bg-sky-500/15 text-sm font-bold text-sky-200">
                  You
                </div>
                <span className="vs-text text-lg font-black uppercase text-amber-400">
                  VS
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-400/40 bg-red-500/15 text-sm font-bold text-red-200">
                  {modeLabel.includes("2v2") ? "T2" : modeLabel.includes("FFA") ? "FFA" : "R"}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExitRequest}
                className="rounded-lg border border-red-500/50 bg-red-500/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-red-300 transition hover:border-red-400 hover:text-red-200"
              >
                Surrender
              </button>
            </div>
          </header>

          <div className="relative z-10 flex flex-1 overflow-hidden">
            {showQuestion && (
              <aside className="flex w-[320px] shrink-0 flex-col border-r border-sky-500/10 bg-[#060d1f]/60 p-5 backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.35em] text-sky-400/60">
                    Challenge
                  </span>
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
                    <p key={i} className="mb-3">
                      {p}
                    </p>
                  ))}

                  <div className="mt-5 rounded-xl bg-[#0a1530]/70 p-4">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-sky-400/50">
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
                              isActive
                                ? "border-sky-400 text-sky-50"
                                : "border-sky-500/20 text-sky-300/60 hover:border-sky-300/50"
                            } ${
                              status === "passed"
                                ? "border-emerald-500/50 text-emerald-300"
                                : status === "failed"
                                  ? "border-red-500/50 text-red-300"
                                  : ""
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs">
                      <div className="rounded-lg bg-[#060e22] p-3">
                        <span className="text-[9px] uppercase tracking-wider text-sky-400/50">
                          Input
                        </span>
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-sky-100/80">
                          {activeTestcase?.input ?? ""}
                        </pre>
                      </div>
                      <div className="rounded-lg bg-[#060e22] p-3">
                        <span className="text-[9px] uppercase tracking-wider text-sky-400/50">
                          Expected
                        </span>
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-emerald-200/80">
                          {activeTestcase?.output ?? ""}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-lg bg-[#0a1530]/60 p-2.5">
                      <span className="uppercase tracking-wider text-sky-400/50">
                        Time
                      </span>
                      <p className="mt-1 text-sky-100/70">{timeComplexity}</p>
                    </div>
                    <div className="rounded-lg bg-[#0a1530]/60 p-2.5">
                      <span className="uppercase tracking-wider text-sky-400/50">
                        Space
                      </span>
                      <p className="mt-1 text-sky-100/70">{spaceComplexity}</p>
                    </div>
                  </div>

                  {topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-md border border-sky-500/15 bg-sky-500/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-sky-300/60"
                        >
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

            <div className="relative flex flex-1 flex-col">
              <div className="relative flex-1 p-4">
                <OpponentActivityPanel opponentName="Opponent" isVisible />

                <div className="relative z-10 flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <select
                        value={language}
                        onChange={(e) => {
                          const normalized = normalizeLanguage(e.target.value);
                          setLanguage(normalized);
                          setCode((c) =>
                            !c.trim()
                              ? buildTemplate(normalized, question.title)
                              : c,
                          );
                        }}
                        className="rounded-lg border border-sky-500/25 bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-100/85 focus:border-sky-300/70 focus:outline-none"
                      >
                        {availableLanguages.map((lang) => (
                          <option key={lang} value={lang}>
                            {languageLabels[lang] ?? lang}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] uppercase tracking-wider text-sky-400/40">
                        {languageLabels[language] ?? language}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSubmit("run")}
                        disabled={isSubmitting}
                        className="rounded-lg border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300/60 disabled:opacity-50"
                      >
                        {isSubmitting ? "Running..." : "Run"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmit("submit")}
                        disabled={isSubmitting}
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
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-sky-500/10 bg-[#060d1f]/70 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-sky-400/60">
                  <span>Console</span>
                  {feedback && (
                    <span
                      className={`rounded-md border px-3 py-1 text-[10px] ${
                        feedbackTone === "success"
                          ? "border-emerald-500/40 text-emerald-300"
                          : feedbackTone === "error"
                            ? "border-red-500/40 text-red-300"
                            : "border-sky-500/30 text-sky-200"
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
                      const indicator =
                        status === "passed"
                          ? "bg-emerald-500"
                          : status === "failed"
                            ? "bg-red-500"
                            : status === "pending"
                              ? "bg-amber-400"
                              : "bg-slate-600";
                      return (
                        <button
                          key={`${tc.id}-console`}
                          type="button"
                          onClick={() => setActiveTestcaseIndex(i)}
                          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-wider transition ${
                            i === activeTestcaseIndex
                              ? "border-sky-400 text-sky-100"
                              : "border-slate-600/50 text-sky-300/60 hover:border-sky-400/30"
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
                        <span className="uppercase tracking-wider text-sky-400/50">
                          Status
                        </span>
                        <p className="mt-0.5 text-sky-100/80">
                          {activeResult
                            ? `${activeResult.status} ${activeResult.passed ? "(passed)" : ""}`
                            : results
                              ? "Pending"
                              : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-sky-400/50">
                          Time
                        </span>
                        <p className="mt-0.5 text-sky-100/80">
                          {activeResult?.time ?? "—"}
                        </p>
                      </div>
                      <div>
                        <span className="uppercase tracking-wider text-sky-400/50">
                          Memory
                        </span>
                        <p className="mt-0.5 text-sky-100/80">
                          {activeResult?.memory != null
                            ? `${activeResult.memory}`
                            : "—"}
                        </p>
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
          </div>
        </div>
      </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/25 bg-[#0c1425] p-8 text-sky-100 shadow-[0_0_60px_rgba(248,113,113,0.2)]">
            <h3 className="text-2xl font-bold uppercase tracking-wider text-red-200">
              Surrender Match?
            </h3>
            <p className="mt-3 text-sm text-sky-200/70">
              You will forfeit this battle. Are you sure you want to surrender?
            </p>
            {matchMode === "ranked" && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Ranked Match Warning
                </p>
                <p className="mt-1 text-[11px] text-amber-200/70">
                  Surrendering a ranked match will cost you ELO points. Quit at your own risk.
                </p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleStayInSession}
                className="rounded-lg border border-sky-500/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-sky-200 transition hover:border-sky-300"
              >
                Keep Fighting
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="rounded-lg border border-red-500/60 bg-red-500/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.25em] text-red-200 transition hover:border-red-400"
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
