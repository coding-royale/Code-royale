"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Languages, Shuffle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Difficulty = "easy" | "medium" | "hard";

type QuestionMeta = {
  id: string;
  title: string;
  slug: string | null;
  difficulty: Difficulty;
  solved: boolean;
};

const difficultyOptions: Array<{ label: string; value: Difficulty; badgeClass: string }> = [
  { label: "Easy", value: "easy", badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { label: "Medium", value: "medium", badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { label: "Hard", value: "hard", badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400" },
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
      <div className="flex flex-col gap-5">
        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="h-9 w-fit">
            {filters.map((option) => (
              <TabsTrigger key={option.value} value={option.value} className="gap-1.5 px-3">
                {option.label}
                <span className="text-xs text-muted-foreground">{countsByDifficulty[option.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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

        {/* Problem list */}
        <Card className="overflow-hidden shadow-sm">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="w-8">Status</span>
            <span>Problem</span>
            <span>Difficulty</span>
          </div>

          {loading && (
            <div className="flex flex-col gap-4 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredQuestions.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
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
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-accent/50"
                >
                  <span className="flex w-8 items-center">
                    {question.solved ? (
                      <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <span className="truncate pr-4 text-sm text-foreground">{question.title}</span>
                  {diff && (
                    <Badge variant="outline" className={diff.badgeClass}>
                      {diff.label}
                    </Badge>
                  )}
                </button>
              );
            })}
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
              <Select value={String(timer)} onValueChange={(value) => value != null && setTimer(Number(value))}>
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
              <Select value={language} onValueChange={(value) => value != null && setLanguage(value)}>
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
              disabled={loading || filteredQuestions.length === 0}
              className="w-full"
            >
              <Shuffle data-icon="inline-start" />
              Surprise Me
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Random problem from the current filter
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function countsByDifficultyHas(value: string): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}
