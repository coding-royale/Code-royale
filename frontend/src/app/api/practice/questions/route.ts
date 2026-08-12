import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const difficulty = url.searchParams.get("difficulty");

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Supabase server client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  let query = supabase
    .from("practice_questions")
    .select("id,title,slug,difficulty")
    .order("title", { ascending: true });

  if (difficulty) {
    query = query.eq("difficulty", difficulty.toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch practice questions", error);
    return NextResponse.json({ error: "Failed to load questions" }, { status: 500 });
  }

  let solvedIds = new Set<string>();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!authError && user?.id) {
      const { data: solvedRows } = await supabase
        .from("practice_submissions")
        .select("question_id")
        .eq("user_id", user.id)
        .eq("passed", true);
      solvedIds = new Set((solvedRows ?? []).map((row) => row.question_id as string));
    }
  } catch {
    // anonymous users see all questions with solved: false
  }

  const questions = (data ?? []).map((question) => ({
    ...question,
    solved: solvedIds.has(question.id as string),
  }));

  return NextResponse.json({ questions });
}
