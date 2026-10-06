import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isLiveMatchRow } from "@/lib/presence";
import { MATCH_STATUS_PENDING } from "@/lib/match-room";
import { visibleSpectatePlayers } from "@/lib/spectate-access";

type RouteParams = Promise<{ matchId: string }> | { matchId: string };

async function resolveMatchId(params: RouteParams): Promise<string | null> {
  const resolved = await params;
  const raw = resolved?.matchId;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

/** Shared guard + snapshot builder for the spectate page and its poller. */
export async function getSpectateSnapshot(matchId: string, viewerId: string) {
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

  /*
   * Spectating is friend-only.
   *
   * This used to check nothing beyond "is the caller signed in", so anyone
   * holding a match id could watch any duel — including a stranger's, which is
   * exactly the scouting tool a ranked ladder cannot afford. (The arena URL is
   * deliberately shareable, so a challenger is handed one to pass on.)
   *
   * The viewer must have an accepted connection with somebody in the match, and
   * only those friends are ever named below — a spectator sees their friend,
   * never the opponent on the other side. A total stranger gets `null`, which
   * the callers turn into a 404, so the endpoint does not even confirm that the
   * match exists.
   */
  const { data: friendships } = await supabase
    .from("connections")
    .select("user_id,connection_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${viewerId},connection_id.eq.${viewerId}`);

  const friendIds = Array.from(
    new Set(
      (friendships ?? [])
        .map((row) =>
          (row.user_id as string) === viewerId
            ? (row.connection_id as string)
            : (row.user_id as string),
        )
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const visibleIds = visibleSpectatePlayers({ playerIds, friendIds, viewerId });
  if (visibleIds.length === 0) return null;

  const { data: userRows } = await supabase
    .from("users")
    .select("id,username,rating,allow_spectate")
    .in("id", playerIds);

  /*
   * The opt-out is checked against the WHOLE seat list, not just the visible
   * friends, so a duel is private if anybody in it declined spectating.
   */
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
  // A match that is still filling its room has no clock yet. Reporting it as
  // finished shows a frozen result; reporting it live would run a countdown
  // from the room's creation time, which is not when the duel starts.
  const waiting = !live && (matchRow.status as string | null) === MATCH_STATUS_PENDING;

  const visibleSet = new Set(visibleIds);
  // Only the spectator's friends are disclosed. The opponent is omitted even
  // though they are in `userRows`, so nothing about them leaks.
  const playerList = (userRows ?? [])
    .filter((u) => visibleSet.has(u.id as string))
    .map((u) => ({
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
    status: live ? ("live" as const) : waiting ? ("waiting" as const) : ("finished" as const),
    question,
    players: playerList,
    timeLimitSeconds: timeLimit,
    startedAt,
    // A friend who is not visible (because the viewer is friends with the
    // other seat) is never announced, so the winner is only ever named when
    // the spectator actually knows them.
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
    snapshot = await getSpectateSnapshot(matchId, authData.user.id);
  } catch (error) {
    console.error("Spectate snapshot error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (!snapshot) {
    // 404 rather than 403: a non-friend must not be able to tell a real match
    // apart from one that does not exist.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}