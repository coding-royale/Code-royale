"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PracticeTestcase = {
  id: string;
  input: string;
  output: string;
};

type PracticeArenaProps = {
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
  node: `function solve(raw) {\n  // enter your code here\n\n  return raw;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(String(solve(input)));\n`,
  javascript: `function solve(raw) {\n  // enter your code here\n\n  return raw;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nprocess.stdout.write(String(solve(input)));\n`,
  python: `def solve(raw: str) -> str:\n    # enter your code here\n\n    return raw\n\nimport sys\ninput_data = sys.stdin.read().strip()\nprint(solve(input_data))\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& raw) {\n    // enter your code here\n\n    return raw;\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    stringstream buffer;\n    buffer << cin.rdbuf();\n    string input = buffer.str();\n    cout << solve(input);\n    return 0;\n}\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  private static String solve(String raw) {\n    // enter your code here\n\n    return raw;\n  }\n\n  public static void main(String[] args) throws Exception {\n    StringBuilder sb = new StringBuilder();\n    try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {\n      String line;\n      while ((line = br.readLine()) != null) {\n        if (sb.length() > 0) sb.append("\\n");\n        sb.append(line);\n      }\n    }\n    System.out.print(solve(sb.toString()));\n  }\n}\n`,
  c: `#include <stdio.h>\n#include <string.h>\n\nvoid solve(const char *raw) {\n  // enter your code here\n\n  printf("%s", raw);\n}\n\nint main(void) {\n  char buffer[1 << 16];\n  size_t length = fread(buffer, 1, sizeof(buffer) - 1, stdin);\n  buffer[length] = '\\0';\n  solve(buffer);\n  return 0;\n}\n`,
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.max(seconds % 60, 0).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalizeLanguage = (value: string) => (value === "javascript" ? "node" : value);

const buildTemplate = (language: string, title: string) => {
  const key = normalizeLanguage(language);
  const template = codeTemplates[key];
  if (!template) return `// ${title}\n// enter your code here\n`;
  return template.replaceAll("${title}", title);
};

const editorPlaceholder = (language: string) =>
  normalizeLanguage(language) === "python" ? "# enter your code here" : "// enter your code here";

const summarizeError = (stderr: string | null) => {
  if (!stderr) return null;
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.includes("node:internal") && !l.startsWith("at "));
  if (!line) return null;
  return line.length > 90 ? `${line.slice(0, 87)}...` : line;
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  easy: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400" },
  hard: { bg: "bg-red-500/10", text: "text-red-400" },
};

export function PracticeArenaLeetcode({
  question,
  testcases,
  initialTimer,
  initialLanguage,
  exitHref = "/practice",
}: PracticeArenaProps) {
  const router = useRouter();
  const normalizedInitialLanguage = normalizeLanguage(initialLanguage);
  const availableLanguages = useMemo(
    () => question.languages.map((lang) => normalizeLanguage(lang)),
    [question.languages]
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
  const [leftPanelWidth, setLeftPanelWidth] = useState(45);
  const [activeTab, setActiveTab] = useState<"description" | "solutions">("description");
  const [consoleTab, setConsoleTab] = useState<"testcase" | "result">("testcase");
  const [consoleExpanded, setConsoleExpanded] = useState(true);

  const resizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (!isTimerActive || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive]);

  // Resizer logic
  useEffect(() => {
    const resizer = resizerRef.current;
    const container = containerRef.current;
    if (!resizer || !container) return;

    let isResizing = false;

    const onMouseDown = () => {
      isResizing = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftPanelWidth(Math.min(Math.max(newWidth, 25), 75));
    };

    const onMouseUp = () => {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    resizer.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      resizer.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    setResults(null);
    setFeedback(null);
    setFeedbackTone(null);
  }, [language]);

  const timerState = useMemo(() => {
    if (timerSeconds === 0) return "Time's up!";
    return formatDuration(timerSeconds);
  }, [timerSeconds]);

  const resultsMap = useMemo(() => {
    if (!results) return new Map<number, SubmissionResult>();
    return new Map(results.map((r) => [r.index, r]));
  }, [results]);

  const activeResult = resultsMap.get(activeTestcaseIndex);
  const activeTestcase = safeTestcases[activeTestcaseIndex];
  const diffColor = difficultyColors[question.difficulty] || difficultyColors.medium;

  const statusForIndex = (index: number) => {
    const resolved = resultsMap.get(index);
    if (resolved) return resolved.passed ? "passed" : "failed";
    if (results && !resolved) return "pending";
    return "idle";
  };

  const handleResetTimer = useCallback(() => {
    setTimerSeconds(initialTimer);
    setIsTimerActive(true);
  }, [initialTimer]);

  const handleLanguageChange = (value: string) => {
    const normalized = normalizeLanguage(value);
    setLanguage(normalized);
    setCode((current) => (!current.trim() ? buildTemplate(normalized, question.title) : current));
  };

  const handleSubmit = async (intent: "run" | "submit") => {
    if (!code.trim()) {
      setFeedback("Write some code before running your solution.");
      setFeedbackTone("info");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setFeedbackTone(null);
    setResults(null);
    setConsoleTab("result");

    try {
      const response = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, language, code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Something went wrong. Please try again." }));
        setFeedback(data.error ?? "Something went wrong. Please try again.");
        setFeedbackTone("error");
        return;
      }

      const payload = await response.json() as { passed: boolean; results: SubmissionResult[] };
      setResults(payload.results);

      if (payload.passed) {
        setFeedback(intent === "submit" ? "Accepted" : "All test cases passed");
        setFeedbackTone("success");
      } else {
        const failed = payload.results.find((r) => !r.passed);
        const errorLine = failed ? summarizeError(failed.stderr) : null;
        setFeedback(
          errorLine ??
            (failed?.status === "Compilation Error"
              ? "Compilation error"
              : failed?.status === "Runtime Error"
                ? "Runtime error"
                : intent === "submit"
                  ? "Wrong answer"
                  : "Some tests failed"),
        );
        setFeedbackTone("error");
      }
    } catch {
      setFeedback("Couldn't run your code. Please try again.");
      setFeedbackTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--cr-bg)]">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-[var(--cr-fg-muted)] transition-colors hover:bg-[var(--cr-bg-tertiary)] hover:text-[var(--cr-fg)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Problem List</span>
          </button>
          <div className="h-4 w-px bg-[var(--cr-border)]" />
          <span className="text-sm font-medium text-[var(--cr-fg)]">{question.title}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${diffColor.bg} ${diffColor.text}`}>
            {question.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-2 rounded-md border border-[var(--cr-border)] bg-[var(--cr-bg)] px-3 py-1">
            <svg className="h-4 w-4 text-[var(--cr-fg-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm font-mono ${timerSeconds === 0 ? "text-red-400" : "text-[var(--cr-fg)]"}`}>
              {timerState}
            </span>
            <button
              onClick={() => setIsTimerActive(!isTimerActive)}
              className="text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
              title={isTimerActive ? "Pause" : "Resume"}
            >
              {isTimerActive ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleResetTimer}
              className="text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
              title="Reset timer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>

          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="rounded-md border border-[var(--cr-border)] bg-[var(--cr-bg)] px-3 py-1.5 text-sm text-[var(--cr-fg)] focus:outline-none focus:ring-1 focus:ring-[rgba(var(--cr-accent-rgb),0.5)]"
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageLabels[lang] ?? lang}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main content with split panes */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left panel - Problem description */}
        <div
          className="flex flex-col overflow-hidden border-r border-[var(--cr-border)]"
          style={{ width: `${leftPanelWidth}%` }}
        >
          {/* Tabs */}
          <div className="flex border-b border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
            <button
              onClick={() => setActiveTab("description")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "description"
                  ? "border-b-2 border-[rgb(var(--cr-accent-rgb))] text-[rgb(var(--cr-accent-rgb))]"
                  : "text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab("solutions")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "solutions"
                  ? "border-b-2 border-[rgb(var(--cr-accent-rgb))] text-[rgb(var(--cr-accent-rgb))]"
                  : "text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
              }`}
            >
              Solutions
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "description" ? (
              <div className="space-y-6">
                {/* Description */}
                <div className="prose prose-invert max-w-none">
                  {question.description.split(/\n\n+/).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-[var(--cr-fg)]">
                      {p}
                    </p>
                  ))}
                </div>

                {/* Examples */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--cr-fg)]">Examples</h3>
                  {safeTestcases.slice(0, 2).map((tc, i) => (
                    <div key={tc.id} className="rounded-lg bg-[var(--cr-bg-secondary)] p-4">
                      <div className="mb-2 text-xs font-medium text-[var(--cr-fg-muted)]">Example {i + 1}</div>
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-[var(--cr-fg-muted)]">Input:</span>
                          <pre className="mt-1 rounded bg-[var(--cr-bg)] p-2 font-mono text-sm text-[var(--cr-fg)]">
                            {tc.input || "(empty)"}
                          </pre>
                        </div>
                        <div>
                          <span className="text-xs text-[var(--cr-fg-muted)]">Output:</span>
                          <pre className="mt-1 rounded bg-[var(--cr-bg)] p-2 font-mono text-sm text-emerald-400">
                            {tc.output || "(empty)"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-[var(--cr-bg-secondary)] p-4">
                    <div className="text-xs text-[var(--cr-fg-muted)]">Time Complexity</div>
                    <div className="mt-1 text-sm text-[var(--cr-fg)]">
                      {question.meta?.timeComplexity || "To be determined"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--cr-bg-secondary)] p-4">
                    <div className="text-xs text-[var(--cr-fg-muted)]">Space Complexity</div>
                    <div className="mt-1 text-sm text-[var(--cr-fg)]">
                      {question.meta?.spaceComplexity || "To be determined"}
                    </div>
                  </div>
                </div>

                {/* Topics */}
                {question.meta?.topics && question.meta.topics.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs text-[var(--cr-fg-muted)]">Related Topics</div>
                    <div className="flex flex-wrap gap-2">
                      {question.meta.topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-[var(--cr-bg-secondary)] px-3 py-1 text-xs text-[var(--cr-fg)]"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--cr-fg-muted)]">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="mt-2 text-sm">Solutions will be available after solving</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          ref={resizerRef}
          className="w-1 cursor-col-resize bg-[var(--cr-border)] transition-colors hover:bg-[rgba(var(--cr-accent-rgb),0.5)]"
        />

        {/* Right panel - Code editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Code editor */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder={editorPlaceholder(language)}
              className="code-editor h-full w-full resize-none border-0 bg-[var(--cr-bg)] p-4 text-[var(--cr-fg)] placeholder:text-[var(--cr-fg-muted)] focus:outline-none"
            />
          </div>

          {/* Console panel */}
          <div className={`border-t border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] transition-all ${consoleExpanded ? "h-64" : "h-10"}`}>
            {/* Console header */}
            <div className="flex h-10 items-center justify-between border-b border-[var(--cr-border)] px-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setConsoleExpanded(!consoleExpanded)}
                  className="flex items-center gap-1 text-sm font-medium text-[var(--cr-fg)]"
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${consoleExpanded ? "" : "rotate-180"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Console
                </button>
                {consoleExpanded && (
                  <div className="flex">
                    <button
                      onClick={() => setConsoleTab("testcase")}
                      className={`px-3 py-1 text-xs font-medium ${
                        consoleTab === "testcase"
                          ? "text-[rgb(var(--cr-accent-rgb))]"
                          : "text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
                      }`}
                    >
                      Testcase
                    </button>
                    <button
                      onClick={() => setConsoleTab("result")}
                      className={`px-3 py-1 text-xs font-medium ${
                        consoleTab === "result"
                          ? "text-[rgb(var(--cr-accent-rgb))]"
                          : "text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
                      }`}
                    >
                      Result
                    </button>
                  </div>
                )}
              </div>

              {/* Feedback badge */}
              {feedback && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    feedbackTone === "success"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : feedbackTone === "error"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {feedback}
                </span>
              )}
            </div>

            {/* Console content */}
            {consoleExpanded && (
              <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-4">
                {consoleTab === "testcase" ? (
                  <div className="space-y-4">
                    {/* Test case tabs */}
                    <div className="flex gap-2">
                      {safeTestcases.map((tc, i) => {
                        const status = statusForIndex(i);
                        const isActive = i === activeTestcaseIndex;
                        return (
                          <button
                            key={tc.id}
                            onClick={() => setActiveTestcaseIndex(i)}
                            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                              isActive
                                ? "bg-[var(--cr-bg-tertiary)] text-[var(--cr-fg)]"
                                : "text-[var(--cr-fg-muted)] hover:bg-[var(--cr-bg)] hover:text-[var(--cr-fg)]"
                            }`}
                          >
                            {status === "passed" && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                            {status === "failed" && <span className="h-2 w-2 rounded-full bg-red-500" />}
                            Case {i + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Input/Output */}
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs text-[var(--cr-fg-muted)]">Input</label>
                        <pre className="rounded bg-[var(--cr-bg)] p-3 font-mono text-sm text-[var(--cr-fg)]">
                          {activeTestcase?.input || "(empty)"}
                        </pre>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-[var(--cr-fg-muted)]">Expected Output</label>
                        <pre className="rounded bg-[var(--cr-bg)] p-3 font-mono text-sm text-emerald-400">
                          {activeTestcase?.output || "(empty)"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results ? (
                      <>
                        <div className="flex gap-2">
                          {safeTestcases.map((tc, i) => {
                            const status = statusForIndex(i);
                            const isActive = i === activeTestcaseIndex;
                            return (
                              <button
                                key={tc.id}
                                onClick={() => setActiveTestcaseIndex(i)}
                                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                                  isActive
                                    ? "bg-[var(--cr-bg-tertiary)] text-[var(--cr-fg)]"
                                    : "text-[var(--cr-fg-muted)] hover:bg-[var(--cr-bg)] hover:text-[var(--cr-fg)]"
                                }`}
                              >
                                {status === "passed" && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                                {status === "failed" && <span className="h-2 w-2 rounded-full bg-red-500" />}
                                Case {i + 1}
                              </button>
                            );
                          })}
                        </div>

                        {activeResult && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 text-xs text-[var(--cr-fg-muted)]">
                              <span>Status: <span className={activeResult.passed ? "text-emerald-400" : "text-red-400"}>{activeResult.status}</span></span>
                              {activeResult.time && <span>Runtime: {activeResult.time}</span>}
                              {activeResult.memory && <span>Memory: {activeResult.memory} KB</span>}
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[var(--cr-fg-muted)]">Your Output</label>
                              <pre className={`rounded bg-[var(--cr-bg)] p-3 font-mono text-sm ${activeResult.passed ? "text-emerald-400" : "text-red-400"}`}>
                                {activeResult.actual || "(empty)"}
                              </pre>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-[var(--cr-fg-muted)]">Expected</label>
                              <pre className="rounded bg-[var(--cr-bg)] p-3 font-mono text-sm text-emerald-400">
                                {activeResult.expected || "(empty)"}
                              </pre>
                            </div>
                            {activeResult.stderr && (
                              <div>
                                <label className="mb-1 block text-xs text-red-400">Stderr</label>
                                <pre className="rounded bg-red-500/5 p-3 font-mono text-sm text-red-400">
                                  {activeResult.stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-32 items-center justify-center text-sm text-[var(--cr-fg-muted)]">
                        Run your code to see results
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] px-4 py-3">
            <button
              onClick={() => setCode("")}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--cr-fg-muted)] transition-colors hover:bg-[var(--cr-bg-tertiary)] hover:text-[var(--cr-fg)]"
            >
              Reset Code
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSubmit("run")}
                disabled={isSubmitting}
                className="rounded-md border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-1.5 text-sm font-medium text-[var(--cr-fg)] transition-colors hover:bg-[var(--cr-bg-tertiary)] disabled:opacity-50"
              >
                {isSubmitting ? "Running..." : "Run"}
              </button>
              <button
                onClick={() => handleSubmit("submit")}
                disabled={isSubmitting}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--cr-fg)]">Leave practice session?</h3>
            <p className="mt-2 text-sm text-[var(--cr-fg-muted)]">
              Your current progress will not be saved. Are you sure you want to exit?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-[var(--cr-fg-muted)] transition-colors hover:bg-[var(--cr-bg-tertiary)] hover:text-[var(--cr-fg)]"
              >
                Stay
              </button>
              <button
                onClick={() => router.push(exitHref)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
