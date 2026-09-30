import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { MATCH_STATUS_COMPLETED } from "@/lib/match-room";

type CompletePayload = {
  matchId?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function POST(request: Request) {
  let payload: CompletePayload;
  try {
    payload = (await request.json()) as CompletePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const matchId = payload.matchId?.trim();
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
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select("id,mode,metadata")
    .eq("id", matchId)
    .single();

  if (matchError || !matchRow) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const metadata = asRecord(matchRow.metadata);
  const existingWinner = metadata.winner_id;

  if (typeof existingWinner === "string" && existingWinner) {
    return NextResponse.json({ ok: true, winnerId: existingWinner, alreadyCompleted: true }, { status: 200 });
  }

  const { data: players, error: playersError } = await supabase
    .from("match_players")
    .select("user_id")
    .eq("match_id", matchId);

  if (playersError || !players || players.length < 2) {
    return NextResponse.json({ error: "Unable to resolve players" }, { status: 500 });
  }

  const playerIds = Array.from(new Set(players.map((row) => row.user_id as string)));
  const opponentId = playerIds.find((id) => id !== userId) ?? null;

  if (!opponentId) {
    return NextResponse.json({ error: "Opponent not found" }, { status: 500 });
  }

  const mode = matchRow.mode === "unranked" ? "unranked" : "ranked";

  const { data: usersRows, error: usersError } = await supabase
    .from("users")
    .select("id,rating,wins,losses")
    .in("id", [userId, opponentId]);

  if (usersError || !usersRows || usersRows.length < 2) {
    return NextResponse.json({ error: "Unable to load player ratings" }, { status: 500 });
  }

  const userById = new Map(
    usersRows.map((row) => [
      row.id as string,
      {
        rating: typeof row.rating === "number" ? row.rating : 1000,
        wins: typeof row.wins === "number" ? row.wins : 0,
        losses: typeof row.losses === "number" ? row.losses : 0,
      },
    ]),
  );

  const winnerData = userById.get(userId);
  const loserData = userById.get(opponentId);

  if (!winnerData || !loserData) {
    return NextResponse.json({ error: "Unable to resolve player state" }, { status: 500 });
  }

  // ELO calculation
  const K = 32; // K-factor
  const winnerOldRating = winnerData.rating;
  const loserOldRating = loserData.rating;

  let winnerDelta = 0;
  let loserDelta = 0;

  if (mode === "ranked") {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserOldRating - winnerOldRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerOldRating - loserOldRating) / 400));

    winnerDelta = Math.round(K * (1 - expectedWinner));
    loserDelta = Math.round(K * (0 - expectedLoser));

    // Minimum delta of 8 for winning, maximum loss capped
    winnerDelta = Math.max(winnerDelta, 8);
    loserDelta = Math.min(loserDelta, -8);
  }

  const winnerRating = Math.max(0, winnerOldRating + winnerDelta);
  const loserRating = Math.max(0, loserOldRating + loserDelta);

  const { error: winnerUpdateError } = await supabase
    .from("users")
    .update({
      rating: winnerRating,
      wins: winnerData.wins + 1,
    })
    .eq("id", userId);

  if (winnerUpdateError) {
    return NextResponse.json({ error: winnerUpdateError.message }, { status: 500 });
  }

  const { error: loserUpdateError } = await supabase
    .from("users")
    .update({
      rating: loserRating,
      losses: loserData.losses + 1,
    })
    .eq("id", opponentId);

  if (loserUpdateError) {
    return NextResponse.json({ error: loserUpdateError.message }, { status: 500 });
  }

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    winner_id: userId,
    loser_id: opponentId,
    completed_at: new Date().toISOString(),
    rating_delta: mode === "ranked" ? { winner: winnerDelta, loser: loserDelta } : { winner: 0, loser: 0 },
  };

  const { error: completeError } = await supabase
    .from("matches")
    .update({ metadata: nextMetadata, status: MATCH_STATUS_COMPLETED })
    .eq("id", matchId);

  if (completeError) {
    return NextResponse.json({ error: completeError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      winnerId: userId,
      loserId: opponentId,
      mode,
      rating: {
        winner: winnerRating,
        loser: loserRating,
      },
      ratingDelta: {
        winner: winnerDelta,
        loser: loserDelta,
      },
    },
    { status: 200 },
  );
}
