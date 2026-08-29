import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { validateReport } from "@/lib/report";

export async function POST(request: Request) {
  let payload: { reportedId?: string; reason?: string; description?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const reportedId = payload.reportedId?.trim();
  const reason = payload.reason?.trim();
  const description = payload.description?.trim() || "";

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const validation = validateReport({ reporterId: user.id, reportedId: reportedId ?? "", reason: reason ?? "" });
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_id: reportedId,
    reason: reason,
    description,
  });

  if (insertError) {
    console.error("Failed to store report", insertError);
    return NextResponse.json({ error: "Unable to submit report right now." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}