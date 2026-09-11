export const STATUS_FALLBACK_WINDOW_MS = 3 * 60 * 1000;

/** Vercel Hobby kills functions at ~10s — join must return fast. */
export const JOIN_SEARCH_TIMEOUT_MS = 8000;

export function resolveStatusCutoff(since: string | null | undefined, now: number = Date.now()): string {
  if (typeof since === "string" && since.trim()) {
    const parsed = Date.parse(since);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(now - STATUS_FALLBACK_WINDOW_MS).toISOString();
}

export function isFreshMatch(
  joinedAt: string | null | undefined,
  cutoffIso: string,
): boolean {
  if (!joinedAt) return false;
  const joined = Date.parse(joinedAt);
  const cutoff = Date.parse(cutoffIso);
  if (!Number.isFinite(joined) || !Number.isFinite(cutoff)) return false;
  return joined >= cutoff;
}

export function buildStatusUrl(base: string, since: string | null | undefined): string {
  if (!since) return base;
  return `${base}?since=${encodeURIComponent(since)}`;
}

export function shouldAutoEnterMatch(state: string, matchId: string | null): boolean {
  return state === "match_found" && !!matchId;
}

/** Direct-spawn target. Null means stay put (still searching / no match). */
export function buildMatchUrl(matchId: string | null | undefined): string | null {
  if (!matchId || !matchId.trim()) return null;
  return `/match/${matchId}`;
}

type MatchParams = { matchId?: string } | null | undefined;

export async function resolveMatchIdFromParams(
  params: MatchParams | Promise<MatchParams>,
): Promise<string | null> {
  const resolved = await params;
  const raw = resolved?.matchId;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw;
}
