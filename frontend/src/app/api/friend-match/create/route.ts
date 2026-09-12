import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { parseChallengeMode } from "@/lib/friend-challenge";

type CreateFriendMatchRequest = {
  friendUserId?: string;
  mode?: "ranked" | "unranked";
  timeLimitSeconds?: number;
  language?: string | null;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
};

function sanitizeTimeLimitSeconds(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10 * 60;
  return Math.max(60, Math.min(60 * 60, Math.floor(parsed)));
}

function sanitizeLanguage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["node", "javascript", "python", "cpp", "java", "c"].includes(normalized)) {
    return normalized === "javascript" ? "node" : normalized;
  }
  return null;
}

export async function POST(request: Request) {
  let payload: CreateFriendMatchRequest;

  try {
    payload = (await request.json()) as CreateFriendMatchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const friendUserId = typeof payload.friendUserId === "string" ? payload.friendUserId.trim() : "";
  if (!friendUserId) {
    return NextResponse.json({ error: "friendUserId is required" }, { status: 400 });
  }

  const timeLimitSeconds = sanitizeTimeLimitSeconds(payload.timeLimitSeconds);
  const language = sanitizeLanguage(payload.language);
  const mode = parseChallengeMode(payload.mode);

  // Determine question difficulty.
  let difficulty: "easy" | "medium" | "hard" | null = null;
  if (payload.difficulty === "easy" || payload.difficulty === "medium" || payload.difficulty === "hard") {
    difficulty = payload.difficulty;
  } else if (payload.difficulty !== "mixed") {
    if (timeLimitSeconds <= 2 * 60) difficulty = "easy";
    else if (timeLimitSeconds <= 5 * 60) difficulty = "medium";
    else difficulty = "hard";
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authData.user.id;
  if (userId === friendUserId) {
    return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Pick a PvP question, optionally filtered by difficulty.
  let questionQuery = supabase
    .from("practice_questions")
    .select("id,slug,difficulty");
  if (difficulty) {
    questionQuery = questionQuery.eq("difficulty", difficulty);
  }
  const { data: availableQuestions, error: questionsError } = await questionQuery;

  if (questionsError || !availableQuestions || availableQuestions.length === 0) {
    console.error("No PvP questions available", questionsError);
    return NextResponse.json({ error: "PvP questions are not seeded yet" }, { status: 500 });
  }

  const chosen = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

  // Create match as a pending challenge. status is NOT NULL on prod and has
  // no default, so it must be set explicitly (missing it = "Failed to
  // create match"). The question is re-picked from both ratings on accept.
  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .insert({
      mode,
      status: "pending",
      created_by: userId,
      metadata: {
        question_id: chosen.id,
        question_difficulty: chosen.difficulty,
        time_limit: timeLimitSeconds,
        language,
        match_type: "1v1",
        friend_invite: {
          inviter_id: userId,
          invitee_id: friendUserId,
          mode,
        },
        trophy_multiplier: 1,
        started_at: null,
        mode,
      },
    })
    .select("id")
    .single();

  if (matchError || !matchRow?.id) {
    console.error("Failed to create friend match", matchError);
    return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  }

  const matchId = matchRow.id as string;

  const { error: playersError } = await supabase.from("match_players").insert([
    { match_id: matchId, user_id: userId },
    { match_id: matchId, user_id: friendUserId },
  ]);

  if (playersError) {
    console.error("Failed to create match players", playersError);
    await supabase.from("matches").delete().eq("id", matchId);
    return NextResponse.json({ error: "Failed to create match players" }, { status: 500 });
  }

  return NextResponse.json({ matchId }, { status: 200 });
}
