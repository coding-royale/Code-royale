import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type SolvedQuestionRow = {
  question_id: string;
  created_at: string;
  question: {
    slug?: string | null;
    title?: string | null;
    difficulty?: string | null;
  } | null;
};

// Returns the list of practice problems a user has solved (passed a submit),
// newest first. Uses the service-role client because practice_submissions is
// RLS-scoped to the row owner, but profiles are viewable for other users.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("practice_submissions")
    .select("question_id, created_at, question:practice_questions(slug,title,difficulty)")
    .eq("user_id", userId)
    .eq("passed", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load solved questions", error);
    return NextResponse.json({ error: "Failed to load solved questions" }, { status: 500 });
  }

  const seen = new Set<string>();
  const solvedQuestions: Array<{
    questionId: string;
    slug: string | null;
    title: string;
    difficulty: string;
    solvedAt: string;
  }> = [];

  for (const row of (data ?? []) as SolvedQuestionRow[]) {
    const question = row.question;
    if (!question) continue;
    if (seen.has(row.question_id)) continue;
    seen.add(row.question_id);
    solvedQuestions.push({
      questionId: row.question_id,
      slug: question.slug ?? null,
      title: question.title ?? "Untitled",
      difficulty: question.difficulty ?? "easy",
      solvedAt: row.created_at,
    });
  }

  return NextResponse.json({ solvedQuestions });
}