'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Difficulty = "easy" | "medium" | "hard";

type QuestionMeta = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: Difficulty;
  solved: boolean;
};

const difficultyOptions: Array<{ label: string; value: Difficulty; color: string }> = [
  { label: "Easy", value: "easy", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { label: "Medium", value: "medium", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { label: "Hard", value: "hard", color: "text-red-400 border-red-500/30 bg-red-500/10" },
];

const timerOptions = [
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 5 * 60 },
  { label: "15 minutes", value: 15 * 60 },
  { label: "30 minutes", value: 30 * 60 },
];

const languageOptions = [
  { label: "JavaScript (Node)", value: "node" },
  { label: "Python 3", value: "python" },
  { label: "C++", value: "cpp" },
  { label: "Java", value: "java" },
  { label: "C", value: "c" },
];

type Filter = "all" | Difficulty;

export function PracticeLobby() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [timer, setTimer] = useState<number>(5 * 60);
  const [language, setLanguage] = useState<string>(languageOptions[0].value);
  const [questions, setQuestions] = useState<QuestionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadQuestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/practice/questions");

        if (!response.ok) {
          throw new Error(`Failed to load questions (${response.status})`);
        }

        const data = (await response.json()) as { questions: QuestionMeta[] };

        if (isMounted) {
          setQuestions(data.questions);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("Unable to load problems. Please try again.");
          setQuestions([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadQuestions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredQuestions = useMemo(() => {
    if (filter === "all") {
      return questions;
    }
    return questions.filter((question) => question.difficulty === filter);
  }, [questions, filter]);

  const solvedCount = useMemo(
    () => questions.filter((question) => question.solved).length,
    [questions],
  );

  const countsByDifficulty = useMemo(() => {
    const counts: Record<Filter, number> = { all: questions.length, easy: 0, medium: 0, hard: 0 };
    for (const question of questions) {
      if (countsByDifficultyHas(question.difficulty)) {
        counts[question.difficulty] += 1;
      }
    }
    return counts;
  }, [questions]);

  const buildRouteKey = (question: QuestionMeta) =>
    typeof question.slug === "string" && question.slug.trim().length > 0
      ? question.slug.trim()
      : question.id;

  const sessionParams = useMemo(() => {
    const params = new URLSearchParams({ timer: String(timer), language });
    return params.toString();
  }, [timer, language]);

  const handleOpenQuestion = (question: QuestionMeta) => {
    router.push(`/practice/${encodeURIComponent(buildRouteKey(question))}?${sessionParams}`);
  };

  const handleRandom = () => {
    if (filteredQuestions.length === 0) {
      setError("No problems available yet for this filter.");
      return;
    }
    const pick = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    router.push(`/practice/${encodeURIComponent(buildRouteKey(pick))}?${sessionParams}`);
  };

  const progressPercent =
    questions.length > 0 ? Math.round((solvedCount / questions.length) * 100) : 0;

  const filters: Array<{ label: string; value: Filter }> = [
    { label: "All", value: "all" },
    ...difficultyOptions.map((option) => ({ label: option.label, value: option.value as Filter })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Problem Browser */}
      <div className="space-y-5">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                filter === option.value
                  ? "border-[rgba(var(--cr-accent-rgb),0.5)] bg-[rgba(var(--cr-accent-rgb),0.1)] text-[rgb(var(--cr-accent-rgb))]"
                  : "border-[var(--cr-border)] text-[var(--cr-fg-muted)] hover:border-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
              }`}
            >
              {option.label}
              <span className="ml-2 text-xs opacity-70">{countsByDifficulty[option.value]}</span>
            </button>
          ))}
        </div>

        {/* Solved progress */}
        <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[var(--cr-fg-muted)]">Solved</span>
            <span className="text-[var(--cr-fg)]">
              {solvedCount} / {questions.length}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--cr-bg-tertiary)]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Problem list */}
        <div className="overflow-hidden rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--cr-border)] px-5 py-3 text-xs uppercase tracking-wider text-[var(--cr-fg-muted)]">
            <span className="w-8">Status</span>
            <span>Problem</span>
            <span>Difficulty</span>
          </div>

          {loading && (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-[var(--cr-fg-muted)]">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading problems...
            </div>
          )}

          {!loading && filteredQuestions.length === 0 && (
            <p className="px-5 py-6 text-sm text-[var(--cr-fg-muted)]">
              {error ?? "No problems available yet for this filter."}
            </p>
          )}

          {!loading &&
            filteredQuestions.length > 0 &&
            filteredQuestions.map((question, index) => {
              const diff = difficultyOptions.find((option) => option.value === question.difficulty);
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => handleOpenQuestion(question)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--cr-border)] px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[var(--cr-bg-tertiary)]"
                >
                  <span className="flex w-8 items-center">
                    {question.solved ? (
                      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <span className="text-xs tabular-nums text-[var(--cr-fg-muted)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <span className="truncate pr-4 text-sm text-[var(--cr-fg)]">{question.title}</span>
                  {diff && (
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${diff.color}`}>
                      {diff.label}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Session settings */}
      <div className="space-y-6">
        <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5">
          <h3 className="mb-4 text-sm font-medium text-[var(--cr-fg)]">Session Settings</h3>

          <label className="mb-3 block text-sm text-[var(--cr-fg-muted)]">Timer</label>
          <select
            value={timer}
            onChange={(event) => setTimer(Number(event.target.value))}
            className="w-full rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2.5 text-sm text-[var(--cr-fg)] focus:border-[rgba(var(--cr-accent-rgb),0.5)] focus:outline-none focus:ring-1 focus:ring-[rgba(var(--cr-accent-rgb),0.5)]"
          >
            {timerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="mb-3 mt-5 block text-sm text-[var(--cr-fg-muted)]">Language</label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="w-full rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2.5 text-sm text-[var(--cr-fg)] focus:border-[rgba(var(--cr-accent-rgb),0.5)] focus:outline-none focus:ring-1 focus:ring-[rgba(var(--cr-accent-rgb),0.5)]"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRandom}
            disabled={loading || filteredQuestions.length === 0}
            className="mt-6 w-full rounded-lg border border-[rgba(var(--cr-accent-rgb),0.4)] bg-[rgba(var(--cr-accent-rgb),0.1)] px-6 py-3 text-sm font-semibold text-[rgb(var(--cr-accent-rgb))] transition-all hover:bg-[rgba(var(--cr-accent-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Surprise Me
          </button>
          <p className="mt-2 text-center text-xs text-[var(--cr-fg-muted)]">
            Random problem from the current filter
          </p>
        </div>
      </div>
    </div>
  );
}

function countsByDifficultyHas(value: string): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}
