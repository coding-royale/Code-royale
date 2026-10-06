import { describe, expect, test } from "bun:test";
import {
  LOBBY_ABANDON_MS,
  MATCH_STATUS_ACTIVE,
  MATCH_STATUS_COMPLETED,
  MATCH_STATUS_PENDING,
  isMatchJoinable,
  pickJoinableMatch,
} from "../match-room";

/*
 * Regression cover for the "teleported into a 25-day-old match" bug.
 *
 * The join route refuses to seat somebody who already holds a match, and hands
 * that match back instead. That guard only asked "is this decided?" — never
 * "is this still happening?". A duel from 25 days ago with a 5-minute limit
 * has no winner and status "active", so it answered yes.
 *
 * Result: pressing "Find a Match" dumped the player straight into that corpse
 * rather than queueing them. They saw an opponent they had not played in a
 * month, the clock read 00:00 because it expired a month ago, the timeout
 * fired on its own, and the match was recorded as a draw. Nobody forfeited.
 *
 * So joinability is now bounded by the clock, not just by the winner field.
 */

const NOW = Date.parse("2026-10-06T12:00:00.000Z");

/** A started_at `days` ago, on a `limitSeconds` clock. */
function startedDaysAgo(days: number, limitSeconds = 300) {
  const startedMs = NOW - days * 24 * 60 * 60 * 1000;
  return {
    startedAt: new Date(startedMs).toISOString(),
    startedMs,
    limitSeconds,
  };
}

describe("isMatchJoinable — expired clocks", () => {
  test("a running match is joinable", () => {
    const { startedAt, startedMs } = startedDaysAgo(0.001); // ~86s in
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_ACTIVE,
        startedAt,
        timeLimitSeconds: 300,
        nowMs: NOW,
      }),
    ).toBe(true);
    expect(startedMs).toBeLessThan(NOW);
  });

  test("a match whose clock expired is NOT joinable", () => {
    const { startedAt } = startedDaysAgo(25, 300);
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_ACTIVE,
        startedAt,
        timeLimitSeconds: 300,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  test("expiry is judged from the clock, not from wall-clock days", () => {
    // 10 minutes on a 5-minute limit: expired, but only just.
    const startedAt = new Date(NOW - 10 * 60 * 1000).toISOString();
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_ACTIVE,
        startedAt,
        timeLimitSeconds: 300,
        nowMs: NOW,
      }),
    ).toBe(false);
    // 4 minutes on a 5-minute limit: still running.
    const fresh = new Date(NOW - 4 * 60 * 1000).toISOString();
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_ACTIVE,
        startedAt: fresh,
        timeLimitSeconds: 300,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  test("an ancient lobby that never started is NOT joinable", () => {
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_PENDING,
        startedAt: null,
        createdAt: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  test("a lobby inside the abandon window is still joinable", () => {
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_PENDING,
        startedAt: null,
        createdAt: new Date(NOW - LOBBY_ABANDON_MS / 2).toISOString(),
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  test("decided matches stay refused regardless of the clock", () => {
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_ACTIVE,
        winnerId: "someone",
        startedAt: new Date(NOW - 60_000).toISOString(),
        timeLimitSeconds: 300,
        nowMs: NOW,
      }),
    ).toBe(false);
    expect(isMatchJoinable({ status: MATCH_STATUS_COMPLETED })).toBe(false);
  });
});

describe("pickJoinableMatch — never hands back a corpse", () => {
  test("skips a 25-day-old undecided match and picks the live one", () => {
    const { startedAt: corpse } = startedDaysAgo(25, 300);
    const rows = [
      {
        match_id: "ancient-corpse",
        status: MATCH_STATUS_ACTIVE,
        winner_id: null,
        started_at: corpse,
        time_limit_seconds: 300,
      },
      {
        match_id: "live-lobby",
        status: MATCH_STATUS_PENDING,
        winner_id: null,
        started_at: null,
        created_at: new Date(NOW - 5_000).toISOString(),
        time_limit_seconds: 300,
      },
    ];
    expect(pickJoinableMatch(rows, NOW)).toBe("live-lobby");
  });

  test("returns null when the only match is a corpse", () => {
    const { startedAt } = startedDaysAgo(25, 300);
    expect(
      pickJoinableMatch(
        [
          {
            match_id: "ancient-corpse",
            status: MATCH_STATUS_ACTIVE,
            winner_id: null,
            started_at: startedAt,
            time_limit_seconds: 300,
          },
        ],
        NOW,
      ),
    ).toBeNull();
  });

  test("a fresh match is still returned", () => {
    const { startedAt } = startedDaysAgo(0.0001);
    expect(
      pickJoinableMatch(
        [
          {
            match_id: "just-started",
            status: MATCH_STATUS_ACTIVE,
            winner_id: null,
            started_at: startedAt,
            time_limit_seconds: 300,
          },
        ],
        NOW,
      ),
    ).toBe("just-started");
  });
});