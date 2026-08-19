import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { serverCached } from "@/lib/server-cache";

type ProgressSummary = {
  solvedProblems: number;
  totalProblems: number;
  streakDays: number;
};

function toIsoDay(input: string): string {
  return input.slice(0, 10);
}

function computeConsecutiveDayStreak(daysDesc: string[]): number {
  if (daysDesc.length === 0) return 0;

  const daySet = new Set(daysDesc);
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const isoDay = cursor.toISOString().slice(0, 10);
    if (!daySet.has(isoDay)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export async function GET() {
  let supabase;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Supabase server client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 });
  }

  if (!user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Keep the DB queries off Postgres for 60s per user — progress changes
  // slowly and the dashboard polls on an interval.
  const payload = await serverCached(`progress:${user.id}`, 60_000, async () => {
    const [{ count: totalProblemsCount, error: totalProblemsError }, { data: solvedRows, error: solvedError }] = await Promise.all([
      supabase.from("practice_questions").select("id", { count: "exact", head: true }),
      supabase
        .from("practice_submissions")
        .select("question_id,created_at")
        .eq("user_id", user.id)
        .eq("passed", true)
        .order("created_at", { ascending: false }),
    ]);

    if (totalProblemsError) {
      console.error("Failed to count practice questions", totalProblemsError);
      throw new Error("Failed to load progress");
    }

    // If progress table is not yet created, keep API functional with zero progress.
    if (solvedError) {
      return {
        solvedProblems: 0,
        totalProblems: totalProblemsCount ?? 0,
        streakDays: 0,
      } satisfies ProgressSummary;
    }

    const rows = solvedRows ?? [];
    const solvedProblems = new Set(rows.map((row) => row.question_id)).size;
    const uniqueSolvedDaysDesc = Array.from(new Set(rows.map((row) => toIsoDay(row.created_at))));
    const streakDays = computeConsecutiveDayStreak(uniqueSolvedDaysDesc);

    return {
      solvedProblems,
      totalProblems: totalProblemsCount ?? 0,
      streakDays,
    } satisfies ProgressSummary;
  });

  return NextResponse.json(payload, { headers: { "cache-control": "private, max-age=60" } });
}
