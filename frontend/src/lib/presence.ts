export type PresenceDot = "online" | "in-match" | null;

/** Live matches older than this are considered abandoned, not live. */
export const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Blue dot = online, green dot = in a match (wins when both).
 * Visible to anyone viewing the profile.
 */
export function resolvePresenceDot(online: boolean, inMatch: boolean): PresenceDot {
  if (inMatch) return "in-match";
  if (online) return "online";
  return null;
}

type LiveMatchRow = {
  status: string | null;
  metadata: unknown;
  started_at: string | null;
};

/** A match counts as live when it is active, undecided, and freshly started. */
export function isLiveMatchRow(row: LiveMatchRow, nowMs: number = Date.now()): boolean {
  if (row.status !== "active") return false;
  const meta =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
  if (typeof meta.winner_id === "string" && meta.winner_id) return false;
  const startedRaw =
    (typeof row.started_at === "string" && row.started_at) ||
    (typeof meta.started_at === "string" && meta.started_at) ||
    null;
  if (!startedRaw) return false;
  const started = Date.parse(startedRaw);
  if (!Number.isFinite(started)) return false;
  return nowMs - started <= LIVE_WINDOW_MS;
}
