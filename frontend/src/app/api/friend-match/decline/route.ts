import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export async function POST(request: Request) {
  let payload: { matchId?: string };
  try {
    payload = (await request.json()) as { matchId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const matchId = typeof payload.matchId === "string" ? payload.matchId.trim() : "";
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
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

  const { data: matchRow } = await supabase
    .from("matches")
    .select("id,metadata")
    .eq("id", matchId)
    .maybeSingle();

  if (!matchRow) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const meta =
    matchRow.metadata && typeof matchRow.metadata === "object"
      ? (matchRow.metadata as Record<string, unknown>)
      : {};
  const invite =
    meta.friend_invite && typeof meta.friend_invite === "object"
      ? (meta.friend_invite as Record<string, unknown>)
      : null;

  const isParticipant =
    invite && (invite.inviter_id === userId || invite.invitee_id === userId);
  if (!invite || !isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase.from("matches").delete().eq("id", matchId);
  if (deleteError) {
    console.error("Failed to decline challenge", deleteError);
    return NextResponse.json({ error: "Failed to decline challenge" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
