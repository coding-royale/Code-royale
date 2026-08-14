import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase";
import { createSupabaseServiceClient } from "../../../../lib/supabase-service";

// POST /api/clubs/create — create a new club (server-side auth)
export async function POST(req: NextRequest) {
  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewerId = authData.user.id;

  let body: {
    name?: string;
    logo?: string;
    emblem?: string;
    privacy?: string;
    maxMembers?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Club name is required" }, { status: 400 });
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

  // Create club
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .insert({
      name,
      logo: body.logo || "⚔️",
      emblem: body.emblem || "sword",
      privacy: body.privacy || "public",
      max_members: body.maxMembers || 20,
      owner_id: viewerId,
    })
    .select()
    .single();

  if (clubError) {
    return NextResponse.json({ error: clubError.message }, { status: 500 });
  }

  // Add owner as host member
  const { error: memberError } = await supabase.from("club_members").insert({
    club_id: club.id,
    user_id: viewerId,
    role: "host",
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ club });
}