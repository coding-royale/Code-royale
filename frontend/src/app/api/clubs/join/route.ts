import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase";
import { createSupabaseServiceClient } from "../../../../lib/supabase-service";

// POST /api/clubs/join — join a public club or request to join a private one
export async function POST(req: NextRequest) {
  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewerId = authData.user.id;

  let body: { clubId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const clubId = body.clubId?.trim();
  if (!clubId) {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Check if user is already in a club
  const { data: existingMembership } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", viewerId)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json({ error: "You are already in a club. Leave first." }, { status: 400 });
  }

  // Get club details
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single();

  if (clubError || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  // Check member count
  const { count } = await supabase
    .from("club_members")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);

  if ((count ?? 0) >= club.max_members) {
    return NextResponse.json({ error: "Club is full" }, { status: 400 });
  }

  // If private, create join request
  if (club.privacy === "private") {
    const { error: reqError } = await supabase
      .from("club_join_requests")
      .insert({ club_id: clubId, user_id: viewerId });

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 });
    }

    return NextResponse.json({ status: "request_sent" });
  }

  // Public — join immediately
  const { error: joinError } = await supabase
    .from("club_members")
    .insert({ club_id: clubId, user_id: viewerId, role: "member" });

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "joined", club });
}