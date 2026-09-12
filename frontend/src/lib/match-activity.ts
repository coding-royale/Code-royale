export type AttemptRow = {
  passed: number;
  total: number;
  created_at: string;
};

export type AttemptSummary = {
  attempts: number;
  bestPassed: number;
  bestTotal: number;
  lastActiveAt: string | null;
};

/** Real opponent progress: attempts, best pass count, latest activity. */
export function summarizeAttempts(rows: AttemptRow[]): AttemptSummary {
  if (rows.length === 0) {
    return { attempts: 0, bestPassed: 0, bestTotal: 0, lastActiveAt: null };
  }
  let bestPassed = 0;
  let bestTotal = 0;
  let lastActiveAt: string | null = null;
  for (const row of rows) {
    if (row.passed > bestPassed) {
      bestPassed = row.passed;
      bestTotal = row.total;
    }
    if (!lastActiveAt || row.created_at > lastActiveAt) {
      lastActiveAt = row.created_at;
    }
  }
  return { attempts: rows.length, bestPassed, bestTotal, lastActiveAt };
}

export function formatLastActive(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return "no attempts yet";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "no attempts yet";
  const secs = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (secs < 1) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export function formatRatingDelta(delta: number): string {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}
