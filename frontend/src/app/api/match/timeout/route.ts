import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type TimeoutPayload = {
  matchId?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function POST(request: Request) {
  let payload: TimeoutPayload;
  try {
    payload = (await request.json()) as TimeoutPayload;
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

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
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

  const mode = matchRow.mode === "unranked" ? "unranked" : "ranked";

  // Check practice_submissions to see if anyone solved it
  const { data: submissions } = await supabase
    .from("practice_submissions")
    .select("user_id,question_id,passed")
    .eq("question_id", metadata.question_id)
    .in("user_id", playerIds)
    .eq("passed", true);

  const solvedByPlayer = new Set((submissions ?? []).map((s) => s.user_id as string));

  let winnerId: string | null = null;
  let loserId: string | null = null;

  if (solvedByPlayer.size === 1) {
    // One player solved it — they win
    winnerId = playerIds.find((id) => solvedByPlayer.has(id)) ?? null;
    loserId = playerIds.find((id) => !solvedByPlayer.has(id)) ?? null;
  }
  // If both or neither solved, it's a draw — no rating change

  let winnerDelta = 0;
  let loserDelta = 0;

  if (winnerId && loserId && mode === "ranked") {
    const { data: usersRows } = await supabase
      .from("users")
      .select("id,rating,wins,losses")
      .in("id", [winnerId, loserId]);

    if (usersRows && usersRows.length === 2) {
      const userMap = new Map(
        usersRows.map((row) => [
          row.id as string,
          {
            rating: typeof row.rating === "number" ? row.rating : 1000,
            wins: typeof row.wins === "number" ? row.wins : 0,
            losses: typeof row.losses === "number" ? row.losses : 0,
          },
        ]),
      );

      const w = userMap.get(winnerId)!;
      const l = userMap.get(loserId)!;

      const K = 32;
      const expected = 1 / (1 + Math.pow(10, (l.rating - w.rating) / 400));
      winnerDelta = Math.max(Math.round(K * (1 - expected)), 8);
      loserDelta = Math.min(Math.round(K * (0 - (1 - expected))), -8);

      await supabase
        .from("users")
        .update({ rating: Math.max(0, w.rating + winnerDelta), wins: w.wins + 1 })
        .eq("id", winnerId);

      await supabase
        .from("users")
        .update({ rating: Math.max(0, l.rating + loserDelta), losses: l.losses + 1 })
        .eq("id", loserId);
    }
  }

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    winner_id: winnerId,
    loser_id: loserId,
    completed_at: new Date().toISOString(),
    timed_out: true,
    rating_delta: { winner: winnerDelta, loser: loserDelta },
  };

  await supabase
    .from("matches")
    .update({ metadata: nextMetadata })
    .eq("id", matchId);

  return NextResponse.json({
    ok: true,
    winnerId,
    loserId,
    draw: !winnerId,
    mode,
    ratingDelta: { winner: winnerDelta, loser: loserDelta },
  }, { status: 200 });
}
