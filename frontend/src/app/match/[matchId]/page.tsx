import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { PracticeScaffold } from "@/app/practice/practice-scaffold";
import { MatchArenaShell } from "./match-arena-shell";

type PageProps = {
  params: { matchId: string };
};

function parseTimerFromMetadata(metadata: unknown) {
  const record = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  const questionId = record?.question_id;
  const timeLimit = record?.time_limit;
  const startedAt = record?.started_at;
  const language = record?.language;

  return {
    questionId: typeof questionId === "string" ? questionId : null,
    timeLimitSeconds: typeof timeLimit === "number" ? timeLimit : Number(timeLimit),
    startedAt: typeof startedAt === "string" ? startedAt : null,
    language: typeof language === "string" ? language : null,
  };
}

function computeInitialTimer(startedAt: string | null | undefined, timeLimit: number): number {
  if (!startedAt) return timeLimit;
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return timeLimit;
  const elapsedSeconds = Math.floor((Date.now() - startedMs) / 1000);
  return Math.max(timeLimit - elapsedSeconds, 0);
}

function parseMatchMode(metadata: unknown, mode: string | null): string {
  const record = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  const metadataMode = record?.match_type ?? record?.mode;
  if (typeof metadataMode === "string" && metadataMode) return metadataMode;
  if (typeof mode === "string" && mode) return mode;
  return "ranked";
}

export default async function MatchPage({ params }: PageProps) {
  const matchId = params.matchId;
  const supabase = await createSupabaseServerClient();

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    redirect("/auth/login");
  }

  const { data: membership } = await supabase
    .from("match_players")
    .select("match_id")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select("id,mode,metadata")
    .eq("id", matchId)
    .single();

  if (matchError || !matchRow) {
    notFound();
  }

  const { questionId, timeLimitSeconds, startedAt, language } = parseTimerFromMetadata(matchRow.metadata);
  const matchMode = parseMatchMode(matchRow.metadata, matchRow.mode);

  if (!questionId) {
    notFound();
  }

  const { data: question, error: questionError } = await supabase
    .from("practice_questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (questionError || !question) {
    notFound();
  }

  const rawLanguages = Array.isArray(question.languages)
    ? (question.languages as string[]).filter((lang): lang is string => typeof lang === "string" && !!lang)
    : ["javascript", "python", "cpp"];

  const languages = rawLanguages.length > 0 ? rawLanguages : ["javascript", "python", "cpp"];
  const normalizedSelectedLanguage = typeof language === "string" ? language.trim().toLowerCase() : "";
  const selectedLanguage =
    normalizedSelectedLanguage && languages.includes(normalizedSelectedLanguage)
      ? normalizedSelectedLanguage
      : null;
  const initialLanguage = selectedLanguage ?? languages[0] ?? "javascript";

  const rawTestcases = Array.isArray(question.testcases)
    ? (question.testcases as Array<{ id?: string; input?: string; output?: string; stdin?: string; expected_output?: string }>)
    : [];

  let testcases = rawTestcases.map((testcase, index) => ({
    id: testcase.id ?? `${question.id}-case-${index + 1}`,
    input: testcase.input ?? testcase.stdin ?? "",
    output: testcase.output ?? testcase.expected_output ?? "",
  }));

  if (testcases.length === 0) {
    const { data: legacyTestcases } = await supabase
      .from("practice_testcases")
      .select("id,stdin,expected_output")
      .eq("question_id", question.id)
      .order("id", { ascending: true });

    testcases = (legacyTestcases ?? []).map((testcase, index) => ({
      id: String(testcase.id ?? `${question.id}-legacy-${index + 1}`),
      input: testcase.stdin ?? "",
      output: testcase.expected_output ?? "",
    }));
  }

  const meta = question.meta && typeof question.meta === "object" ? question.meta : null;

  const timeLimit = Number.isFinite(timeLimitSeconds) && (timeLimitSeconds as number) > 0 ? (timeLimitSeconds as number) : 8 * 60;

  const initialTimer = computeInitialTimer(startedAt, timeLimit);

  return (
    <PracticeScaffold>
      <MatchArenaShell
        question={{
          id: question.id,
          title: question.title,
          description: question.description,
          difficulty: question.difficulty,
          languages,
          meta: meta as {
            timeComplexity?: string | null;
            spaceComplexity?: string | null;
            topics?: string[] | null;
          } | null,
        }}
        testcases={testcases}
        initialTimer={initialTimer}
        initialLanguage={initialLanguage}
        exitHref="/game-modes"
        matchMode={matchMode}
      />
    </PracticeScaffold>
  );
}
