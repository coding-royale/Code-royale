import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { serverCached } from "@/lib/server-cache";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const difficulty = url.searchParams.get("difficulty")?.toLowerCase();

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Supabase server client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // The question bank is seeded and changes rarely — cache it for 10 minutes.
  const cacheKey = `practice-questions:${difficulty ?? "all"}`;
  let questions;
  try {
    questions = await serverCached(cacheKey, 10 * 60_000, async () => {
      let query = supabase
        .from("practice_questions")
        .select("id,title,slug,difficulty")
        .order("title", { ascending: true });

      if (difficulty) {
        query = query.eq("difficulty", difficulty);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error("Failed to fetch practice questions");
      }
      return data ?? [];
    });
  } catch (error) {
    console.error("Failed to fetch practice questions", error);
    return NextResponse.json({ error: "Failed to load questions" }, { status: 500 });
  }

  // Solved state changes slowly per user — cache it for 60s.
  let solvedIds = new Set<string>();
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!authError && user?.id) {
      solvedIds = await serverCached(`practice-solved:${user.id}`, 60_000, async () => {
        const { data: solvedRows } = await supabase
          .from("practice_submissions")
          .select("question_id")
          .eq("user_id", user.id)
          .eq("passed", true);
        return new Set((solvedRows ?? []).map((row) => row.question_id as string));
      });
    }
  } catch {
    // anonymous users see all questions with solved: false
  }

  const response = {
    questions: (questions ?? []).map((question) => ({
      ...question,
      solved: solvedIds.has(question.id as string),
    })),
  };

  return NextResponse.json(response, { headers: { "cache-control": "private, max-age=60" } });
}