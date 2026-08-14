import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase";
import { createSupabaseServiceClient } from "../../../../lib/supabase-service";

// GET /api/clubs/detail?clubId=... — single club with full member list
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServiceClient();

  const { searchParams } = new URL(req.url);
  const clubId = searchParams.get("clubId")?.trim();

  if (!clubId) {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const { data: club, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single();

  if (error || !club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("club_members")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);

  const { data: memberRows } = await supabase
    .from("club_members")
    .select("user_id, role, trophies_contributed, joined_at")
    .eq("club_id", clubId)
    .order("trophies_contributed", { ascending: false })
    .limit(50);

  const members = await Promise.all(
    (memberRows ?? []).map(async (m) => {
      const { data: userRow } = await supabase
        .from("users")
        .select("username")
        .eq("id", m.user_id)
        .maybeSingle();

      return {
        id: m.user_id,
        username: userRow?.username ?? "Player",
        avatar: ((userRow?.username ?? "P") as string).substring(0, 2).toUpperCase(),
        trophies: m.trophies_contributed,
        role: m.role,
        joinedAt: m.joined_at,
      };
    })
  );

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData } = await supabaseAuth.auth.getUser();
  const viewerId = authData.user?.id ?? "";
  const isMember = members.some((m) => m.id === viewerId);
  const viewerRole = members.find((m) => m.id === viewerId)?.role ?? null;

  return NextResponse.json({
    club: { ...club, memberCount: count ?? 0, members },
    viewer: { viewerId, isMember, role: viewerRole },
  });
}