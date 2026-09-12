import { describe, expect, test } from "bun:test";
import {
  LIVE_WINDOW_MS,
  isLiveMatchRow,
  resolvePresenceDot,
} from "../presence";

describe("resolvePresenceDot", () => {
  test("green in-match dot wins over online", () => {
    expect(resolvePresenceDot(true, true)).toBe("in-match");
  });

  test("blue online dot when online but not in a match", () => {
    expect(resolvePresenceDot(true, false)).toBe("online");
  });

  test("no dot when offline", () => {
    expect(resolvePresenceDot(false, false)).toBeNull();
    expect(resolvePresenceDot(false, true)).toBe("in-match");
  });
});

describe("isLiveMatchRow", () => {
  const now = Date.parse("2026-09-12T12:00:00.000Z");

  test("active match without a winner counts as live", () => {
    expect(
      isLiveMatchRow(
        { status: "active", metadata: { started_at: "2026-09-12T11:50:00.000Z" }, started_at: null },
        now,
      ),
    ).toBe(true);
  });

  test("finished matches (winner set) are not live", () => {
    expect(
      isLiveMatchRow(
        {
          status: "active",
          metadata: { winner_id: "someone", started_at: "2026-09-12T11:50:00.000Z" },
          started_at: null,
        },
        now,
      ),
    ).toBe(false);
  });

  test("pending and cancelled matches are not live", () => {
    expect(isLiveMatchRow({ status: "pending", metadata: {}, started_at: null }, now)).toBe(false);
    expect(isLiveMatchRow({ status: "cancelled", metadata: {}, started_at: null }, now)).toBe(false);
  });

  test("stale active matches past the live window are not live", () => {
    expect(
      isLiveMatchRow(
        { status: "active", metadata: { started_at: "2026-09-12T08:00:00.000Z" }, started_at: null },
        now,
      ),
    ).toBe(false);
  });

  test("live window is 2 hours", () => {
    expect(LIVE_WINDOW_MS).toBe(2 * 60 * 60 * 1000);
  });
});
