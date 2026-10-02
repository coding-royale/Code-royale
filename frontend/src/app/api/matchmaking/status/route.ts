import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isFreshMatch, resolveStatusCutoff } from "@/lib/matchmaking";
import { isMatchJoinable } from "@/lib/match-room";
import { resolveRequestUserId } from "@/lib/resolve-request-user";

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

  // userId already resolved above

  // Only matches created after this queue attempt started count. Without
  // `since`, a player who played 2 minutes ago instantly sees that OLD match
  // as "match found" — a lie. The client sends ?since=<queue start ISO>.
  const sinceParam = new URL(request.url).searchParams.get("since");
  const cutoffIso = resolveStatusCutoff(sinceParam);

  // match_players historically used created_at; newer schemas use joined_at.
  // NOTE: selecting a column that doesn't exist makes PostgREST return an
  // error (not null), which previously made status ALWAYS return
  // { matchId: null }. That is why the match creator teleported instantly
  // (join returns matchId directly) while the opponent polled status for
  // 60s and timed out. Try joined_at first, fall back to created_at.
  type MembershipRow = {
    match_id: string | null;
    joined_at?: string | null;
    created_at?: string | null;
    // PostgREST returns an embedded to-one relation as a one-element array.
    matches?: { id: string; status: string | null; metadata: unknown }[] | null;
  };

  const selectColumns =
    "match_id, joined_at, matches!inner(id, status, metadata)";
  const legacyColumns = "match_id, created_at, matches!inner(id, status, metadata)";

  let rows: MembershipRow[] = [];
  {
    const { data, error } = await supabase
      .from("match_players")
      .select(selectColumns)
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(5);

    if (!error) {
      rows = (data ?? []) as unknown as MembershipRow[];
    } else if (error.message?.includes("joined_at")) {
      // Legacy schema without joined_at — retry with created_at.
      const legacy = await supabase
        .from("match_players")
        .select(legacyColumns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (legacy.error) {
        console.error("Failed to check match status", legacy.error);
        return NextResponse.json({ matchId: null }, { status: 200 });
      }
      rows = (legacy.data ?? []) as unknown as MembershipRow[];
    } else {
      console.error("Failed to check match status", error);
      return NextResponse.json({ matchId: null }, { status: 200 });
    }
  }

  // Also handle case where match_players is empty but we are still queued —
  // return null so the client keeps polling.
  if (rows.length === 0) {
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  /*
   * Only a match that is still playable may be handed back.
   *
   * This used to take the newest row and trust it. A player who still had a tab
   * open on a match decided days earlier therefore had that corpse outrank the
   * live lobby, and got sent back into a finished duel while the real room sat
   * empty. A recorded `winner_id` beats `status` because the resolution routes
   * write the winner without ever moving `status` off "active".
   */
  const joinable = rows.filter((row) => {
    const match = Array.isArray(row.matches) ? row.matches[0] : row.matches;
    const metadata = (match?.metadata ?? {}) as Record<string, unknown>;
    const winnerId =
      typeof metadata.winner_id === "string" && metadata.winner_id ? metadata.winner_id : null;
    return isMatchJoinable({ status: match?.status ?? null, winnerId });
  });

  if (joinable.length === 0) {
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  // Rows arrive newest first, so the first playable one is the freshest.
  const row = joinable[0];
  const joinedAt = row.joined_at ?? row.created_at ?? null;
  if (!row.match_id || !isFreshMatch(joinedAt, cutoffIso)) {
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  // Verify match still exists (select only columns guaranteed by the base
  // schema — `status` does not exist on fresh resets and would error).
  const { data: matchRow } = await supabase
    .from("matches")
    .select("id")
    .eq("id", row.match_id)
    .maybeSingle();

  if (!matchRow) {
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  return NextResponse.json({ matchId: row.match_id }, { status: 200 });
}
