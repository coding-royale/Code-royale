import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase";
import { createSupabaseServiceClient } from "../../../../lib/supabase-service";

// GET /api/clubs/list — list clubs with optional search, including member counts & top players
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServiceClient();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData } = await supabaseAuth.auth.getUser();
  const viewerId = authData.user?.id ?? "";

  // Get clubs sorted by trophies
  let query = supabase
    .from("clubs")
    .select("*")
    .order("trophies", { ascending: false })
    .limit(50);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: clubs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich each club with member count and top 3 players
  const enriched = await Promise.all(
    (clubs ?? []).map(async (club) => {
      const { count } = await supabase
        .from("club_members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id);

      const { data: topMembers } = await supabase
        .from("club_members")
        .select("user_id, role, trophies_contributed, joined_at")
        .eq("club_id", club.id)
        .order("trophies_contributed", { ascending: false })
        .limit(3);

      // Get player stats for top members
      const topPlayers = await Promise.all(
        (topMembers ?? []).map(async (m) => {
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
          };
        })
      );

      return {
        ...club,
        memberCount: count ?? 0,
        topPlayers,
      };
    })
  );

  // If user is signed in, also check if they are in a club
  let myClub = null;
  if (viewerId) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", viewerId)
      .maybeSingle();

    if (membership) {
      myClub = enriched.find((c) => c.id === membership.club_id) ?? null;
    }
  }

  return NextResponse.json({ clubs: enriched, myClub });
}