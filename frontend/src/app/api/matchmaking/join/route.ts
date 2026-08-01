import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type JoinRequest = {
  mode?: "ranked" | "unranked";
  timeLimitSeconds?: number;
  language?: string | null;
  matchType?: "1v1" | "2v2" | "ffa";
  difficulty?: "easy" | "medium" | "hard" | "mixed";
};

function sanitizeTimeLimitSeconds(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8 * 60;
  return Math.max(60, Math.min(60 * 60, Math.floor(parsed)));
}

function sanitizeLanguage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  // Keep in sync with the submit API languageMap.
  if (["node", "javascript", "python", "cpp", "java", "c"].includes(normalized)) {
    return normalized === "javascript" ? "node" : normalized;
  }
  return null;
}

function sanitizeMatchType(value: unknown) {
  return value === "2v2" || value === "ffa" ? value : "1v1";
}

function resolveRankedDifficultyFromRating(rating: number) {
  // Ladder progression: easy at lower ratings, then medium, then hard.
  if (rating < 300) return "easy";
  if (rating < 700) return "medium";
  return "hard";
}

export async function POST(request: Request) {
  let payload: JoinRequest;

  try {
    payload = (await request.json()) as JoinRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const mode = payload.mode === "ranked" || payload.mode === "unranked" ? payload.mode : "ranked";
  const timeLimitSeconds = sanitizeTimeLimitSeconds(payload.timeLimitSeconds);
  const language = sanitizeLanguage(payload.language);
  const matchType = sanitizeMatchType(payload.matchType);

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authData.user.id;

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Ensure the user has only one active queue entry.
  await supabase.from("matchmaking_queue").delete().eq("user_id", userId);

  const { error: enqueueError } = await supabase
    .from("matchmaking_queue")
    .insert({ user_id: userId, mode });

  if (enqueueError) {
    console.error("Failed to enqueue", enqueueError);
    const msg = enqueueError.message?.includes("relation")
      ? "Matchmaking is not set up yet. Run the database migrations first."
      : `Failed to join matchmaking: ${enqueueError.message ?? "unknown error"}`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Server-side polling: wait up to 60 seconds for an opponent.
  const searchStart = Date.now();
  const searchTimeoutMs = 60_000;
  const pollIntervalMs = 2_000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let opponentRow: { user_id: string; mode: string } | null = null;

  while (Date.now() - searchStart < searchTimeoutMs) {
    const { data: found, error: pollError } = await supabase
      .from("matchmaking_queue")
      .select("user_id,mode")
      .eq("mode", mode)
      .neq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pollError) {
      console.error("Failed to query matchmaking queue", pollError);
      break;
    }

    if (found?.user_id) {
      opponentRow = found;
      break;
    }

    await sleep(pollIntervalMs);
  }

  if (!opponentRow?.user_id) {
    // Timed out — remove ourselves from the queue.
    await supabase.from("matchmaking_queue").delete().eq("user_id", userId);
    return NextResponse.json({ status: "queued" }, { status: 200 });
  }

  let difficulty: "easy" | "medium" | "hard" | null = null;

  if (mode === "ranked") {
    const { data: ratingRows, error: ratingsError } = await supabase
      .from("users")
      .select("id,rating")
      .in("id", [userId, opponentRow.user_id]);

    if (ratingsError) {
      console.error("Failed to read user ratings", ratingsError);
    }

    const ratingsByUserId = new Map(
      (ratingRows ?? []).map((row) => [
        row.id as string,
        typeof row.rating === "number" ? row.rating : 0,
      ]),
    );

    const myRating = ratingsByUserId.get(userId) ?? 0;
    const opponentRating = ratingsByUserId.get(opponentRow.user_id) ?? 0;
    const averageRating = Math.round((myRating + opponentRating) / 2);

    difficulty = resolveRankedDifficultyFromRating(averageRating);
  }

  // Unranked intentionally stays mixed (all difficulties).

  // Pick a PvP question, optionally filtered by difficulty.
  let questionQuery = supabase
    .from("practice_questions")
    .select("id,slug,difficulty");
  if (difficulty) {
    questionQuery = questionQuery.eq("difficulty", difficulty);
  }
  let { data: availableQuestions, error: questionsError } = await questionQuery;

  if ((!availableQuestions || availableQuestions.length === 0) && difficulty) {
    // Fallback to mixed if this difficulty bucket is empty.
    const fallback = await supabase
      .from("practice_questions")
      .select("id,slug,difficulty");
    availableQuestions = fallback.data;
    questionsError = fallback.error;
  }

  if (questionsError || !availableQuestions || availableQuestions.length === 0) {
    console.error("No PvP questions available", questionsError);
    const msg = questionsError?.message?.includes("relation")
      ? "Questions are not seeded yet. Run the database migrations first."
      : "PvP questions are not seeded yet. Run the database migrations first.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const chosen = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

  // Create match + players.
  const startedAt = new Date().toISOString();
  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .insert({
      mode,
      metadata: {
        question_id: chosen.id,
        question_difficulty: chosen.difficulty,
        time_limit: timeLimitSeconds,
        language,
        match_type: matchType,
        trophy_multiplier: timeLimitSeconds >= 60 * 60 ? 1.5 : 1,
        started_at: startedAt,
      },
    })
    .select("id")
    .single();

  if (matchError || !matchRow?.id) {
    console.error("Failed to create match", matchError);
    return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  }

  const matchId = matchRow.id as string;

  const { error: playersError } = await supabase.from("match_players").insert([
    { match_id: matchId, user_id: userId },
    { match_id: matchId, user_id: opponentRow.user_id },
  ]);

  if (playersError) {
    console.error("Failed to create match players", playersError);
    // Best-effort cleanup.
    await supabase.from("matches").delete().eq("id", matchId);
    return NextResponse.json({ error: "Failed to create match players" }, { status: 500 });
  }

  // Remove both from queue.
  await supabase
    .from("matchmaking_queue")
    .delete()
    .in("user_id", [userId, opponentRow.user_id]);

  return NextResponse.json({ matchId }, { status: 200 });
}
