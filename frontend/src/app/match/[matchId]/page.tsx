import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { resolveMatchIdFromParams } from "@/lib/matchmaking";
import { DEFAULT_TIME_LIMIT_SECONDS, sanitizeTimeLimit, shouldRedirectOffDecidedMatch } from "@/lib/match-room";
import { MatchArenaShell } from "./match-arena-shell";

type PageProps = {
  params: Promise<{ matchId: string }> | { matchId: string };
};

function parseMatchMetadata(metadata: unknown) {
  const record = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  return {
    questionId: typeof record?.question_id === "string" ? record.question_id : null,
    timeLimit: record?.time_limit,
    // Null while the room is still filling: the clock has not started yet.
    startedAt: typeof record?.started_at === "string" && record.started_at ? record.started_at : null,
    language: typeof record?.language === "string" ? record.language : null,
  };
}

function parseMatchType(metadata: unknown): string {
  const record = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  const type = record?.match_type;
  if (typeof type === "string" && type) return type;
  return "1v1";
}

export default async function MatchPage({ params }: PageProps) {
  // Next 15/16 passes params as a Promise. Awaiting a plain object is a
  // no-op, so this works on both old and new Next. Without the await,
  // matchId is undefined and every arena 404s.
  const matchId = await resolveMatchIdFromParams(params);
  if (!matchId) {
    notFound();
  }
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

  const { questionId, timeLimit, startedAt, language } = parseMatchMetadata(matchRow.metadata);
  const matchType = parseMatchType(matchRow.metadata);
  // `matches.mode` is the ladder, `metadata.match_type` is the shape. They were
  // previously conflated, which hid the rating change on the result card.
  const isRanked = (matchRow.mode as string) === "ranked";

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

  /*
   * A decided match is a dead end: there is no duel left to play, and sitting
   * on its result card is what caused the "ghost victory" — a player parked on
   * a match decided days earlier kept polling it, so their seat looked live
   * while the room they had actually been matched into sat empty. Bounce them
   * somewhere they can act instead of parking them on a corpse.
   */
  const matchMetadata = (matchRow.metadata ?? {}) as Record<string, unknown>;
  const matchStatus = (matchRow as { status?: string | null }).status ?? null;
  if (
    shouldRedirectOffDecidedMatch({
      status: matchStatus,
      winnerId:
        typeof matchMetadata.winner_id === "string" && matchMetadata.winner_id
          ? matchMetadata.winner_id
          : null,
      completedAt:
        typeof matchMetadata.completed_at === "string" && matchMetadata.completed_at
          ? matchMetadata.completed_at
          : null,
    })
  ) {
    redirect("/game-modes");
  }

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

  /*
   * Deliberately no app shell here. The arena used to render the full site
   * header and sidebar, so a stray click on "Practice Arena" or "Clubs" could
   * walk a player out of a live duel. The arena owns its own chrome and its
   * only exit is the forfeit button.
   */
  return (
    <MatchArenaShell
      matchId={matchId}
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
      startedAt={startedAt}
      timeLimitSeconds={Number.isFinite(Number(timeLimit)) && Number(timeLimit) > 0
        ? sanitizeTimeLimit(timeLimit)
        : DEFAULT_TIME_LIMIT_SECONDS}
      initialLanguage={initialLanguage}
      exitHref="/game-modes"
      matchType={matchType}
      isRanked={isRanked}
    />
  );
}
