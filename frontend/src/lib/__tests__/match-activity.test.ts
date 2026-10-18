import { describe, expect, test } from "bun:test";
import {
  computeProgress,
  describeOpponentProgress,
  formatLastActive,
  formatRatingDelta,
  latestAttemptLabel,
  recentAttemptFeed,
  summarizeAttempts,
} from "../match-activity";

describe("summarizeAttempts", () => {
  test("empty history gives zeros and null", () => {
    expect(summarizeAttempts([])).toEqual({
      attempts: 0,
      bestPassed: 0,
      bestTotal: 0,
      lastActiveAt: null,
    });
  });

  test("counts attempts, keeps the best pass count and latest time", () => {
    const summary = summarizeAttempts([
      { passed: 2, total: 8, created_at: "2026-09-12T12:00:00.000Z" },
      { passed: 5, total: 8, created_at: "2026-09-12T12:01:00.000Z" },
      { passed: 3, total: 8, created_at: "2026-09-12T11:59:00.000Z" },
    ]);
    expect(summary.attempts).toBe(3);
    expect(summary.bestPassed).toBe(5);
    expect(summary.bestTotal).toBe(8);
    expect(summary.lastActiveAt).toBe("2026-09-12T12:01:00.000Z");
  });
});

describe("computeProgress", () => {
  test("no runs yet is nothing, not a full bar", () => {
    const p = computeProgress({ attempts: 0, bestPassed: 0, bestTotal: 0, lastActiveAt: null });
    expect(p.fraction).toBe(0);
    expect(p.label).toBe("no runs yet");
    expect(p.solved).toBe(false);
  });

  test("a partial run reads as a fraction with a real denominator", () => {
    const p = computeProgress({ attempts: 2, bestPassed: 5, bestTotal: 8, lastActiveAt: null });
    expect(p.fraction).toBeCloseTo(5 / 8);
    expect(p.label).toBe("5/8 tests passing");
    expect(p.solved).toBe(false);
  });

  test("a clean sweep is full and marked solved", () => {
    const p = computeProgress({ attempts: 3, bestPassed: 8, bestTotal: 8, lastActiveAt: null });
    expect(p.fraction).toBe(1);
    expect(p.solved).toBe(true);
    expect(p.label).toBe("all 8 tests passing");
  });

  test("never exceeds 1 even if a row over-reports", () => {
    const p = computeProgress({ attempts: 1, bestPassed: 9, bestTotal: 8, lastActiveAt: null });
    expect(p.fraction).toBeLessThanOrEqual(1);
  });

  test("a missing denominator degrades to zero rather than NaN", () => {
    const p = computeProgress({ attempts: 1, bestPassed: 3, bestTotal: 0, lastActiveAt: null });
    expect(Number.isFinite(p.fraction)).toBe(true);
    expect(p.fraction).toBe(0);
  });
});

describe("latestAttemptLabel", () => {
  test("describes the newest run, which is what 'how are they doing' means", () => {
    expect(latestAttemptLabel(4, 8)).toBe("4/8");
    expect(latestAttemptLabel(8, 8)).toBe("8/8");
  });

  test("no run yet", () => {
    expect(latestAttemptLabel(0, 0)).toBe("--");
  });
});

describe("recentAttemptFeed", () => {
  const rows = [
    { passed: 1, total: 8, created_at: "2026-09-12T12:00:00.000Z" },
    { passed: 3, total: 8, created_at: "2026-09-12T12:01:00.000Z" },
    { passed: 5, total: 8, created_at: "2026-09-12T12:02:00.000Z" },
    { passed: 8, total: 8, created_at: "2026-09-12T12:03:00.000Z" },
  ];

  test("returns the newest N, newest first", () => {
    expect(recentAttemptFeed(rows, 2)).toEqual([
      { passed: 8, total: 8, passedAll: true },
      { passed: 5, total: 8, passedAll: false },
    ]);
  });

  test("flags a clean sweep so the UI can highlight it", () => {
    expect(recentAttemptFeed(rows, 1)[0].passedAll).toBe(true);
  });

  test("an empty history gives an empty feed", () => {
    expect(recentAttemptFeed([], 5)).toEqual([]);
  });

  test("a limit of zero asks for nothing", () => {
    expect(recentAttemptFeed(rows, 0)).toEqual([]);
  });

  test("does not depend on the caller's ordering", () => {
    const oldestFirst = recentAttemptFeed([...rows].reverse(), 2);
    const newestFirst = recentAttemptFeed(rows, 2);
    expect(oldestFirst).toEqual(newestFirst);
    expect(newestFirst[0].passed).toBe(8);
  });
});

describe("describeOpponentProgress", () => {
  test("reads as a real status line a player can act on", () => {
    expect(
      describeOpponentProgress({ attempts: 4, bestPassed: 6, bestTotal: 8, lastActiveAt: null }),
    ).toBe("4 runs · best 6/8");
  });

  test("says so when they have not run anything", () => {
    expect(
      describeOpponentProgress({ attempts: 0, bestPassed: 0, bestTotal: 0, lastActiveAt: null }),
    ).toBe("has not run anything yet");
  });
});

describe("formatLastActive", () => {
  const now = Date.parse("2026-09-12T12:00:00.000Z");

  test("null means never", () => {
    expect(formatLastActive(null, now)).toBe("no attempts yet");
  });

  test("seconds and minutes", () => {
    expect(formatLastActive("2026-09-12T11:59:55.000Z", now)).toBe("5s ago");
    expect(formatLastActive("2026-09-12T11:58:00.000Z", now)).toBe("2m ago");
  });

  test("just now for sub-second", () => {
    expect(formatLastActive("2026-09-12T12:00:00.000Z", now)).toBe("just now");
  });
});

describe("formatRatingDelta", () => {
  test("signs deltas for the outcome box", () => {
    expect(formatRatingDelta(12)).toBe("+12");
    expect(formatRatingDelta(-8)).toBe("-8");
    expect(formatRatingDelta(0)).toBe("±0");
  });
});
