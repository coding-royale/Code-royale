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

export type AttemptProgress = {
  /** 0..1, for a progress bar. 0 when there is nothing to show yet. */
  fraction: number;
  /** Human label, e.g. "5/8 tests passing". */
  label: string;
  /** True once a run passed every test case. */
  solved: boolean;
};

/**
 * "How far along is this player", derived from their own runs.
 *
 * This is what the arena should be showing an opponent instead of the
 * decorative snippet animation the masked editor plays, which is generated
 * client-side and has no connection to what anyone is actually doing.
 *
 * A zero denominator degrades to 0 rather than NaN, because a run row with a
 * missing total would otherwise poison a whole progress bar.
 */
export function computeProgress(summary: AttemptSummary): AttemptProgress {
  const { attempts, bestPassed, bestTotal } = summary;
  if (attempts === 0 || bestTotal <= 0) {
    return { fraction: 0, label: "no runs yet", solved: false };
  }
  const solved = bestPassed >= bestTotal;
  const fraction = solved ? 1 : Math.min(Math.max(bestPassed / bestTotal, 0), 1);
  return {
    fraction,
    label: solved ? `all ${bestTotal} tests passing` : `${bestPassed}/${bestTotal} tests passing`,
    solved,
  };
}

/** Compact "4/8" chip for the newest run. */
export function latestAttemptLabel(passed: number, total: number): string {
  if (!total || total <= 0) return "--";
  return `${passed}/${total}`;
}

export type RecentAttempt = {
  passed: number;
  total: number;
  passedAll: boolean;
};

/**
 * The last few runs, newest first, for a live progress feed.
 *
 * `summarizeAttempts` collapses history into a best score, which cannot show
 * movement; the feed is what makes the opponent's work legible in real time.
 *
 * Rows are sorted here rather than trusted to arrive in order: the caller has
 * to slice "the newest N", and silently returning the oldest N when a query
 * changes its ordering would show a stale bar with no visible cause.
 */
export function recentAttemptFeed(rows: AttemptRow[], limit: number): RecentAttempt[] {
  if (limit <= 0) return [];
  return [...rows]
    .sort((a, b) => {
      const at = Date.parse(a.created_at);
      const bt = Date.parse(b.created_at);
      const av = Number.isFinite(at) ? at : 0;
      const bv = Number.isFinite(bt) ? bt : 0;
      return bv - av;
    })
    .slice(0, limit)
    .map((row) => ({
      passed: row.passed,
      total: row.total,
      passedAll: row.total > 0 && row.passed >= row.total,
    }));
}

/** One-line status for the opponent panel. */
export function describeOpponentProgress(summary: AttemptSummary): string {
  if (summary.attempts === 0) return "has not run anything yet";
  return `${summary.attempts} ${summary.attempts === 1 ? "run" : "runs"} · best ${latestAttemptLabel(
    summary.bestPassed,
    summary.bestTotal,
  )}`;
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
