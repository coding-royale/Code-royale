import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

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

  // Also check if user is still in queue — not yet matched
  // Find most recent match via match_players.joined_at (not created_at)
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  // match_players has joined_at, not created_at — use joined_at
  const { data: playerRow, error } = await supabase
    .from("match_players")
    .select("match_id, joined_at")
    .eq("user_id", userId)
    .gte("joined_at", threeMinutesAgo)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to check match status", error);
    // Try fallback without gte in case joined_at filter fails
    const fallback = await supabase
      .from("match_players")
      .select("match_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ matchId: fallback.data?.match_id ?? null }, { status: 200 });
  }

  // Also handle case where match_players is empty but we are still queued — return null so client keeps polling
  if (!playerRow?.match_id) {
    // Optional: check if there is an active match via status poll timeout logic — just return null
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  // Verify match is still active/pending (not completed/cancelled)
  const { data: matchRow } = await supabase
    .from("matches")
    .select("id, status")
    .eq("id", playerRow.match_id)
    .maybeSingle();

  if (!matchRow) {
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  // If match is completed/cancelled and ended more than 3m ago, ignore?
  // For now return it — client will navigate and page will show result or redirect
  return NextResponse.json({ matchId: playerRow.match_id }, { status: 200 });
}
