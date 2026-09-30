import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { MATCH_COUNTDOWN_MS, MATCH_STATUS_ACTIVE, MATCH_STATUS_PENDING } from "@/lib/match-room";

type StartFriendMatchRequest = {
  matchId?: string;
};

export async function POST(request: Request) {
  let payload: StartFriendMatchRequest;

  try {
    payload = (await request.json()) as StartFriendMatchRequest;
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

  const { data: membership } = await supabase
    .from("match_players")
    .select("match_id")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select("id,status,metadata,started_at")
    .eq("id", matchId)
    .single();

  if (matchError || !matchRow) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const currentMetadata =
    matchRow.metadata && typeof matchRow.metadata === "object" ? (matchRow.metadata as Record<string, unknown>) : {};

  // Only set started_at once.
  if (typeof currentMetadata.started_at === "string" && currentMetadata.started_at) {
    return NextResponse.json({ ok: true, startedAt: currentMetadata.started_at }, { status: 200 });
  }

  // Starting a duel nobody has accepted yet just burns the clock. "pending" is
  // also the pre-start state for every other match, so the invitation is what
  // distinguishes the two.
  const isUnacceptedChallenge =
    currentMetadata.friend_invite != null && typeof currentMetadata.accepted_at !== "string";
  if (isUnacceptedChallenge) {
    return NextResponse.json(
      { error: "Waiting for your friend to accept the challenge" },
      { status: 409 },
    );
  }

  /*
   * Atomic claim on the shared start instant: the UPDATE only matches a row
   * still in "pending", so if the arena's room gate beat us to it we read
   * theirs instead of overwriting it with a second, later start.
   */
  const startedAt = new Date(Date.now() + MATCH_COUNTDOWN_MS).toISOString();
  const { data: claimed } = await supabase
    .from("matches")
    .update({
      status: MATCH_STATUS_ACTIVE,
      started_at: startedAt,
      metadata: { ...currentMetadata, started_at: startedAt },
    })
    .eq("id", matchId)
    .eq("status", MATCH_STATUS_PENDING)
    .select("metadata,started_at");

  if (Array.isArray(claimed) && claimed.length > 0) {
    return NextResponse.json({ ok: true, startedAt }, { status: 200 });
  }

  const { data: fresh } = await supabase
    .from("matches")
    .select("metadata,started_at,status")
    .eq("id", matchId)
    .maybeSingle();

  const freshMetadata =
    fresh?.metadata && typeof fresh.metadata === "object" ? (fresh.metadata as Record<string, unknown>) : {};
  const existingStart =
    typeof freshMetadata.started_at === "string" && freshMetadata.started_at
      ? freshMetadata.started_at
      : ((fresh?.started_at as string | null) ?? null);

  if (!existingStart) {
    console.error("Failed to start match", matchId, fresh?.status);
    return NextResponse.json({ error: "Failed to start match" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, startedAt: existingStart }, { status: 200 });
}
