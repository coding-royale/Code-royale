import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { BotBattleArenaClient } from "./bot-arena-client";

type PageProps = {
  searchParams: { difficulty?: string };
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default async function BotBattlePage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user?.id) {
    redirect("/auth/login");
  }

  const difficulty =
    searchParams.difficulty === "medium" || searchParams.difficulty === "hard"
      ? searchParams.difficulty
      : "easy";

  const { data: questions } = await supabase
    .from("practice_questions")
    .select("*")
    .eq("difficulty", difficulty);

  let question;
  if (questions && questions.length > 0) {
    question = pickRandom(questions);
  } else {
    const { data: fallback } = await supabase
      .from("practice_questions")
      .select("*");
    question = fallback?.[0] ?? null;
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <p>No questions available. Please seed the database first.</p>
      </div>
    );
  }

  const rawTestcases = Array.isArray(question.testcases)
    ? (question.testcases as Array<{ input?: string; output?: string }>)
    : [];

  const testcases = rawTestcases.map((tc: { input?: string; output?: string }, i: number) => ({
    id: `${question.id}-case-${i + 1}`,
    input: tc.input ?? "",
    output: tc.output ?? "",
  }));

  const languages = Array.isArray(question.languages)
    ? (question.languages as string[]).filter((l): l is string => typeof l === "string" && !!l)
    : ["javascript", "python", "cpp"];

  const meta = question.meta && typeof question.meta === "object" ? question.meta : null;

  return (
    <BotBattleArenaClient
      question={{
        id: question.id,
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        languages: languages.length > 0 ? languages : ["javascript", "python", "cpp"],
        meta: meta as {
          timeComplexity?: string | null;
          spaceComplexity?: string | null;
          topics?: string[] | null;
        } | null,
      }}
      testcases={testcases}
      botDifficulty={difficulty as "easy" | "medium" | "hard"}
      userId={authData.user.id}
    />
  );
}
