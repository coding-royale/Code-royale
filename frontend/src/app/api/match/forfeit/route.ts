import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type ForfeitPayload = {
  matchId?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function POST(request: Request) {
  let payload: ForfeitPayload;
  try {
    payload = (await request.json()) as ForfeitPayload;
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

  // Verify membership
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

  const forfeiterData = userById.get(userId);
  const winnerData = userById.get(opponentId);

  if (!forfeiterData || !winnerData) {
    return NextResponse.json({ error: "Unable to resolve player state" }, { status: 500 });
  }

  // ELO calculation — forfeiter loses
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (forfeiterData.rating - winnerData.rating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerData.rating - forfeiterData.rating) / 400));

  let winnerDelta = Math.round(K * (1 - expectedWinner));
  let loserDelta = Math.round(K * (0 - expectedLoser));
  winnerDelta = Math.max(winnerDelta, 8);
  loserDelta = Math.min(loserDelta, -8);

  if (mode !== "ranked") {
    winnerDelta = 0;
    loserDelta = 0;
  }

  const newWinnerRating = Math.max(0, winnerData.rating + winnerDelta);
  const newLoserRating = Math.max(0, forfeiterData.rating + loserDelta);

  await supabase
    .from("users")
    .update({ rating: newWinnerRating, wins: winnerData.wins + 1 })
    .eq("id", opponentId);

  await supabase
    .from("users")
    .update({ rating: newLoserRating, losses: forfeiterData.losses + 1 })
    .eq("id", userId);

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    winner_id: opponentId,
    loser_id: userId,
    completed_at: new Date().toISOString(),
    forfeit: true,
    rating_delta: { winner: winnerDelta, loser: loserDelta },
  };

  await supabase
    .from("matches")
    .update({ metadata: nextMetadata })
    .eq("id", matchId);

  return NextResponse.json({
    ok: true,
    winnerId: opponentId,
    loserId: userId,
    mode,
    rating: { winner: newWinnerRating, loser: newLoserRating },
    ratingDelta: { winner: winnerDelta, loser: loserDelta },
  }, { status: 200 });
}
