import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isChallengeExpired, resolveChallengeDifficulty } from "@/lib/friend-challenge";

export async function POST(request: Request) {
  let payload: { matchId?: string };
  try {
    payload = (await request.json()) as { matchId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const matchId = typeof payload.matchId === "string" ? payload.matchId.trim() : "";
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  }

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

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select("id,status,mode,metadata,created_at")
    .eq("id", matchId)
    .single();

  if (matchError || !matchRow) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const meta =
    matchRow.metadata && typeof matchRow.metadata === "object"
      ? (matchRow.metadata as Record<string, unknown>)
      : {};
  const invite =
    meta.friend_invite && typeof meta.friend_invite === "object"
      ? (meta.friend_invite as Record<string, unknown>)
      : null;

  if (!invite || invite.invitee_id !== userId) {
    return NextResponse.json({ error: "Only the challenged player can accept" }, { status: 403 });
  }
  if (matchRow.status !== "pending") {
    return NextResponse.json({ error: "Challenge is no longer pending" }, { status: 410 });
  }
  if (isChallengeExpired(matchRow.created_at as string | null)) {
    await supabase.from("matches").delete().eq("id", matchId);
    return NextResponse.json({ error: "Challenge expired" }, { status: 410 });
  }

  const inviterId = invite.inviter_id as string;

  // Question lane from the pair's average rating.
  let inviterRating = 0;
  let inviteeRating = 0;
  try {
    const { data: rows } = await supabase.from("users").select("id,rating").in("id", [inviterId, userId]);
    for (const row of rows ?? []) {
      if (row.id === inviterId && typeof row.rating === "number") inviterRating = row.rating;
      if (row.id === userId && typeof row.rating === "number") inviteeRating = row.rating;
    }
  } catch {
    // fall back to 0 / 0 -> easy
  }
  const difficulty = resolveChallengeDifficulty(inviterRating, inviteeRating);

  const { data: initialQuestions } = await supabase
    .from("practice_questions")
    .select("id,difficulty")
    .eq("difficulty", difficulty);
  let questions = initialQuestions;
  if (!questions || questions.length === 0) {
    const fallback = await supabase.from("practice_questions").select("id,difficulty");
    questions = fallback.data;
  }
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "No questions available" }, { status: 500 });
  }
  const chosenQ = questions[Math.floor(Math.random() * questions.length)];

  const startedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("matches")
    .update({
      status: "active",
      started_at: startedAt,
      metadata: {
        ...meta,
        question_id: chosenQ.id,
        question_difficulty: chosenQ.difficulty,
        started_at: startedAt,
      },
    })
    .eq("id", matchId);

  if (updateError) {
    console.error("Failed to accept challenge", updateError);
    return NextResponse.json({ error: "Failed to accept challenge" }, { status: 500 });
  }

  // Ensure the invitee is seated (create already seats both, this is a guard).
  await supabase.from("match_players").upsert(
    { match_id: matchId, user_id: userId },
    { onConflict: "match_id,user_id" },
  );

  return NextResponse.json({ matchId }, { status: 200 });
}
