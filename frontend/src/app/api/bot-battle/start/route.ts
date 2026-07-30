import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type StartRequest = {
  difficulty?: "easy" | "medium" | "hard";
};

export async function POST(request: Request) {
  let payload: StartRequest;
  try {
    payload = (await request.json()) as StartRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const difficulty =
    payload.difficulty === "easy" || payload.difficulty === "medium" || payload.difficulty === "hard"
      ? payload.difficulty
      : "easy";

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: questions, error: questionsError } = await supabase
    .from("practice_questions")
    .select("*")
    .eq("difficulty", difficulty);

  if (questionsError || !questions || questions.length === 0) {
    const { data: fallback } = await supabase
      .from("practice_questions")
      .select("*");
    if (!fallback || fallback.length === 0) {
      return NextResponse.json({ error: "No questions available" }, { status: 500 });
    }
    const chosen = fallback[Math.floor(Math.random() * fallback.length)];
    return NextResponse.json({ question: chosen, difficulty });
  }

  const chosen = questions[Math.floor(Math.random() * questions.length)];

  return NextResponse.json({ question: chosen, difficulty });
}
