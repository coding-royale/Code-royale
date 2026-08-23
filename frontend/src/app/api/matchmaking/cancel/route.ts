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

export async function POST(request: Request) {
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

  const { error } = await supabase.from("matchmaking_queue").delete().eq("user_id", userId);

  if (error) {
    console.error("Failed to cancel matchmaking", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
