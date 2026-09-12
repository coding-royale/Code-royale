import { describe, expect, test } from "bun:test";
import {
  formatLastActive,
  formatRatingDelta,
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
