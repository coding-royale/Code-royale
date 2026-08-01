'use client';

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type PracticeTestcase = {
  id: string;
  input: string;
  output: string;
};

type PracticeArenaShellProps = {
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

export function PracticeArenaShell({ question, testcases, initialTimer, initialLanguage, exitHref = "/practice" }: PracticeArenaShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedInitialLanguage = normalizeLanguage(initialLanguage);
  const availableLanguages = useMemo(
    () => question.languages.map((lang) => normalizeLanguage(lang)),
    [question.languages],
  );
  const safeTestcases = testcases.length > 0
    ? testcases
    : [{ id: `${question.id}-fallback`, input: "", output: "" }];

  const [language, setLanguage] = useState(normalizedInitialLanguage);
  const [timerSeconds, setTimerSeconds] = useState(initialTimer);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [code, setCode] = useState(() => buildTemplate(normalizedInitialLanguage, question.title));
  const [results, setResults] = useState<SubmissionResult[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info" | null>(null);
  const [activeTestcaseIndex, setActiveTestcaseIndex] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (!isTimerActive) {
          return prev;
        }
        if (prev <= 0) {
          return 0;
        }
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
    if (timerSeconds === 0) {
      return "Time";
    }
    return formatDuration(timerSeconds);
  }, [timerSeconds]);

  const timeComplexity = question.meta?.timeComplexity ?? "To be determined";
  const spaceComplexity = question.meta?.spaceComplexity ?? "To be determined";
  const topics = Array.isArray(question.meta?.topics)
    ? (question.meta?.topics ?? []).filter(Boolean) as string[]
    : [];

  const resultsMap = useMemo(() => {
    if (!results) {
      return new Map<number, SubmissionResult>();
    }
    return new Map(results.map((result) => [result.index, result]));
  }, [results]);

  const activeResult = resultsMap.get(activeTestcaseIndex);
  const activeTestcase = safeTestcases[activeTestcaseIndex];

  const matchId = useMemo(() => {
    const found = pathname?.match(/^\/match\/([^/?#]+)/);
    return found?.[1] ?? null;
  }, [pathname]);

  const statusForIndex = (index: number) => {
    const resolved = resultsMap.get(index);
    if (resolved) {
      return resolved.passed ? "passed" : "failed";
    }
    if (results && !resolved) {
      return "pending";
    }
    return "idle";
  };

  const handleResetTimer = useCallback(() => {
    setTimerSeconds(initialTimer);
    setIsTimerActive(true);
  }, [initialTimer]);

  const handleLanguageChange = (value: string) => {
    const normalized = normalizeLanguage(value);
    setLanguage(normalized);
    setCode((current) => {
      if (!current.trim()) {
        return buildTemplate(normalized, question.title);
      }
      return current;
    });
  };

  const handleExitRequest = () => {
    setShowExitConfirm(true);
  };

  const handleStayInSession = () => {
    setShowExitConfirm(false);
  };

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
        const data = await response.json().catch(() => ({ error: "Submission failed." }));
        const message = data.error ?? "Submission failed.";
        setFeedback(message);
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

        setFeedback(intent === "submit" ? "✓ Correct! All test cases passed." : "All test cases passed.");
        setFeedbackTone("success");
      } else {
        setFeedback(intent === "submit" ? "Not yet. Try again!" : "Some test cases failed.");
        setFeedbackTone("error");
      }
    } catch (error) {
      console.error("Submission error", error);
      setFeedback("Unable to reach the judge. Check your configuration and try again.");
      setFeedbackTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="px-6 sm:px-8 lg:px-10 xl:px-12 2xl:px-16">
        <div className="flex min-h-[calc(100vh-140px)] w-full flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0a162b] px-6 py-5 shadow-[0_0_55px_rgba(56,189,248,0.22)]">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-sky-400/70">{question.difficulty} practice</p>
            <h1 className="text-3xl font-semibold uppercase text-sky-50 md:text-4xl">{question.title}</h1>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/30 bg-slate-900/70 px-5 py-3">
              <span className="text-[11px] uppercase tracking-[0.35em] text-sky-300/80">Time left</span>
              <span className={`text-xl font-semibold ${timerSeconds === 0 ? "text-red-300" : "text-sky-100"}`}>
                {timerState}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-sky-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-200 transition hover:border-sky-300"
                onClick={() => setIsTimerActive((state) => !state)}
              >
                {isTimerActive ? "Pause Timer" : "Resume Timer"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-sky-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-200 transition hover:border-sky-300"
                onClick={handleResetTimer}
              >
                Reset Timer
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSubmit("run")}
              disabled={isSubmitting}
              className="rounded-lg border border-sky-500/40 bg-sky-500/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-sky-50 shadow-[0_0_42px_rgba(56,189,248,0.32)] transition hover:border-sky-300 disabled:opacity-60"
            >
              {isSubmitting ? "Running..." : "Run Tests"}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("submit")}
              disabled={isSubmitting}
              className="rounded-lg border border-emerald-500/80 bg-emerald-500/25 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-50 shadow-[0_0_45px_rgba(16,185,129,0.45)] transition hover:border-emerald-400 disabled:opacity-60"
            >
              {isSubmitting ? "Submitting..." : "Submit Solution"}
            </button>
            <button
              type="button"
              onClick={() => setCode("")}
              className="rounded-lg border border-slate-600/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200 transition hover:border-sky-300"
            >
              Clear Editor
            </button>
            <button
              type="button"
              onClick={handleExitRequest}
              className="rounded-lg border border-red-500/60 bg-red-500/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-red-200 transition hover:border-red-400 hover:text-red-100"
            >
              Exit Session
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden bg-transparent">
          <article className="flex min-h-0 min-w-0 flex-[0.5] flex-col gap-6 pr-6">
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 text-sm leading-relaxed text-sky-100/85">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-sky-400/70">Question</p>
              <div className="mt-3 space-y-4">
                {question.description.split(/\n\n+/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-[#0c1d3d]/70 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  {safeTestcases.map((testcase, index) => {
                    const status = statusForIndex(index);
                    const isActive = index === activeTestcaseIndex;
                    const baseStyles = "rounded-lg border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.28em] transition";
                    const activeStyles = isActive
                      ? "border-sky-400 text-sky-50"
                      : "border-sky-500/25 text-sky-200/70 hover:border-sky-300/60";
                    const statusStyles = status === "passed"
                      ? "shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                      : status === "failed"
                        ? "border-red-500/50 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.35)]"
                        : status === "pending"
                          ? "border-amber-500/40 text-amber-200"
                          : "";

                    return (
                      <button
                        key={testcase.id ?? index}
                        type="button"
                        onClick={() => setActiveTestcaseIndex(index)}
                        className={`${baseStyles} ${activeStyles} ${statusStyles}`}
                      >
                        Case {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-sky-500/25 bg-[#071228] p-4">
                    <p className="text-[11px] uppercase tracking-[0.32em] text-sky-400/60">Input</p>
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-sm text-sky-100/85">
                      {activeTestcase?.input ?? ""}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-sky-500/25 bg-[#071228] p-4">
                    <p className="text-[11px] uppercase tracking-[0.32em] text-sky-400/60">Expected output</p>
                    <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-sm text-emerald-200/85">
                      {activeTestcase?.output ?? ""}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#0c1d3d]/70 p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-sky-400/60">Time complexity</p>
                  <p className="mt-3 text-sm text-sky-100/80">{timeComplexity}</p>
                </div>
                <div className="rounded-2xl bg-[#0c1d3d]/70 p-5">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-sky-400/60">Space complexity</p>
                  <p className="mt-3 text-sm text-sky-100/80">{spaceComplexity}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-[#0c1d3d]/70 p-5">
                <p className="text-[11px] uppercase tracking-[0.32em] text-sky-400/60">Key topics</p>
                {topics.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-lg border border-sky-500/25 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-sky-200"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-sky-100/65">
                    Topics will populate as we gather more submissions for this challenge.
                  </p>
                )}
              </div>
            </div>
          </article>

          <section className="flex min-h-0 min-w-0 flex-[0.5] flex-col gap-6 bg-[#050a18]/80 p-6 pl-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-[11px] uppercase tracking-[0.32em] text-sky-400/60">Language</label>
              <select
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value)}
                className="rounded-lg border border-sky-500/25 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100/85 focus:border-sky-300/70 focus:outline-none"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {languageLabels[lang] ?? lang}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-1 min-h-0 flex-col gap-6 overflow-hidden">
              <div className="flex-1 min-h-[420px]">
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  spellCheck={false}
                  className="h-full min-h-[420px] w-full resize-none rounded-2xl border border-slate-600/60 bg-[#030812] p-6 font-mono text-base text-sky-100 shadow-[0_0_48px_rgba(56,189,248,0.18)] focus:border-sky-300/70 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-slate-700/50 bg-[#050b18] p-5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-sky-400/70">
                  <span>Execution console</span>
                  <span className="rounded-lg border border-sky-500/25 px-3 py-1 text-[10px] text-sky-300">
                    {languageLabels[language] ?? language}
                  </span>
                </div>
                <div className="mt-3 space-y-4 text-sm text-sky-100/85">
                  {feedback && (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        feedbackTone === "success"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : feedbackTone === "error"
                            ? "border-red-500/40 bg-red-500/10 text-red-200"
                            : "border-sky-500/35 bg-sky-500/10 text-sky-100"
                      }`}
                    >
                      {feedback}
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-700/45 bg-[#030713] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {safeTestcases.map((testcase, index) => {
                        const status = statusForIndex(index);
                        const isActive = index === activeTestcaseIndex;

                        const statusIndicator = status === "passed"
                          ? "bg-emerald-500"
                          : status === "failed"
                            ? "bg-red-500"
                            : status === "pending"
                              ? "bg-amber-400"
                              : "bg-slate-600";

                        return (
                          <button
                            key={`${testcase.id}-console`}
                            type="button"
                            onClick={() => setActiveTestcaseIndex(index)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.28em] transition ${
                              isActive ? "border-sky-400 text-sky-100" : "border-slate-600/60 text-sky-200/70 hover:border-sky-400/40"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${statusIndicator}`} />
                            Case {index + 1}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-sky-100/85">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-sky-400/60">Status</p>
                        <p className="mt-1 text-sm">
                          {activeResult
                            ? `${activeResult.status} ${activeResult.passed ? "✓" : ""}`
                            : results
                              ? "Pending"
                              : "Run the tests to view output."}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-sky-400/60">Actual output</p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700/50 bg-[#040915] p-3 text-sm text-sky-100/90">
                          {activeResult?.actual ?? (results ? "(not produced)" : "")}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-sky-400/60">Expected output</p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-700/50 bg-[#040915] p-3 text-sm text-emerald-200/85">
                          {activeTestcase?.output ?? ""}
                        </pre>
                      </div>
                      {activeResult?.stderr && (
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.35em] text-red-400/70">stderr</p>
                          <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200/85">
                            {activeResult.stderr}
                          </pre>
                        </div>
                      )}
                      {activeResult && (
                        <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.25em] text-sky-200/70">
                          <span>Time {activeResult.time ?? "—"}</span>
                          <span>Memory {activeResult.memory != null ? activeResult.memory : "—"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-sky-500/25 bg-[#071126] p-8 text-sky-100 shadow-[0_0_60px_rgba(56,189,248,0.3)]">
            <h3 className="text-2xl font-semibold">Leave practice?</h3>
            <p className="mt-3 text-sm text-sky-200/80">
              This will end your current session and return you to the practice lobby. Are you sure you want to exit?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleStayInSession}
                className="rounded-lg border border-sky-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-200 transition hover:border-sky-300"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="rounded-lg border border-red-500/60 bg-red-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-red-200 transition hover:border-red-400"
              >
                Exit Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
