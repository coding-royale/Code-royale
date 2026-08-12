"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

const difficultyColors: Record<string, { badge: string }> = {
  easy: { badge: "text-emerald-600 dark:text-emerald-400" },
  medium: { badge: "text-amber-600 dark:text-amber-400" },
  hard: { badge: "text-red-600 dark:text-red-400" },
};

const feedbackToneClasses: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-accent text-accent-foreground",
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
  const [showSolvedModal, setShowSolvedModal] = useState(false);
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

  const timerPercent = useMemo(
    () => Math.max(0, Math.min(100, (timerSeconds / initialTimer) * 100)),
    [timerSeconds, initialTimer]
  );

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
        body: JSON.stringify({ questionId: question.id, language, code, intent }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Something went wrong. Please try again." }));
        setFeedback(data.error ?? "Something went wrong. Please try again.");
        setFeedbackTone("error");
        return;
      }

      const payload = await response.json() as { passed: boolean; solved: boolean; results: SubmissionResult[] };
      setResults(payload.results);

      if (payload.passed) {
        if (intent === "submit") {
          setShowSolvedModal(true);
        } else {
          setFeedback("All test cases passed");
          setFeedbackTone("success");
        }
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

  const statusDot = (status: string) =>
    status === "passed"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "pending"
          ? "bg-amber-400"
          : "bg-muted-foreground";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(exitHref)}
            className="shrink-0 text-muted-foreground"
          >
            <ArrowLeft data-icon="inline-start" />
            <span className="hidden sm:inline">Problem List</span>
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <span className="truncate text-sm font-medium text-foreground">{question.title}</span>
          <Badge variant="secondary" className={cn("shrink-0 capitalize", diffColor.badge)}>
            {question.difficulty}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 shadow-sm">
            <Clock className="size-4 text-muted-foreground" />
            <span className={cn("text-sm font-mono tabular-nums", timerSeconds === 0 ? "text-destructive" : "text-foreground")}>
              {timerState}
            </span>
            <Progress value={timerPercent} className="hidden w-20 md:flex [&_[data-slot=progress-track]]:h-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsTimerActive(!isTimerActive)}
              title={isTimerActive ? "Pause" : "Resume"}
              aria-label={isTimerActive ? "Pause timer" : "Resume timer"}
            >
              {isTimerActive ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleResetTimer}
              title="Reset timer"
              aria-label="Reset timer"
            >
              <RotateCcw />
            </Button>
          </div>

          {/* Language selector */}
          <Select value={language} onValueChange={(value) => value != null && handleLanguageChange(value)}>
            <SelectTrigger className="hidden sm:flex">
              <SelectValue placeholder="Language" />
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
      </header>

      {/* Main content with split panes */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left panel - Problem description */}
        <div
          className="flex flex-col overflow-hidden border-r border-border bg-background"
          style={{ width: `${leftPanelWidth}%` }}
        >
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "description" | "solutions")}>
            <TabsList variant="line" className="h-10 w-full justify-start rounded-none border-b border-border px-2">
              <TabsTrigger value="description" className="px-3">Description</TabsTrigger>
              <TabsTrigger value="solutions" className="px-3">Solutions</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "description" ? (
              <div className="flex flex-col gap-6">
                {/* Description */}
                <div>
                  {question.description.split(/\n\n+/).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground">
                      {p}
                    </p>
                  ))}
                </div>

                {/* Examples */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-foreground">Examples</h3>
                  {safeTestcases.slice(0, 2).map((tc, i) => (
                    <div key={tc.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="mb-2 text-xs font-medium text-muted-foreground">Example {i + 1}</div>
                      <div className="flex flex-col gap-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Input:</span>
                          <pre className="mt-1 rounded-lg bg-muted p-2 font-mono text-sm text-foreground">
                            {tc.input || "(empty)"}
                          </pre>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Output:</span>
                          <pre className="mt-1 rounded-lg bg-muted p-2 font-mono text-sm text-emerald-600 dark:text-emerald-400">
                            {tc.output || "(empty)"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-xs text-muted-foreground">Time Complexity</div>
                    <div className="mt-1 text-sm text-foreground">
                      {question.meta?.timeComplexity || "To be determined"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-xs text-muted-foreground">Space Complexity</div>
                    <div className="mt-1 text-sm text-foreground">
                      {question.meta?.spaceComplexity || "To be determined"}
                    </div>
                  </div>
                </div>

                {/* Topics */}
                {question.meta?.topics && question.meta.topics.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">Related Topics</div>
                    <div className="flex flex-wrap gap-2">
                      {question.meta.topics.map((topic) => (
                        <Badge key={topic} variant="secondary">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Lightbulb className="size-12 opacity-50" />
                  <p className="text-sm">Solutions will be available after solving</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div ref={resizerRef} className="split-pane-resizer shrink-0" />

        {/* Right panel - Code editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Code editor */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder={editorPlaceholder(language)}
              className="code-editor h-full w-full resize-none border-0 bg-background p-4 text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Console panel */}
          <div className={cn(
            "border-t border-border bg-card transition-all",
            consoleExpanded ? "h-64" : "h-10"
          )}>
            {/* Console header */}
            <div className="flex h-10 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setConsoleExpanded(!consoleExpanded)}
                  className="flex items-center gap-1 text-sm font-medium text-foreground"
                >
                  <span
                    className={cn(
                      "inline-flex size-4 items-center justify-center transition-transform",
                      consoleExpanded ? "" : "rotate-180"
                    )}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  Console
                </button>
                {consoleExpanded && (
                  <Tabs
                    value={consoleTab}
                    onValueChange={(value) => setConsoleTab(value as "testcase" | "result")}
                  >
                    <TabsList variant="line" className="h-7">
                      <TabsTrigger value="testcase" className="px-2.5 text-xs">Testcase</TabsTrigger>
                      <TabsTrigger value="result" className="px-2.5 text-xs">Result</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>

              {/* Feedback badge */}
              {feedback && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    feedbackToneClasses[feedbackTone ?? "info"]
                  )}
                >
                  {feedback}
                </span>
              )}
            </div>

            {/* Console content */}
            {consoleExpanded && (
              <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-4">
                {consoleTab === "testcase" ? (
                  <div className="flex flex-col gap-4">
                    {/* Test case tabs */}
                    <div className="flex flex-wrap gap-2">
                      {safeTestcases.map((tc, i) => {
                        const status = statusForIndex(i);
                        const isActive = i === activeTestcaseIndex;
                        return (
                          <button
                            key={tc.id}
                            onClick={() => setActiveTestcaseIndex(i)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                              isActive
                                ? "bg-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                            )}
                          >
                            <span className={cn("size-2 rounded-full", statusDot(status))} />
                            Case {i + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Input/Output */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Input</label>
                        <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-foreground">
                          {activeTestcase?.input || "(empty)"}
                        </pre>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Expected Output</label>
                        <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-emerald-600 dark:text-emerald-400">
                          {activeTestcase?.output || "(empty)"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {results ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {safeTestcases.map((tc, i) => {
                            const status = statusForIndex(i);
                            const isActive = i === activeTestcaseIndex;
                            return (
                              <button
                                key={tc.id}
                                onClick={() => setActiveTestcaseIndex(i)}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                                  isActive
                                    ? "bg-muted text-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                                )}
                              >
                                <span className={cn("size-2 rounded-full", statusDot(status))} />
                                Case {i + 1}
                              </button>
                            );
                          })}
                        </div>

                        {activeResult && (
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                Status:{" "}
                                <span className={activeResult.passed ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                                  {activeResult.status}
                                </span>
                              </span>
                              {activeResult.time && <span>Runtime: {activeResult.time}</span>}
                              {activeResult.memory != null && <span>Memory: {activeResult.memory} KB</span>}
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Your Output</label>
                              <pre className={cn(
                                "rounded-lg bg-muted p-3 font-mono text-sm",
                                activeResult.passed ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                              )}>
                                {activeResult.actual || "(empty)"}
                              </pre>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Expected</label>
                              <pre className="rounded-lg bg-muted p-3 font-mono text-sm text-emerald-600 dark:text-emerald-400">
                                {activeResult.expected || "(empty)"}
                              </pre>
                            </div>
                            {activeResult.stderr && (
                              <div>
                                <label className="mb-1 block text-xs text-destructive">Stderr</label>
                                <pre className="rounded-lg bg-destructive/10 p-3 font-mono text-sm text-destructive">
                                  {activeResult.stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        Run your code to see results
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCode("")}
              className="text-muted-foreground"
            >
              Reset Code
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubmit("run")}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Running..." : "Run"}
              </Button>
              <Button
                size="sm"
                onClick={() => handleSubmit("submit")}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Question solved modal */}
      <Dialog open={showSolvedModal} onOpenChange={setShowSolvedModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
              <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <DialogTitle className="text-xl">Question Solved!</DialogTitle>
            <DialogDescription>
              All test cases passed. This problem is now marked as solved on your profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false} className="justify-center">
            <Button variant="outline" onClick={() => setShowSolvedModal(false)}>
              Keep Coding
            </Button>
            <Button onClick={() => router.push(exitHref)}>
              Back to Problems
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit confirmation modal */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave practice session?</DialogTitle>
            <DialogDescription>
              Your current progress will not be saved. Are you sure you want to exit?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowExitConfirm(false);
                router.push(exitHref);
              }}
            >
              Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
