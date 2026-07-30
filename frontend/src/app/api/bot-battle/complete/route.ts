import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type CompletePayload = {
  difficulty?: "easy" | "medium" | "hard";
  won?: boolean;
  timeTakenSeconds?: number;
};

const POINTS_CONFIG = {
  easy: { base: 50, bonus: 30, multiplier: 1 },
  medium: { base: 100, bonus: 50, multiplier: 2 },
  hard: { base: 150, bonus: 100, multiplier: 3 },
};

export async function POST(request: Request) {
  let payload: CompletePayload;
  try {
    payload = (await request.json()) as CompletePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const difficulty =
    payload.difficulty === "easy" || payload.difficulty === "medium" || payload.difficulty === "hard"
      ? payload.difficulty
      : "easy";

  const won = payload.won === true;
  const timeTakenSeconds = Math.max(0, Math.floor(payload.timeTakenSeconds ?? 0));

  const supabaseAuth = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authData.user.id;

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const config = POINTS_CONFIG[difficulty];
  let totalPoints = config.base * config.multiplier;

  if (won) {
    totalPoints += config.bonus * config.multiplier;
  }

  const { data: existingStats } = await supabase
    .from("player_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const botMatchesPlayed = ((existingStats as Record<string, unknown>)?.bot_matches_played as number) ?? 0;
  const botWins = ((existingStats as Record<string, unknown>)?.bot_wins as number) ?? 0;
  const botTrophies = ((existingStats as Record<string, unknown>)?.bot_trophies as number) ?? 0;

  const updates: Record<string, unknown> = {
    bot_matches_played: botMatchesPlayed + 1,
    bot_trophies: botTrophies + totalPoints,
  };

  if (won) {
    updates.bot_wins = botWins + 1;
  }

  if (existingStats) {
    await supabase.from("player_stats").update(updates).eq("user_id", userId);
  } else {
    const { data: userRow } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single();

    await supabase.from("player_stats").insert({
      user_id: userId,
      username: (userRow as Record<string, unknown>)?.username ?? "Unknown",
      bot_matches_played: 1,
      bot_wins: won ? 1 : 0,
      bot_trophies: totalPoints,
      trophies_1v1: 0,
      trophies_2v2: 0,
      wins_1v1: 0,
      losses_1v1: 0,
      wins_2v2: 0,
      losses_2v2: 0,
      matches_played: 0,
      league: "bronze",
    });
  }

  await supabase.from("users").update({
    rating: totalPoints,
  }).eq("id", userId);

  return NextResponse.json({
    pointsAwarded: totalPoints,
    won,
    difficulty,
    timeTakenSeconds,
    breakdown: {
      base: config.base,
      multiplier: config.multiplier,
      bonus: won ? config.bonus * config.multiplier : 0,
    },
  });
}
