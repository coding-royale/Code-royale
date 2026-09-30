import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { JOIN_SEARCH_TIMEOUT_MS } from "@/lib/matchmaking";
import { MATCH_STATUS_PENDING, pickJoinableMatch } from "@/lib/match-room";

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

function resolveRankedDifficultyFromRating(rating: number) {
  if (rating < 300) return "easy";
  if (rating < 700) return "medium";
  return "hard";
}

function getUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf-8");
    const data = JSON.parse(json);
    return typeof data.sub === "string" ? data.sub : null;
  } catch {
    return null;
  }
}

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

  // Auth: try Bearer token first (for API tests), then cookies (for browser)
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    userId = getUserIdFromToken(token);
  }
  if (!userId) {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (!authError && authData.user?.id) userId = authData.user.id;
  }
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

  // Fetch my rating for ELO-nearest matching
  let myRating = 0;
  try {
    const { data: userRow } = await supabase
      .from("users")
      .select("rating")
      .eq("id", userId)
      .maybeSingle();
    if (typeof userRow?.rating === "number") myRating = userRow.rating;
  } catch {
    // fallback 0
  }

  // Cleanup expired entries (2 min TTL + safety)
  await supabase.from("matchmaking_queue").delete().lt("expires_at", new Date().toISOString());

  /*
   * Never seat somebody who is already in a live match.
   *
   * This is the other half of the "ghost victory". A player whose previous duel
   * had been decided days earlier could still have that arena open, so the new
   * match seated them while their browser sat on the old one. The new room then
   * waited for a seat that was never going to be filled, and the stale page kept
   * showing a result from a match that was already over. If the player already
   * holds a playable match, send them back to it rather than duplicating them.
   */
  const { data: existingMemberships } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(id, status, metadata)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(5);

  const existingMatchId = pickJoinableMatch(
    ((existingMemberships ?? []) as unknown as Array<{
      match_id?: string | null;
      // PostgREST returns an embedded to-one relation as a one-element array.
      matches?: { id: string; status: string | null; metadata: unknown }[] | null;
    }>).map((row) => {
      const match = Array.isArray(row.matches) ? row.matches[0] : row.matches;
      const metadata = (match?.metadata ?? {}) as Record<string, unknown>;
      const winnerId =
        typeof metadata.winner_id === "string" && metadata.winner_id ? metadata.winner_id : null;
      return { match_id: row.match_id, status: match?.status ?? null, winner_id: winnerId };
    }),
  );

  if (existingMatchId) {
    return NextResponse.json({ matchId: existingMatchId }, { status: 200 });
  }

  // Ensure single queue entry per user (remove stale self)
  await supabase.from("matchmaking_queue").delete().eq("user_id", userId);

  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const { error: enqueueError } = await supabase.from("matchmaking_queue").insert({
    user_id: userId,
    mode,
    rating: myRating,
    match_type: matchType,
    time_limit_seconds: timeLimitSeconds,
    language: language ?? "node",
    payload: {},
    expires_at: expiresAt,
  });

  if (enqueueError) {
    console.error("Failed to enqueue", enqueueError);
    return NextResponse.json({ error: `Failed to join matchmaking: ${enqueueError.message}` }, { status: 500 });
  }

  // Polling loop: try to find nearest ELO opponent(s) and create match.
  // Kept short on purpose: Vercel Hobby kills functions at ~10s, so join
  // returns fast and the client status-poll does the long wait instead.
  const searchStart = Date.now();
  const queuedAt = new Date(searchStart).toISOString();
  const searchTimeoutMs = JOIN_SEARCH_TIMEOUT_MS;
  const pollIntervalMs = 1500;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Required players per match_type
  const requiredTotal = matchType === "1v1" ? 2 : 4;
  const requiredOpponents = requiredTotal - 1;

  while (Date.now() - searchStart < searchTimeoutMs) {
    // Fetch best candidates ordered by rating closeness
    const { data: candidates, error: pollError } = await supabase
      .from("matchmaking_queue")
      .select("user_id, rating, created_at")
      .eq("mode", mode)
      .eq("match_type", matchType)
      .neq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(20);

    if (pollError) {
      console.error("Failed to query matchmaking queue", pollError);
      break;
    }

    if (!candidates || candidates.length < requiredOpponents) {
      await sleep(pollIntervalMs);
      continue;
    }

    // Sort by ELO distance, then by waiting time
    const sorted = [...candidates]
      .map((c) => ({
        user_id: c.user_id as string,
        rating: typeof c.rating === "number" ? c.rating : 0,
        created_at: c.created_at as string,
        dist: Math.abs((typeof c.rating === "number" ? c.rating : 0) - myRating),
      }))
      .sort((a, b) => a.dist - b.dist || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const chosen = sorted.slice(0, requiredOpponents);
    const opponentIds = chosen.map((c) => c.user_id);

    // Check if all chosen still exist (race guard): re-fetch them
    const { data: stillThere } = await supabase
      .from("matchmaking_queue")
      .select("user_id")
      .in("user_id", opponentIds);

    const stillIds = new Set((stillThere ?? []).map((r) => r.user_id as string));
    const allStillPresent = opponentIds.every((id) => stillIds.has(id));
    if (!allStillPresent) {
      await sleep(pollIntervalMs);
      continue;
    }

    // Also verify we are still queued (we might have been matched by another creator)
    const { data: selfStill } = await supabase
      .from("matchmaking_queue")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!selfStill) {
      /*
       * Someone else claimed the pair while we were polling, so our queue row
       * is gone. The match we were just put into is waiting — hand it back.
       *
       * This lookup used to take the newest `match_players` row with no
       * freshness and no joinability filter, which is the "ghost victory" in
       * its purest form: a player whose last duel was decided days earlier had
       * that corpse as their newest row, so joining sent them straight back
       * into a finished match while the room they were actually matched into
       * sat empty waiting for them. Only a match created during THIS search
       * and still playable may be returned.
       */
      const { data: recent } = await supabase
        .from("match_players")
        .select("match_id, joined_at, matches!inner(id, status, metadata)")
        .eq("user_id", userId)
        .gte("joined_at", queuedAt)
        .order("joined_at", { ascending: false })
        .limit(5);

      const matchIdFromThisSearch = pickJoinableMatch(
        ((recent ?? []) as unknown as Array<{
          match_id?: string | null;
          matches?: { id: string; status: string | null; metadata: unknown }[] | null;
        }>).map((row) => {
          const match = Array.isArray(row.matches) ? row.matches[0] : row.matches;
          const metadata = (match?.metadata ?? {}) as Record<string, unknown>;
          const winnerId =
            typeof metadata.winner_id === "string" && metadata.winner_id ? metadata.winner_id : null;
          return { match_id: row.match_id, status: match?.status ?? null, winner_id: winnerId };
        }),
      );

      if (matchIdFromThisSearch) {
        return NextResponse.json({ matchId: matchIdFromThisSearch }, { status: 200 });
      }
      await sleep(pollIntervalMs);
      continue;
    }

    // Try to claim by deleting queue entries for all participants (atomic-ish)
    const allIds: string[] = [userId, ...opponentIds];
    const { data: deletedRows, error: deleteError } = await supabase
      .from("matchmaking_queue")
      .delete()
      .in("user_id", allIds)
      .select("user_id");

    if (deleteError) {
      console.error("Failed to claim queue slots", deleteError);
      await sleep(pollIntervalMs);
      continue;
    }

    const deletedIds = new Set((deletedRows ?? []).map((r) => r.user_id as string));
    // We must have deleted ourselves + all opponents
    if (deletedIds.size < allIds.length || !deletedIds.has(userId)) {
      // Someone else claimed one of the slots — re-queue self if we were deleted?
      // If we weren't deleted, we are still queued (or need re-queue)
      const stillQueued = deletedIds.has(userId) ? false : true;
      if (!stillQueued) {
        // We were removed but not enough opponents — re-insert self
        await supabase.from("matchmaking_queue").insert({
          user_id: userId,
          mode,
          rating: myRating,
          match_type: matchType,
          time_limit_seconds: timeLimitSeconds,
          language: language ?? "node",
          payload: {},
          expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        });
      }
      // If opponents were partially deleted, they are gone — continue searching
      await sleep(pollIntervalMs);
      continue;
    }

    // All slots claimed successfully — create match
    let difficulty: "easy" | "medium" | "hard" | null = null;
    if (mode === "ranked") {
      const ratings = [myRating, ...chosen.map((c) => c.rating)];
      const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
      difficulty = resolveRankedDifficultyFromRating(avg);
    }

    let questionQuery = supabase.from("practice_questions").select("id,slug,difficulty");
    if (difficulty) questionQuery = questionQuery.eq("difficulty", difficulty);
    let { data: availableQuestions, error: questionsError } = await questionQuery;
    if ((!availableQuestions || availableQuestions.length === 0) && difficulty) {
      const fallback = await supabase.from("practice_questions").select("id,slug,difficulty");
      availableQuestions = fallback.data;
      questionsError = fallback.error;
    }
    if (questionsError || !availableQuestions || availableQuestions.length === 0) {
      console.error("No PvP questions available", questionsError);
      // Rollback: re-queue players? Best to just error
      return NextResponse.json({ error: "PvP questions not seeded" }, { status: 500 });
    }
    const chosenQ = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

    /*
     * The match opens as a room, not a running clock: `pending` means "seated
     * but not started". Both players are inserted here, but `started_at` is
     * deliberately left unset — the arena's sync endpoint writes it exactly
     * once, after both players are actually in the room. Previously the
     * creator got the instant `join` happened and the opponent only found out
     * on the next status poll, so the two clocks differed by however long that
     * poll took to notice.
     */
    const { data: matchRow, error: matchError } = await supabase
      .from("matches")
      .insert({
        mode,
        status: MATCH_STATUS_PENDING,
        created_by: userId,
        metadata: {
          question_id: chosenQ.id,
          question_difficulty: chosenQ.difficulty,
          time_limit: timeLimitSeconds,
          language,
          match_type: matchType,
          trophy_multiplier: timeLimitSeconds >= 60 * 60 ? 1.5 : 1,
          started_at: null,
          mode,
        },
      })
      .select("id")
      .single();

    if (matchError || !matchRow?.id) {
      console.error("Failed to create match", matchError);
      return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
    }

    const matchId = matchRow.id as string;
    const playerIds = [userId, ...opponentIds];
    const rows = playerIds.map((pid, idx) => {
      if (matchType === "2v2") {
        // Team 0: idx 0,1 ; Team 1: idx 2,3
        return { match_id: matchId, user_id: pid, seat: idx, team: idx < 2 ? 0 : 1 };
      }
      if (matchType === "ffa") {
        return { match_id: matchId, user_id: pid, seat: idx, team: null as unknown as number };
      }
      return { match_id: matchId, user_id: pid, seat: idx, team: null as unknown as number };
    });

    // For FFA / 1v1, team should be null; omit team column
    const insertRows = rows.map((r) => {
      if (r.team === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { team: _team, ...rest } = r as unknown as Record<string, unknown>;
        return rest;
      }
      return r;
    });

    const { error: playersError } = await supabase.from("match_players").insert(insertRows as unknown[]);

    if (playersError) {
      console.error("Failed to create match players", playersError);
      await supabase.from("matches").delete().eq("id", matchId);
      // Re-queue? Not needed, slots already cleared
      return NextResponse.json({ error: "Failed to create match players" }, { status: 500 });
    }

    return NextResponse.json({ matchId }, { status: 200 });
  }

  // Timeout — keep queue for status polling (don't delete yet, let status poll handle or expire).
  // queuedAt lets the client pass ?since= so status never returns pre-queue matches.
  return NextResponse.json({ status: "queued", queuedAt }, { status: 200 });
}
