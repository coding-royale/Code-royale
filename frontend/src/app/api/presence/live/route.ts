import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { isLiveMatchRow } from "@/lib/presence";

/**
 * Live presence for one user: are they in a match right now, and may
 * others spectate them? Online-ness itself comes from the realtime
 * presence channel on the client; this covers what realtime can't see.
 */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

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

  const [{ data: userRow }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("id,allow_spectate").eq("id", userId).maybeSingle(),
    supabase.from("match_players").select("match_id").eq("user_id", userId).limit(20),
  ]);

  // Default open when the flag is missing (older rows / local-only users).
  const spectateAllowed =
    !userRow || (userRow as { allow_spectate?: boolean | null }).allow_spectate !== false;

  const matchIds = Array.from(new Set((memberships ?? []).map((m) => m.match_id as string)));
  if (matchIds.length === 0) {
    return NextResponse.json({ userId, inMatch: false, matchId: null, spectateAllowed });
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("id,status,metadata,started_at,created_at")
    .in("id", matchIds)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  const now = Date.now();
  const live = (matches ?? []).find((m) =>
    isLiveMatchRow(
      {
        status: m.status as string,
        metadata: m.metadata,
        started_at: m.started_at as string | null,
      },
      now,
    ),
  );

  return NextResponse.json({
    userId,
    inMatch: !!live,
    matchId: live?.id ?? null,
    spectateAllowed,
  });
}
