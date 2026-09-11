export type BotBattleResult = "playing" | "won" | "lost" | "bot_won" | "draw";

/** Code stays redacted while live; revealed once the match is over. */
export function shouldRevealBotCode(result: BotBattleResult): boolean {
  return result !== "playing";
}

export type BotRevealSummary = {
  lines: number;
  percent: number;
};

/** How much the bot wrote before the battle ended. */
export function getBotRevealSummary(code: string, overallProgress: number): BotRevealSummary {
  const lines = code ? code.split("\n").length : 0;
  const percent = Math.max(0, Math.min(100, Math.round(overallProgress * 100)));
  return { lines, percent };
}
