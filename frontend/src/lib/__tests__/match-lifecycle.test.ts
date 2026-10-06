import { describe, expect, test } from "bun:test";
import {
  MATCH_STATUS_ACTIVE,
  MATCH_STATUS_CANCELLED,
  MATCH_STATUS_COMPLETED,
  MATCH_STATUS_PENDING,
  isMatchDecided,
  isMatchJoinable,
  pickJoinableMatch,
  shouldRedirectOffDecidedMatch,
} from "../match-room";

/*
 * Regression cover for the "ghost victory" bug:
 *
 * Matchmaking seated BOTH players in a fresh match, but the opponent's browser
 * was still parked on a match that had already been decided five days earlier.
 * That stale page kept polling, so `present_at` was fresh on the OLD match and
 * the new room never filled. The waiting player got "opponent never showed up"
 * while the other player stared at a victory card from a duel that had nothing
 * to do with this one.
 *
 * Two rules kill it:
 *   1. A decided / finished match is never joinable.
 *   2. When a player holds several match_players rows, the newest JOINABLE one
 *      wins, so status polling hands back the live room and not a corpse.
 */

const OLD_DECIDED = "5769d64e-53e9-4341-8f81-a0df7548959f";
const NEW_LOBBY = "e3bd62f6-5112-4932-9cd9-ecf1bf53eb32";

describe("isMatchJoinable", () => {
  test("a lobby that has not started is joinable", () => {
    expect(isMatchJoinable({ status: MATCH_STATUS_PENDING, winnerId: null })).toBe(true);
  });

  test("a running match is joinable", () => {
    // Joinability is judged against the match's own clock, so a live duel must
    // supply its start instant. See match-reentry.test.ts for the expired case.
    const nowMs = Date.parse("2026-09-30T12:00:00.000Z");
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_ACTIVE,
        winnerId: null,
        startedAt: "2026-09-30T11:59:30.000Z",
        timeLimitSeconds: 300,
        nowMs,
      }),
    ).toBe(true);
  });

  test("an active match with no start instant is not joinable", () => {
    expect(isMatchJoinable({ status: MATCH_STATUS_ACTIVE, winnerId: null })).toBe(false);
  });

  test("a lobby filling right now is joinable", () => {
    const nowMs = Date.parse("2026-09-30T12:00:00.000Z");
    expect(
      isMatchJoinable({
        status: MATCH_STATUS_PENDING,
        createdAt: "2026-09-30T11:59:55.000Z",
        nowMs,
      }),
    ).toBe(true);
  });

  test("a decided match is not joinable even while still marked active", () => {
    expect(
      isMatchJoinable({ status: MATCH_STATUS_ACTIVE, winnerId: "someone" }),
    ).toBe(false);
  });

  test("completed and cancelled matches are not joinable", () => {
    expect(isMatchJoinable({ status: MATCH_STATUS_COMPLETED, winnerId: null })).toBe(false);
    expect(isMatchJoinable({ status: MATCH_STATUS_CANCELLED, winnerId: null })).toBe(false);
  });

  test("an unknown status is not joinable", () => {
    expect(isMatchJoinable({ status: "bananas", winnerId: null })).toBe(false);
    expect(isMatchJoinable({ status: null, winnerId: null })).toBe(false);
  });
});

describe("pickJoinableMatch", () => {
  const rows = [
    { match_id: OLD_DECIDED, status: MATCH_STATUS_ACTIVE, winner_id: "the-other-guy" },
    { match_id: NEW_LOBBY, status: MATCH_STATUS_PENDING, winner_id: null },
  ];

  test("skips a decided match and returns the live lobby", () => {
    expect(pickJoinableMatch(rows)).toBe(NEW_LOBBY);
  });

  test("ignores the ordering it is handed", () => {
    expect(pickJoinableMatch([...rows].reverse())).toBe(NEW_LOBBY);
  });

  test("returns null when every match is already decided", () => {
    expect(pickJoinableMatch([rows[0]])).toBeNull();
  });

  test("returns null when the player has no matches", () => {
    expect(pickJoinableMatch([])).toBeNull();
  });

  test("tolerates null and malformed rows", () => {
    expect(
      pickJoinableMatch([
        { match_id: null, status: null, winner_id: null },
        { match_id: NEW_LOBBY, status: MATCH_STATUS_PENDING, winner_id: null },
      ]),
    ).toBe(NEW_LOBBY);
  });
});

describe("isMatchDecided", () => {
  test("a recorded winner settles it even while status says active", () => {
    expect(
      isMatchDecided({ status: MATCH_STATUS_ACTIVE, winnerId: "someone" }),
    ).toBe(true);
  });

  test("a completion timestamp settles it", () => {
    expect(
      isMatchDecided({ status: MATCH_STATUS_ACTIVE, completedAt: "2026-09-25T04:27:38.185Z" }),
    ).toBe(true);
  });

  test("completed and cancelled statuses settle it", () => {
    expect(isMatchDecided({ status: MATCH_STATUS_COMPLETED })).toBe(true);
    expect(isMatchDecided({ status: MATCH_STATUS_CANCELLED })).toBe(true);
  });

  test("an open room is not decided", () => {
    expect(isMatchDecided({ status: MATCH_STATUS_PENDING })).toBe(false);
    expect(isMatchDecided({ status: MATCH_STATUS_ACTIVE })).toBe(false);
    expect(isMatchDecided({ status: null, winnerId: null, completedAt: null })).toBe(false);
  });
});

describe("shouldRedirectOffDecidedMatch", () => {
  test("bounces a player off a match that is already over", () => {
    expect(shouldRedirectOffDecidedMatch({ status: MATCH_STATUS_ACTIVE, winnerId: "old-winner" })).toBe(true);
  });

  test("keeps a player on the match they are meant to be playing", () => {
    expect(shouldRedirectOffDecidedMatch({ status: MATCH_STATUS_PENDING })).toBe(false);
    expect(shouldRedirectOffDecidedMatch({ status: MATCH_STATUS_ACTIVE })).toBe(false);
  });

  test("a decided match is never joinable, whatever status claims", () => {
    expect(isMatchJoinable({ status: MATCH_STATUS_ACTIVE, completedAt: "2026-09-25T04:27:38.185Z" })).toBe(false);
  });
});
