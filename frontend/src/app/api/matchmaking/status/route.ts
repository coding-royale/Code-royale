import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { resolveRequestUserId } from "@/lib/resolve-request-user";

/*
 * Poll for a match, and pair in the process.
 *
 * The old version only READ: it looked for a match_players row and returned it.
 * Pairing lived entirely inside `/api/matchmaking/join`'s 8-second request
 * loop, so if two players' join windows missed each other, nothing ever paired
 * them again. Both sat queued, both polled for 60s, and both gave up while
 * perfectly matchable.
 *
 * One call does both jobs now. `matchmaking_pair`:
 *
 *   - returns the live room if this player is already seated (it checks the
 *     same joinability rule as match-room.ts: decided, completed, lobby older
 *     than 10 minutes, or clock expired all mean "not your room any more")
 *   - otherwise runs a pairing pass and returns the room it just created, or
 *     "waiting"
 *
 * That replaces three round trips (membership query, optional match existence
 * query, pairing RPC) with one, which is what makes a 500ms poll affordable.
 */
export async function GET(request: Request) {
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

  const { data, error } = await supabase.rpc("matchmaking_pair", {
    p_user_id: userId,
  });

  if (error) {
    // A transient failure must not end the search: the client keeps polling.
    console.error("Failed to check match status", error);
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  const result = (data ?? {}) as { status?: string; matchId?: string };
  if (result.status === "matched" && result.matchId) {
    return NextResponse.json({ matchId: result.matchId }, { status: 200 });
  }

  return NextResponse.json({ matchId: null }, { status: 200 });
}
