import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase";
import { createSupabaseServiceClient } from "../../../../lib/supabase-service";
import { serverCached } from "../../../../lib/server-cache";

const MAX_IDS = 100;

function parseUserIds(raw: string | null) {
  if (!raw) return [];

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values)).slice(0, MAX_IDS);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userIds = parseUserIds(url.searchParams.get("userIds"));

  if (userIds.length === 0) {
    return NextResponse.json({ counts: {} }, { status: 200 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  // Friend counts change only when the friend graph changes — cache the DB
  // work for 60s keyed by the requested user set.
  const counts = await serverCached(`friend-counts:${userIds.join(",")}`, 60_000, async () => {
    const [firstHalf, secondHalf] = await Promise.all([
      supabase
        .from("connections")
        .select("user_id,connection_id")
        .eq("status", "accepted")
        .in("user_id", userIds),
      supabase
        .from("connections")
        .select("user_id,connection_id")
        .eq("status", "accepted")
        .in("connection_id", userIds),
    ]);

    if (firstHalf.error || secondHalf.error) {
      throw new Error(firstHalf.error?.message ?? secondHalf.error?.message ?? "Failed to load friend counts");
    }

    const targetSet = new Set(userIds);
    const result: Record<string, number> = {};

    for (const userId of userIds) {
      result[userId] = 0;
    }

    for (const row of firstHalf.data ?? []) {
      if (targetSet.has(row.user_id)) {
        result[row.user_id] = (result[row.user_id] ?? 0) + 1;
      }
    }

    for (const row of secondHalf.data ?? []) {
      if (targetSet.has(row.connection_id)) {
        result[row.connection_id] = (result[row.connection_id] ?? 0) + 1;
      }
    }

    return result;
  });

  return NextResponse.json({ counts }, { status: 200 });
}
