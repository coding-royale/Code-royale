import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isFreshMatch, resolveStatusCutoff } from "@/lib/matchmaking";

function getUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf-8");
    const data = JSON.parse(json);
    return typeof data.sub === "string" ? data.sub : null;
  } catch { return null; }
}

export async function GET(request: Request) {
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
  let playerRow: { match_id?: string | null; joined_at?: string | null; created_at?: string | null } | null = null;
  {
    const { data, error } = await supabase
      .from("match_players")
      .select("match_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      playerRow = data as { match_id?: string | null; joined_at?: string | null } | null;
    } else if (error.message?.includes("joined_at")) {
      // Legacy schema without joined_at — retry with created_at.
      const legacy = await supabase
        .from("match_players")
        .select("match_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (legacy.error) {
        console.error("Failed to check match status", legacy.error);
        return NextResponse.json({ matchId: null }, { status: 200 });
      }
      playerRow = legacy.data as { match_id?: string | null; created_at?: string | null } | null;
    } else {
      console.error("Failed to check match status", error);
      return NextResponse.json({ matchId: null }, { status: 200 });
    }
  }

  // Also handle case where match_players is empty but we are still queued — return null so client keeps polling
  const row = playerRow;
  const joinedAt = row?.joined_at ?? row?.created_at ?? null;
  if (!row?.match_id || !isFreshMatch(joinedAt, cutoffIso)) {
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
