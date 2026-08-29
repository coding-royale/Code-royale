"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Languages,
  Search,
  Shuffle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getPracticePrefs, setPracticePrefs } from "@/lib/practice-preferences";

type Difficulty = "easy" | "medium" | "hard";

type QuestionMeta = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: Difficulty;
  solved: boolean;
};

type DifficultyFilter = "all" | Difficulty;
type StatusFilter = "all" | "solved" | "unsolved";
type SortKey = "default" | "title-asc" | "title-desc" | "difficulty-asc" | "difficulty-desc";

const difficultyOrder: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

const difficultyText: Record<Difficulty, string> = {
  easy: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  hard: "text-red-600 dark:text-red-400",
};

const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

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

export function PracticeLobby() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [timer, setTimer] = useState<number>(5 * 60);
  const [language, setLanguage] = useState<string>(languageOptions[0].value);

  const [questions, setQuestions] = useState<QuestionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await fetch("/api/practice/questions");
        if (!response.ok) throw new Error(`Failed to load questions (${response.status})`);
        const data = (await response.json()) as { questions: QuestionMeta[] };
        if (!cancelled) setQuestions(data.questions);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Unable to load problems. Please try again.");
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply stored session prefs after mount (client-only) to avoid a hydration
  // mismatch between server and client first render.
  useEffect(() => {
    const prefs = getPracticePrefs();
    if (typeof prefs.timer === "number") setTimer(prefs.timer);
    if (typeof prefs.language === "string") setLanguage(prefs.language);
  }, []);

  const solvedCount = useMemo(
    () => questions.filter((question) => question.solved).length,
    [questions],
  );

  const countsByDifficulty = useMemo(() => {
    const counts: Record<DifficultyFilter, number> = {
      all: questions.length,
      easy: 0,
      medium: 0,
      hard: 0,
    };
    for (const question of questions) {
      if (question.difficulty === "easy" || question.difficulty === "medium" || question.difficulty === "hard") {
        counts[question.difficulty] += 1;
      }
    }
    return counts;
  }, [questions]);

  const normalizeTitle = (value: string) => value.trim().toLowerCase();

  const visibleQuestions = useMemo(() => {
    const query = normalizeTitle(search);

    let list = questions;
    if (difficulty !== "all") {
      list = list.filter((question) => question.difficulty === difficulty);
    }
    if (status === "solved") {
      list = list.filter((question) => question.solved);
    } else if (status === "unsolved") {
      list = list.filter((question) => !question.solved);
    }
    if (query) {
      list = list.filter((question) => normalizeTitle(question.title).includes(query));
    }

    const sorted = [...list];
    switch (sortKey) {
      case "title-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "difficulty-asc":
        sorted.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
        break;
      case "difficulty-desc":
        sorted.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]);
        break;
      case "default":
      default:
        break;
    }
    return sorted;
  }, [questions, search, difficulty, status, sortKey]);

  const buildRouteKey = (question: QuestionMeta) =>
    typeof question.slug === "string" && question.slug.trim().length > 0
      ? question.slug.trim()
      : question.id;

  const handleOpenQuestion = (question: QuestionMeta) => {
    router.push(`/practice/${encodeURIComponent(buildRouteKey(question))}`);
  };

  const handleRandom = () => {
    if (visibleQuestions.length === 0) {
      setError("No problems available yet for this filter.");
      return;
    }
    const pick = visibleQuestions[Math.floor(Math.random() * visibleQuestions.length)];
    router.push(`/practice/${encodeURIComponent(buildRouteKey(pick))}`);
  };

  const handleTimerChange = (value: string | null) => {
    if (value == null) return;
    const next = Number(value);
    setTimer(next);
    setPracticePrefs({ timer: next });
  };

  const handleLanguageChange = (value: string | null) => {
    if (value == null) return;
    setLanguage(value);
    setPracticePrefs({ language: value });
  };

  const progressPercent =
    questions.length > 0 ? Math.round((solvedCount / questions.length) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Problem browser */}
      <div className="flex flex-col gap-5">
        {/* Solved progress */}
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                Solved
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {solvedCount} / {questions.length}
              </span>
            </div>
            <Progress value={progressPercent} className="[&_[data-slot=progress-track]]:h-2" />
          </CardContent>
        </Card>

        {/* Toolbar */}
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search problems…"
                className="pl-9"
                aria-label="Search problems"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={difficulty} onValueChange={(value) => value != null && setDifficulty(value as DifficultyFilter)}>
                <SelectTrigger className="w-[8.5rem]">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All difficulties</SelectItem>
                  <SelectItem value="easy">Easy · {countsByDifficulty.easy}</SelectItem>
                  <SelectItem value="medium">Medium · {countsByDifficulty.medium}</SelectItem>
                  <SelectItem value="hard">Hard · {countsByDifficulty.hard}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(value) => value != null && setStatus(value as StatusFilter)}>
                <SelectTrigger className="w-[8.5rem]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="unsolved">Unsolved</SelectItem>
                  <SelectItem value="solved">Solved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortKey} onValueChange={(value) => value != null && setSortKey(value as SortKey)}>
                <SelectTrigger className="w-[10.5rem]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default order</SelectItem>
                  <SelectItem value="title-asc">Title A–Z</SelectItem>
                  <SelectItem value="title-desc">Title Z–A</SelectItem>
                  <SelectItem value="difficulty-asc">Difficulty: Easy first</SelectItem>
                  <SelectItem value="difficulty-desc">Difficulty: Hard first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Problem list */}
        <Card className="overflow-hidden shadow-sm">
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-border px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="w-8">Status</span>
            <span className="pl-2">Problem</span>
            <span>Difficulty</span>
            <span className="w-4" />
          </div>

          {loading && (
            <div className="flex flex-col gap-4 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                  <Skeleton className="size-6" />
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="size-4" />
                </div>
              ))}
            </div>
          )}

          {!loading && visibleQuestions.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              {error ?? "No problems match your filters."}
            </p>
          )}

          {!loading &&
            visibleQuestions.length > 0 &&
            visibleQuestions.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => handleOpenQuestion(question)}
                className="group grid w-full cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                aria-label={`Open ${question.title}`}
              >
                <span className="flex w-8 items-center justify-start">
                  {question.solved ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {String(visibleQuestions.indexOf(question) + 1).padStart(2, "0")}
                    </span>
                  )}
                </span>

                <span className="truncate pl-2 pr-4 text-sm font-medium text-foreground transition-colors group-hover:text-primary group-hover:underline">
                  {question.title}
                </span>

                <span className={`text-xs font-medium uppercase tracking-wide ${difficultyText[question.difficulty]}`}>
                  {difficultyLabels[question.difficulty]}
                </span>

                <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
        </Card>
      </div>

      {/* Session settings */}
      <div className="flex flex-col gap-6">
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle>Session Settings</CardTitle>
            <CardDescription>Set your timer and language before jumping in.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                Timer
              </span>
              <Select value={String(timer)} onValueChange={handleTimerChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timer" />
                </SelectTrigger>
                <SelectContent>
                  {timerOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Languages className="size-4" />
                Language
              </span>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRandom}
              disabled={loading || visibleQuestions.length === 0}
              className="w-full"
            >
              <Shuffle data-icon="inline-start" />
              Surprise Me
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Random problem from the current filters
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}