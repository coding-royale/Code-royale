import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { summarizeAttempts } from "@/lib/match-activity";

type RouteParams = Promise<{ matchId: string }> | { matchId: string };

/** Real opponent progress for the arena: attempts, best, last active. */
export async function GET(_request: Request, { params }: { params: RouteParams }) {
  const resolved = await params;
  const matchId = resolved?.matchId?.trim() || null;
  if (!matchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = authData.user.id;

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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows } = await supabase
    .from("match_attempts")
    .select("user_id,passed,total,created_at")
    .eq("match_id", matchId)
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const summary = summarizeAttempts(
    (rows ?? []).map((r) => ({
      passed: r.passed as number,
      total: r.total as number,
      created_at: r.created_at as string,
    })),
  );

  return NextResponse.json(summary);
}
