import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { resolveRequestUserId } from "@/lib/resolve-request-user";
import { formatLastActive } from "@/lib/match-activity";
import {
  LOBBY_ABANDON_MS,
  LOBBY_FALLBACK_MS,
  MATCH_COUNTDOWN_MS,
  MATCH_STATUS_ACTIVE,
  MATCH_STATUS_PENDING,
  countPresentPlayers,
  parseIsoMs,
  pickSolvedPlayerIds,
  remainingMatchSeconds,
  resolveLobbyReason,
  resolveMatchPhase,
  sanitizeTimeLimit,
  type MatchPhase,
} from "@/lib/match-room";
import { summarizeAttempts } from "@/lib/match-activity";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ matchId: string }> | { matchId: string };

type SyncRequest = {
  /** Member ids the client can see in the realtime room, used to start early. */
  presentUserIds?: string[];
  /**
   * True once the client's realtime presence channel is actually subscribed.
   *
   * This is what separates "the opponent has not turned up yet" from "we
   * cannot see each other". With a working channel the server waits for both
   * seats, so the duel really does start for both players at once. Without one
   * it falls back to a short timer, because an invisible opponent must not
   * stall the queue forever.
   */
  presenceLive?: boolean;
  /** Leaving a room that never filled: delete it instead of leaking a lobby. */
  abandon?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function resolveCaller(request: Request) {
  return resolveRequestUserId(request);
}

type PlayerSnapshot = {
  userId: string;
  rating: number;
  attempts: number;
  bestPassed: number;
  bestTotal: number;
  lastActiveAt: string | null;
  solved: boolean;
};

/**
 * One poll drives the whole arena: the shared clock, the room gate, the
 * opponent's progress and the result. Previously the client ran a local
 * countdown seeded from a server-rendered number and polled match metadata
 * from the browser against `matches` directly, so the two players' timers
 * drifted apart and neither could see the other clearly.
 */
export async function POST(request: Request, { params }: { params: RouteParams }) {
  const resolved = await params;
  const matchId = typeof resolved?.matchId === "string" ? resolved.matchId.trim() : "";
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  }

  let body: SyncRequest = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as SyncRequest;
  } catch {
    body = {};
  }

  const userId = await resolveCaller(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { data: playerRows } = await supabase
    .from("match_players")
    .select("user_id,present_at")
    .eq("match_id", matchId);

  const playerIds = Array.from(
    new Set((playerRows ?? []).map((row) => row.user_id as string).filter(Boolean)),
  );
  if (playerIds.length === 0) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // A failed select (older schema without the column) yields no present_at, so
  // treat it as "unknown" rather than "nobody is here".
  const presentAtByUser = new Map<string, string | null>(
    (playerRows ?? []).map((row) => [
      row.user_id as string,
      typeof row.present_at === "string" ? row.present_at : null,
    ]),
  );
  const presenceColumnUsable = (playerRows ?? []).some(
    (row) => "present_at" in (row as Record<string, unknown>),
  );

  const { data: matchRow } = await supabase
    .from("matches")
    .select("id,mode,status,metadata,created_by,started_at,created_at")
    .eq("id", matchId)
    .maybeSingle();

  if (!matchRow) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const metadata = asRecord(matchRow.metadata);
  const serverNowMs = Date.now();
  const serverNow = new Date(serverNowMs).toISOString();

  // Claim this seat as occupied. One row per player, so two players stamping
  // their own arrival can never clobber each other.
  if (presenceColumnUsable) {
    await supabase
      .from("match_players")
      .update({ present_at: serverNow })
      .eq("match_id", matchId)
      .eq("user_id", userId);
    presentAtByUser.set(userId, serverNow);
  }

  const storedStart =
    typeof metadata.started_at === "string" && metadata.started_at ? metadata.started_at : null;

  // Abandoning an unfilled room: drop it so it cannot linger as a lobby.
  if (body.abandon === true && !storedStart) {
    await supabase.from("matches").delete().eq("id", matchId).eq("status", MATCH_STATUS_PENDING);
    return NextResponse.json({ ok: true, abandoned: true, serverNow }, { status: 200 });
  }

  /*
   * The room gate.
   *
   * The clock may only be started from what the SERVER has observed: a seat
   * stamped `present_at` by this very route. It used to also accept
   * `body.presentUserIds` — a list the caller sends in its own request body.
   * That let either player start the duel alone by posting both uuids, turning
   * their opponent's page-load time into lost clock, which is the exact unfair
   * start this gate was written to prevent. Client presence is now used only
   * for display; it can never open the room.
   *
   * `matches.status` is the atomic claim: the UPDATE only matches a row still
   * in "pending", so exactly one of the two players ever writes a start instant
   * and both then read that same value.
   */
  let startedAt = storedStart;
  const room = countPresentPlayers({ presentAtByUser, playerIds, nowMs: serverNowMs });
  if (!startedAt) {
    // An unaccepted friend challenge must never start a clock: the invitee has
    // a seat from creation, so presence alone is not consent to play.
    const isUnacceptedChallenge =
      metadata.friend_invite != null && typeof metadata.accepted_at !== "string";

    // Without the presence column (schema predates the migration) fall back to
    // a timer so the queue cannot jam forever.
    const createdMs = parseIsoMs(matchRow.created_at as string | null);
    const legacyTimer =
      !presenceColumnUsable &&
      playerIds.length > 1 &&
      createdMs !== null &&
      serverNowMs - createdMs >= LOBBY_FALLBACK_MS;

    if (!isUnacceptedChallenge && (room.everyoneHere || legacyTimer)) {
      const startIso = new Date(serverNowMs + MATCH_COUNTDOWN_MS).toISOString();
      const { data: claimed } = await supabase
        .from("matches")
        .update({
          status: MATCH_STATUS_ACTIVE,
          started_at: startIso,
          metadata: { ...metadata, started_at: startIso },
        })
        .eq("id", matchId)
        .eq("status", MATCH_STATUS_PENDING)
        .select("id,started_at,metadata");

      const wonClaim = Array.isArray(claimed) && claimed.length > 0;
      if (wonClaim) {
        startedAt = startIso;
      } else {
        // Someone else claimed it between our read and our write — take theirs.
        const { data: fresh } = await supabase
          .from("matches")
          .select("started_at,metadata,status")
          .eq("id", matchId)
          .maybeSingle();
        const freshMeta = asRecord(fresh?.metadata);
        startedAt =
          typeof freshMeta.started_at === "string" && freshMeta.started_at
            ? freshMeta.started_at
            : ((fresh?.started_at as string | null) ?? null);
      }
    }
  }

  // Legacy rows went live without ever writing metadata.started_at.
  if (!startedAt && (matchRow.status as string | null) === MATCH_STATUS_ACTIVE) {
    startedAt = (matchRow.started_at as string | null) ?? null;
  }

  const winnerId = typeof metadata.winner_id === "string" && metadata.winner_id ? metadata.winner_id : null;
  const timeLimitSeconds = sanitizeTimeLimit(metadata.time_limit);
  const phase: MatchPhase = resolveMatchPhase({ startedAt, winnerId, nowMs: serverNowMs });

  // Progress feed: attempts, best pass count and last activity per player.
  const { data: attemptRows } = await supabase
    .from("match_attempts")
    .select("user_id,passed,total,created_at")
    .eq("match_id", matchId)
    .in("user_id", playerIds)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: userRows } = await supabase
    .from("users")
    .select("id,username,rating")
    .in("id", playerIds);

  const ratingById = new Map<string, number>();
  const usernameById = new Map<string, string>();
  for (const row of userRows ?? []) {
    const id = row.id as string;
    ratingById.set(id, typeof row.rating === "number" ? row.rating : 0);
    usernameById.set(id, ((row.username as string | null) ?? "").trim() || "Player");
  }

  const players: PlayerSnapshot[] = playerIds.map((id) => {
    const mine = (attemptRows ?? []).filter((row) => row.user_id === id);
    const summary = summarizeAttempts(
      mine.map((row) => ({
        passed: row.passed as number,
        total: row.total as number,
        created_at: row.created_at as string,
      })),
    );
    return {
      userId: id,
      rating: ratingById.get(id) ?? 0,
      attempts: summary.attempts,
      bestPassed: summary.bestPassed,
      bestTotal: summary.bestTotal,
      lastActiveAt: summary.lastActiveAt,
      solved: pickSolvedPlayerIds(
        mine.map((row) => ({
          user_id: row.user_id as string,
          passed: row.passed as number,
          total: row.total as number,
        })),
      ).has(id),
    };
  });

  /*
   * Display only.
   *
   * This used to be `Math.max(room.present, <client-reported count>)`, which let
   * a caller inflate the number and, worse, suppress their own
   * `abandoned` cleanup. The seat stamps are server-observed, so they are the
   * only trustworthy signal; the realtime list is still shown as a hint but can
   * never raise the count above what the server actually saw.
   */
  const presentSet = new Set(
    Array.isArray(body.presentUserIds)
      ? body.presentUserIds.filter((id): id is string => typeof id === "string")
      : [],
  );
  const playersPresent = presenceColumnUsable
    ? room.present
    : playerIds.filter((id) => presentSet.has(id)).length;

  const lobbyReason =
    phase === "lobby"
      ? resolveLobbyReason({
          createdAt: matchRow.created_at as string | null,
          playersPresent,
          playersTotal: playerIds.length,
          nowMs: serverNowMs,
        })
      : null;

  const ratingDelta = metadata.rating_delta as
    | { winner: number; loser: number }
    | undefined;

  return NextResponse.json(
    {
      matchId,
      mode: (matchRow.mode as string) ?? "ranked",
      phase,
      startedAt,
      timeLimitSeconds,
      endsAt: startedAt ? new Date(parseIsoMs(startedAt)! + timeLimitSeconds * 1000).toISOString() : null,
      remainingSeconds: remainingMatchSeconds({ startedAt, timeLimitSeconds, nowMs: serverNowMs }),
      serverNow,
      createdAt: matchRow.created_at as string | null,
      playersTotal: playerIds.length,
      playersPresent,
      lobbyReason,
      lobbyGiveUpAfterMs: LOBBY_ABANDON_MS,
      winnerId,
      completedAt:
        typeof metadata.completed_at === "string" && metadata.completed_at
          ? metadata.completed_at
          : null,
      forfeit: metadata.forfeit === true,
      timedOut: metadata.timed_out === true,
      opponentLeft: metadata.left === true,
      ratingDelta:
        ratingDelta && typeof ratingDelta.winner === "number" && typeof ratingDelta.loser === "number"
          ? ratingDelta
          : null,
      players: players.map((player) => ({
        ...player,
        username: usernameById.get(player.userId) ?? "Player",
        isYou: player.userId === userId,
        lastActiveLabel: formatLastActive(player.lastActiveAt, serverNowMs),
      })),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
