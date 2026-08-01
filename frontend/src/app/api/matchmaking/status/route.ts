import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export async function GET() {
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

  const userId = authData.user.id;

  // Find the most recent match the user was added to (within the last 3 minutes).
  // This prevents stale match_players rows from old matches being returned.
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: playerRow, error } = await supabase
    .from("match_players")
    .select("match_id")
    .eq("user_id", userId)
    .gte("created_at", threeMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to check match status", error);
    return NextResponse.json({ matchId: null }, { status: 200 });
  }

  return NextResponse.json({ matchId: playerRow?.match_id ?? null }, { status: 200 });
}
