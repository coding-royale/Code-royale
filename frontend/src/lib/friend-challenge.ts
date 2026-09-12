export type ChallengeMode = "ranked" | "unranked";
export type ChallengeDifficulty = "easy" | "medium" | "hard";

/** Challenges auto-expire so stale cards never linger. */
export const CHALLENGE_TTL_MS = 15 * 60 * 1000;

export function parseChallengeMode(value: unknown): ChallengeMode {
  return value === "unranked" ? "unranked" : "ranked";
}

/** Question lane from the pair's average rating (same bands as ranked). */
export function resolveChallengeDifficulty(
  ratingA: number,
  ratingB: number,
): ChallengeDifficulty {
  const avg = (ratingA + ratingB) / 2;
  if (avg < 300) return "easy";
  if (avg < 700) return "medium";
  return "hard";
}

export function isChallengeExpired(
  createdAt: string | null | undefined,
  nowMs: number = Date.now(),
  ttlMs: number = CHALLENGE_TTL_MS,
): boolean {
  if (!createdAt) return true;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return true;
  return nowMs - created > ttlMs;
}

/** Accepted + started: both players should be in the arena. */
export function isChallengeLive(
  status: string | null | undefined,
  startedAt: string | null | undefined,
): boolean {
  return status === "active" && !!startedAt;
}
