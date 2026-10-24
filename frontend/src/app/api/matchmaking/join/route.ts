import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { pickJoinableMatch } from "@/lib/match-room";
import { resolveRequestUserId } from "@/lib/resolve-request-user";

export const maxDuration = 60;

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
  if (["node", "javascript", "python", "cpp", "java", "c"].includes(normalized)) {
    return normalized === "javascript" ? "node" : normalized;
  }
  return null;
}

function sanitizeMatchType(value: unknown) {
  if (value === "2v2" || value === "ffa") return value as "2v2" | "ffa";
  return "1v1" as const;
}

function sanitizeMode(value: unknown) {
  return value === "unranked" ? "unranked" : "ranked";
}

/*
 * Join the queue, then ask the database to pair.
 *
 * This route used to do the pairing itself: an 8-second `while` loop that
 * polled the queue every 1.5s, re-read candidates to see if they were "still
 * there", deleted their rows to claim them, and only then created the match.
 * That had three problems:
 *
 *   1. Pairing only happened while a join request was in flight. `/status`
 *      never paired. Two players whose 8-second windows missed each other both
 *      sat queued and both timed out after 60s without ever being matched,
 *      despite being perfectly matchable.
 *   2. Claiming was delete-then-insert across separate round trips. A request
 *      that died in between removed both players from the queue and created no
 *      match at all.
 *   3. Seat 0 went to whichever request won the network race.
 *
 * `matchmaking_pair` does all of it in one Postgres transaction behind an
 * advisory lock: read, claim, create match, seat both players. PostgREST runs
 * a call in a single transaction, so a failure anywhere rolls the whole thing
 * back. There is no half-claimed queue and no request-timing dependency.
 */
export async function POST(request: Request) {
  let payload: JoinRequest;

  try {
    payload = (await request.json()) as JoinRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const mode = sanitizeMode(payload.mode);
  const timeLimitSeconds = sanitizeTimeLimitSeconds(payload.timeLimitSeconds);
  const language = sanitizeLanguage(payload.language);
  const matchType = sanitizeMatchType(payload.matchType);

  // Auth: verified bearer token first (API tests/bots), then the cookie.
  const userId = await resolveRequestUserId(request);
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

  /*
   * Rating drives ELO-nearest pairing; the membership check stops us seating
   * somebody who is already in a live match. They are independent reads, so run
   * them together rather than paying two sequential round trips on a button
   * press.
   */
  let myRating = 0;
  let existingMemberships: Array<{
    match_id?: string | null;
    matches?: {
      id: string;
      status: string | null;
      metadata: unknown;
      created_at?: string | null;
    }[] | null;
  }> = [];

  try {
    const [ratingResult, membershipResult] = await Promise.all([
      supabase.from("users").select("rating").eq("id", userId).maybeSingle(),
      /*
       * Never seat somebody who is already in a live match.
       *
       * This is the other half of the "ghost victory". A player whose previous
       * duel had been decided days earlier could still have that arena open, so
       * the new match seated them while their browser sat on the old one. The
       * new room then waited for a seat that was never going to be filled, and
       * the stale page kept showing a result from a match that was already over.
       *
       * `pickJoinableMatch` requires the match's own clock, so anything whose
       * time has run out — or a lobby that has been open far too long — is
       * ignored and the player queues for a real opponent instead.
       */
      supabase
        .from("match_players")
        .select("match_id, matches!inner(id, status, metadata, created_at)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(5),
    ]);

    if (typeof ratingResult.data?.rating === "number") myRating = ratingResult.data.rating;
    existingMemberships = (membershipResult.data ?? []) as unknown as typeof existingMemberships;
  } catch (error) {
    console.error("Failed to load join context", error);
  }

  const existingMatchId = pickJoinableMatch(
    existingMemberships.map((row) => {
      const match = Array.isArray(row.matches) ? row.matches[0] : row.matches;
      const metadata = (match?.metadata ?? {}) as Record<string, unknown>;
      const winnerId =
        typeof metadata.winner_id === "string" && metadata.winner_id ? metadata.winner_id : null;
      const completedAt =
        typeof metadata.completed_at === "string" && metadata.completed_at
          ? metadata.completed_at
          : null;
      return {
        match_id: row.match_id,
        status: match?.status ?? null,
        winner_id: winnerId,
        completed_at: completedAt,
        started_at:
          typeof metadata.started_at === "string" && metadata.started_at
            ? metadata.started_at
            : null,
        created_at: match?.created_at ?? null,
        time_limit_seconds:
          typeof metadata.time_limit === "number" ? metadata.time_limit : null,
      };
    }),
  );

  if (existingMatchId) {
    return NextResponse.json({ matchId: existingMatchId }, { status: 200 });
  }

  // 1. Take or refresh this player's place in the queue.
  const { error: enqueueError } = await supabase.rpc("matchmaking_enqueue", {
    p_user_id: userId,
    p_mode: mode,
    p_match_type: matchType,
    p_time_limit_seconds: timeLimitSeconds,
    p_language: language ?? "node",
    p_rating: myRating,
  });

  if (enqueueError) {
    console.error("Failed to enqueue", enqueueError);
    return NextResponse.json(
      { error: `Failed to join matchmaking: ${enqueueError.message}` },
      { status: 500 },
    );
  }

  // 2. One atomic pairing pass. Returns immediately either way.
  const { data: pairResult, error: pairError } = await supabase.rpc("matchmaking_pair", {
    p_user_id: userId,
  });

  if (pairError) {
    console.error("Pairing failed", pairError);
    return NextResponse.json({ error: "Failed to pair match" }, { status: 500 });
  }

  const result = (pairResult ?? {}) as {
    status?: string;
    matchId?: string;
    queuedAt?: string;
    ahead?: number;
    message?: string;
  };

  if (result.status === "matched" && result.matchId) {
    return NextResponse.json({ matchId: result.matchId }, { status: 200 });
  }

  if (result.status === "error") {
    return NextResponse.json({ error: result.message ?? "Matchmaking error" }, { status: 500 });
  }

  // Still waiting: the client polls /status, which also runs a pairing pass, so
  // a player who arrives later is matched by whichever side asks first.
  return NextResponse.json(
    { status: "queued", queuedAt: new Date().toISOString(), ahead: result.ahead ?? 0 },
    { status: 200 },
  );
}
