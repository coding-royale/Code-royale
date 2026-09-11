import { describe, expect, test } from "bun:test";
import {
  buildStatusUrl,
  isFreshMatch,
  resolveStatusCutoff,
  shouldAutoEnterMatch,
} from "../matchmaking";

describe("resolveStatusCutoff", () => {
  test("prefers explicit since param over default window", () => {
    const now = new Date("2026-09-11T12:00:00.000Z").getTime();
    const since = "2026-09-11T11:59:30.000Z";
    expect(resolveStatusCutoff(since, now)).toBe(since);
  });

  test("falls back to 3-minute window when since is missing", () => {
    const now = new Date("2026-09-11T12:00:00.000Z").getTime();
    expect(resolveStatusCutoff(null, now)).toBe("2026-09-11T11:57:00.000Z");
  });

  test("ignores invalid since values", () => {
    const now = new Date("2026-09-11T12:00:00.000Z").getTime();
    expect(resolveStatusCutoff("not-a-date", now)).toBe("2026-09-11T11:57:00.000Z");
  });
});

describe("isFreshMatch", () => {
  test("rejects matches joined before the queue started (stale lie)", () => {
    expect(isFreshMatch("2026-09-11T11:50:00.000Z", "2026-09-11T11:59:00.000Z")).toBe(false);
  });

  test("accepts matches joined after the queue started", () => {
    expect(isFreshMatch("2026-09-11T11:59:30.000Z", "2026-09-11T11:59:00.000Z")).toBe(true);
  });

  test("rejects null joined_at", () => {
    expect(isFreshMatch(null, "2026-09-11T11:59:00.000Z")).toBe(false);
  });
});

describe("buildStatusUrl", () => {
  test("appends since so status never returns pre-queue matches", () => {
    expect(buildStatusUrl("/api/matchmaking/status", "2026-09-11T11:59:00.000Z")).toBe(
      "/api/matchmaking/status?since=2026-09-11T11%3A59%3A00.000Z",
    );
  });

  test("returns base url when since is missing", () => {
    expect(buildStatusUrl("/api/matchmaking/status", null)).toBe("/api/matchmaking/status");
  });
});

describe("shouldAutoEnterMatch", () => {
  test("auto-enters when a fresh match id exists", () => {
    expect(shouldAutoEnterMatch("match_found", "abc-123")).toBe(true);
  });

  test("does not auto-enter while searching or without an id", () => {
    expect(shouldAutoEnterMatch("searching", "abc-123")).toBe(false);
    expect(shouldAutoEnterMatch("match_found", null)).toBe(false);
    expect(shouldAutoEnterMatch("idle", null)).toBe(false);
  });
});
