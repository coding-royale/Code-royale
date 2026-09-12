import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isLiveMatchRow } from "@/lib/presence";

type RouteParams = Promise<{ matchId: string }> | { matchId: string };

async function resolveMatchId(params: RouteParams): Promise<string | null> {
  const resolved = await params;
  const raw = resolved?.matchId;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

/** Shared guard + snapshot builder for the spectate page and its poller. */
export async function getSpectateSnapshot(matchId: string) {
  const supabase = createSupabaseServiceClient();

  const { data: matchRow } = await supabase
    .from("matches")
    .select("id,mode,status,metadata,started_at,created_at")
    .eq("id", matchId)
    .maybeSingle();
  if (!matchRow) return null;

  const meta =
    matchRow.metadata && typeof matchRow.metadata === "object"
      ? (matchRow.metadata as Record<string, unknown>)
      : {};

  const { data: players } = await supabase
    .from("match_players")
    .select("user_id")
    .eq("match_id", matchId);
  const playerIds = Array.from(new Set((players ?? []).map((p) => p.user_id as string)));
  if (playerIds.length === 0) return null;

  const { data: userRows } = await supabase
    .from("users")
    .select("id,username,rating,allow_spectate")
    .in("id", playerIds);

  // Spectating is off when ANY participant disabled it.
  const blocked = (userRows ?? []).some(
    (u) => (u as { allow_spectate?: boolean | null }).allow_spectate === false,
  );
  if (blocked) return null;

  const questionId = typeof meta.question_id === "string" ? meta.question_id : null;
  let question: { title: string; description: string; difficulty: string } | null = null;
  if (questionId) {
    const { data: q } = await supabase
      .from("practice_questions")
      .select("title,description,difficulty")
      .eq("id", questionId)
      .maybeSingle();
    if (q) {
      question = {
        title: q.title as string,
        description: q.description as string,
        difficulty: q.difficulty as string,
      };
    }
  }

  const winnerId = typeof meta.winner_id === "string" ? meta.winner_id : null;
  const live = isLiveMatchRow(
    { status: matchRow.status as string, metadata: meta, started_at: matchRow.started_at as string | null },
    Date.now(),
  );

  const playerList = (userRows ?? []).map((u) => ({
    id: u.id as string,
    username: ((u.username as string | null) ?? "Unknown").trim() || "Unknown",
    rating: typeof u.rating === "number" ? u.rating : 0,
    isWinner: winnerId !== null && u.id === winnerId,
  }));

  const timeLimit =
    typeof meta.time_limit === "number" && Number.isFinite(meta.time_limit)
      ? meta.time_limit
      : 480;
  const startedAt =
    (typeof matchRow.started_at === "string" && matchRow.started_at) ||
    (typeof meta.started_at === "string" && meta.started_at) ||
    (matchRow.created_at as string);

  return {
    matchId: matchRow.id as string,
    mode: (matchRow.mode as string) ?? "ranked",
    status: live ? ("live" as const) : ("finished" as const),
    question,
    players: playerList,
    timeLimitSeconds: timeLimit,
    startedAt,
    winnerUsername: playerList.find((p) => p.isWinner)?.username ?? null,
  };
}

export async function GET(_request: Request, { params }: { params: RouteParams }) {
  const matchId = await resolveMatchId(params);
  if (!matchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let snapshot;
  try {
    snapshot = await getSpectateSnapshot(matchId);
  } catch (error) {
    console.error("Spectate snapshot error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
