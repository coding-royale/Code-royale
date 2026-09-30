import { describe, expect, test } from "bun:test";
import {
  DEFAULT_TIME_LIMIT_SECONDS,
  LOBBY_ABANDON_MS,
  MATCH_COUNTDOWN_MS,
  OPPONENT_ACTIVE_WINDOW_MS,
  ROOM_PRESENCE_TTL_MS,
  computeClockOffsetMs,
  countPresentPlayers,
  countdownSecondsRemaining,
  describeOpponentActivity,
  formatClock,
  isMatchCommitted,
  pickSolvedPlayerIds,
  pickTimedOutWinnerId,
  remainingMatchSeconds,
  resolveLobbyReason,
  resolveMatchPhase,
  resolveOpponentState,
  sanitizeTimeLimit,
  shouldForfeitOnUnload,
} from "../match-room";

const NOW = Date.parse("2026-09-30T12:00:00.000Z");

describe("resolveMatchPhase", () => {
  test("no start instant means the room is still filling", () => {
    expect(resolveMatchPhase({ startedAt: null, nowMs: NOW })).toBe("lobby");
    expect(resolveMatchPhase({ startedAt: "", nowMs: NOW })).toBe("lobby");
    expect(resolveMatchPhase({ startedAt: "garbage", nowMs: NOW })).toBe("lobby");
  });

  test("a future start instant is the shared countdown", () => {
    expect(
      resolveMatchPhase({ startedAt: "2026-09-30T12:00:03.000Z", nowMs: NOW }),
    ).toBe("countdown");
  });

  test("a past start instant is live", () => {
    expect(
      resolveMatchPhase({ startedAt: "2026-09-30T11:59:57.000Z", nowMs: NOW }),
    ).toBe("live");
  });

  test("a decided match is over regardless of the clock", () => {
    expect(
      resolveMatchPhase({
        startedAt: "2026-09-30T11:59:00.000Z",
        winnerId: "user-1",
        nowMs: NOW,
      }),
    ).toBe("over");
    // Even mid-countdown: the result beats the clock.
    expect(
      resolveMatchPhase({
        startedAt: "2026-09-30T12:00:03.000Z",
        winnerId: "user-1",
        nowMs: NOW,
      }),
    ).toBe("over");
  });

  test("a null winner is not a decision", () => {
    expect(
      resolveMatchPhase({ startedAt: "2026-09-30T11:59:00.000Z", winnerId: null, nowMs: NOW }),
    ).toBe("live");
  });
});

describe("remainingMatchSeconds", () => {
  const startedAt = "2026-09-30T12:00:00.000Z";

  test("both players read the same number from the same start instant", () => {
    // Player A polls 20s after the start, player B 4s after: both derive
    // from started_at, so neither is penalised for their own page load.
    const a = remainingMatchSeconds({ startedAt, timeLimitSeconds: 480, nowMs: NOW + 20_000 });
    const b = remainingMatchSeconds({ startedAt, timeLimitSeconds: 480, nowMs: NOW + 4_000 });
    expect(a).toBe(460);
    expect(b).toBe(476);
    expect(b - a).toBe(16);
  });

  test("counts up to whole seconds and never goes negative", () => {
    expect(
      remainingMatchSeconds({ startedAt, timeLimitSeconds: 60, nowMs: NOW + 500 }),
    ).toBe(60);
    expect(
      remainingMatchSeconds({ startedAt, timeLimitSeconds: 60, nowMs: NOW + 60_500 }),
    ).toBe(0);
    expect(
      remainingMatchSeconds({ startedAt, timeLimitSeconds: 60, nowMs: NOW + 600_000 }),
    ).toBe(0);
  });

  test("a missing start instant means no time on the clock yet", () => {
    expect(remainingMatchSeconds({ startedAt: null, timeLimitSeconds: 60, nowMs: NOW })).toBe(0);
  });

  test("falls back to the default limit when the stored value is junk", () => {
    expect(
      remainingMatchSeconds({ startedAt, timeLimitSeconds: Number.NaN, nowMs: NOW }),
    ).toBe(DEFAULT_TIME_LIMIT_SECONDS);
    expect(
      remainingMatchSeconds({ startedAt, timeLimitSeconds: -5, nowMs: NOW }),
    ).toBe(DEFAULT_TIME_LIMIT_SECONDS);
  });
});

describe("countdownSecondsRemaining", () => {
  test("counts 3, 2, 1 then zero", () => {
    const start = "2026-09-30T12:00:03.000Z";
    expect(countdownSecondsRemaining(start, NOW)).toBe(3);
    expect(countdownSecondsRemaining(start, NOW + 1_000)).toBe(2);
    expect(countdownSecondsRemaining(start, NOW + 2_000)).toBe(1);
    expect(countdownSecondsRemaining(start, NOW + 3_000)).toBe(0);
    expect(countdownSecondsRemaining(start, NOW + 9_000)).toBe(0);
  });

  test("no start instant means nothing to count down", () => {
    expect(countdownSecondsRemaining(null, NOW)).toBe(0);
  });

  test("the shared lead-in is a few seconds, not a per-player guess", () => {
    expect(MATCH_COUNTDOWN_MS).toBeGreaterThan(0);
    expect(MATCH_COUNTDOWN_MS).toBeLessThanOrEqual(5_000);
  });
});

describe("computeClockOffsetMs", () => {
  test("a client with a slow clock gets a positive correction", () => {
    // Server stamped 1000, the round trip took 40ms so the stamp really
    // happened around 1020, and the client's own clock read 940 on receipt:
    // the client is 80ms behind and needs +80 to compare like for like.
    expect(computeClockOffsetMs(1_000, 900, 940)).toBe(80);
  });

  test("a client with a fast clock gets a negative correction", () => {
    expect(computeClockOffsetMs(1_000, 1_100, 1_140)).toBe(-120);
  });

  test("a zero-RTT request needs no correction", () => {
    expect(computeClockOffsetMs(1_000, 1_000, 1_000)).toBe(0);
  });

  test("the correction shrinks as latency drops", () => {
    // Same 200ms-server-stamp, but the client waited 200ms: the stamp lands
    // on the client clock at ~1100, so the client is 100ms fast.
    expect(computeClockOffsetMs(1_000, 1_000, 1_200)).toBe(-100);
    expect(computeClockOffsetMs(1_000, 1_000, 1_010)).toBe(-5);
  });
});

describe("pickSolvedPlayerIds", () => {
  test("only a full pass inside this match counts", () => {
    const solved = pickSolvedPlayerIds([
      { user_id: "a", passed: 8, total: 8 },
      { user_id: "b", passed: 3, total: 8 },
    ]);
    expect([...solved]).toEqual(["a"]);
  });

  test("a run with zero cases never counts as a solve", () => {
    expect(pickSolvedPlayerIds([{ user_id: "a", passed: 0, total: 0 }]).size).toBe(0);
  });

  test("an attempt's best result is enough, later failures do not revoke it", () => {
    const solved = pickSolvedPlayerIds([
      { user_id: "a", passed: 5, total: 8 },
      { user_id: "a", passed: 8, total: 8 },
      { user_id: "a", passed: 1, total: 8 },
    ]);
    expect([...solved]).toEqual(["a"]);
  });

  test("nobody solved means nobody wins on timeout", () => {
    expect(pickSolvedPlayerIds([]).size).toBe(0);
  });
});

describe("pickTimedOutWinnerId", () => {
  const start = "2026-09-30T12:00:00.000Z";

  test("a pass from before the duel is not a win", () => {
    expect(
      pickTimedOutWinnerId({
        playerIds: ["a", "b"],
        submissions: [{ user_id: "a", created_at: "2026-09-01T09:00:00.000Z" }],
        startedAt: start,
      }),
    ).toBeNull();
  });

  test("a pass after the shared start wins the race", () => {
    expect(
      pickTimedOutWinnerId({
        playerIds: ["a", "b"],
        submissions: [
          { user_id: "a", created_at: "2026-09-01T09:00:00.000Z" },
          { user_id: "a", created_at: "2026-09-30T12:01:20.000Z" },
        ],
        startedAt: start,
      }),
    ).toBe("a");
  });

  test("both solving on the bell is a draw, not a coin flip", () => {
    expect(
      pickTimedOutWinnerId({
        playerIds: ["a", "b"],
        submissions: [
          { user_id: "a", created_at: "2026-09-30T12:02:00.000Z" },
          { user_id: "b", created_at: "2026-09-30T12:03:00.000Z" },
        ],
        startedAt: start,
      }),
    ).toBeNull();
  });

  test("nobody submitting is a draw", () => {
    expect(
      pickTimedOutWinnerId({ playerIds: ["a", "b"], submissions: [], startedAt: start }),
    ).toBeNull();
  });

  test("a match that never started cannot time out into a win", () => {
    expect(
      pickTimedOutWinnerId({
        playerIds: ["a", "b"],
        submissions: [{ user_id: "a", created_at: "2026-09-30T12:00:30.000Z" }],
        startedAt: null,
      }),
    ).toBeNull();
  });

  test("a submission timestamp exactly on the start still counts", () => {
    expect(
      pickTimedOutWinnerId({
        playerIds: ["a", "b"],
        submissions: [{ user_id: "b", created_at: start }],
        startedAt: start,
      }),
    ).toBe("b");
  });

  test("somebody outside the duel cannot claim the win", () => {
    expect(
      pickTimedOutWinnerId({
        playerIds: ["a", "b"],
        submissions: [{ user_id: "c", created_at: "2026-09-30T12:00:10.000Z" }],
        startedAt: start,
      }),
    ).toBeNull();
  });
});

describe("isMatchCommitted", () => {
  test("only a claimed start commits the players", () => {
    expect(isMatchCommitted("lobby")).toBe(false);
    expect(isMatchCommitted("countdown")).toBe(true);
    expect(isMatchCommitted("live")).toBe(true);
  });

  test("a finished match needs no forfeit", () => {
    expect(isMatchCommitted("over")).toBe(false);
  });
});

describe("shouldForfeitOnUnload", () => {
  test("leaving a live match forfeits", () => {
    expect(shouldForfeitOnUnload({ phase: "live", decided: false, alreadySent: false })).toBe(true);
  });

  test("leaving during the countdown forfeits too: the start is already committed", () => {
    expect(shouldForfeitOnUnload({ phase: "countdown", decided: false, alreadySent: false })).toBe(true);
  });

  test("leaving the waiting room forfeits nothing", () => {
    expect(shouldForfeitOnUnload({ phase: "lobby", decided: false, alreadySent: false })).toBe(false);
  });

  test("a decided match is never re-forfeited", () => {
    expect(shouldForfeitOnUnload({ phase: "over", decided: true, alreadySent: false })).toBe(false);
    expect(shouldForfeitOnUnload({ phase: "live", decided: true, alreadySent: false })).toBe(false);
  });

  test("at most one forfeit is ever sent", () => {
    expect(shouldForfeitOnUnload({ phase: "live", decided: false, alreadySent: true })).toBe(false);
  });
});

describe("resolveOpponentState", () => {
  test("no runs yet means they are still reading", () => {
    expect(
      resolveOpponentState({ attempts: 0, bestPassed: 0, bestTotal: 0, lastActiveAt: null }, NOW),
    ).toBe("reading");
  });

  test("a run a moment ago means they are testing", () => {
    expect(
      resolveOpponentState(
        { attempts: 2, bestPassed: 1, bestTotal: 8, lastActiveAt: "2026-09-30T11:59:57.000Z" },
        NOW,
      ),
    ).toBe("testing");
  });

  test("a stale run means they went quiet", () => {
    expect(
      resolveOpponentState(
        {
          attempts: 2,
          bestPassed: 1,
          bestTotal: 8,
          lastActiveAt: new Date(NOW - OPPONENT_ACTIVE_WINDOW_MS - 1_000).toISOString(),
        },
        NOW,
      ),
    ).toBe("thinking");
  });

  test("a solve wins over everything else", () => {
    expect(
      resolveOpponentState(
        {
          attempts: 9,
          bestPassed: 8,
          bestTotal: 8,
          lastActiveAt: "2026-09-30T11:59:59.500Z",
          solved: true,
        },
        NOW,
      ),
    ).toBe("solved");
  });
});

describe("describeOpponentActivity", () => {
  test("says nothing misleading before the first run", () => {
    expect(
      describeOpponentActivity({ attempts: 0, bestPassed: 0, bestTotal: 0, lastActiveAt: null }, NOW),
    ).toBe("no runs yet");
  });

  test("tries, best score and recency in one line", () => {
    expect(
      describeOpponentActivity(
        { attempts: 1, bestPassed: 4, bestTotal: 8, lastActiveAt: "2026-09-30T11:59:50.000Z" },
        NOW,
      ),
    ).toBe("1 try · best 4/8 · 10s ago");
    expect(
      describeOpponentActivity(
        { attempts: 3, bestPassed: 4, bestTotal: 8, lastActiveAt: "2026-09-30T11:59:55.000Z" },
        NOW,
      ),
    ).toBe("3 tries · best 4/8 · 5s ago");
  });
});

describe("countPresentPlayers", () => {
  const map = (entries: Array<[string, string | null]>) => new Map(entries);

  test("one seat filled is not a duel", () => {
    const r = countPresentPlayers({
      presentAtByUser: map([
        ["a", new Date(NOW - 1_000).toISOString()],
        ["b", null],
      ]),
      playerIds: ["a", "b"],
      nowMs: NOW,
    });
    expect(r.present).toBe(1);
    expect(r.everyoneHere).toBe(false);
  });

  test("both seats occupied opens the room", () => {
    const r = countPresentPlayers({
      presentAtByUser: map([
        ["a", new Date(NOW - 1_000).toISOString()],
        ["b", new Date(NOW - 2_000).toISOString()],
      ]),
      playerIds: ["a", "b"],
      nowMs: NOW,
    });
    expect(r.present).toBe(2);
    expect(r.everyoneHere).toBe(true);
  });

  test("a seat that went stale stops counting, so the room can be given up on", () => {
    const r = countPresentPlayers({
      presentAtByUser: map([
        ["a", new Date(NOW - 1_000).toISOString()],
        ["b", new Date(NOW - ROOM_PRESENCE_TTL_MS - 1_000).toISOString()],
      ]),
      playerIds: ["a", "b"],
      nowMs: NOW,
    });
    expect(r.present).toBe(1);
    expect(r.everyoneHere).toBe(false);
  });

  test("a fresh stamp still counts right up to the freshness window", () => {
    const r = countPresentPlayers({
      presentAtByUser: map([
        ["a", new Date(NOW - ROOM_PRESENCE_TTL_MS + 1_000).toISOString()],
        ["b", new Date(NOW - 500).toISOString()],
      ]),
      playerIds: ["a", "b"],
      nowMs: NOW,
    });
    expect(r.everyoneHere).toBe(true);
  });

  test("a solo match never counts as everyone here", () => {
    const r = countPresentPlayers({
      presentAtByUser: map([["a", new Date(NOW).toISOString()]]),
      playerIds: ["a"],
      nowMs: NOW,
    });
    expect(r.present).toBe(1);
    expect(r.everyoneHere).toBe(false);
  });

  test("an unparseable stamp is treated as absent, never as a crash", () => {
    const r = countPresentPlayers({
      presentAtByUser: map([
        ["a", "not-a-date"],
        ["b", new Date(NOW).toISOString()],
      ]),
      playerIds: ["a", "b"],
      nowMs: NOW,
    });
    expect(r.present).toBe(1);
    expect(r.everyoneHere).toBe(false);
  });
});

describe("resolveLobbyReason", () => {
  test("a full room is simply waiting for the start", () => {
    expect(
      resolveLobbyReason({
        createdAt: new Date(NOW - LOBBY_ABANDON_MS - 1_000).toISOString(),
        playersPresent: 2,
        playersTotal: 2,
        nowMs: NOW,
      }),
    ).toBe("waiting");
  });

  test("an empty room eventually gives up", () => {
    expect(
      resolveLobbyReason({
        createdAt: new Date(NOW - LOBBY_ABANDON_MS).toISOString(),
        playersPresent: 1,
        playersTotal: 2,
        nowMs: NOW,
      }),
    ).toBe("abandoned");
  });

  test("a fresh room keeps waiting", () => {
    expect(
      resolveLobbyReason({
        createdAt: new Date(NOW - 1_000).toISOString(),
        playersPresent: 1,
        playersTotal: 2,
        nowMs: NOW,
      }),
    ).toBe("waiting");
  });
});

describe("formatClock", () => {
  test("always two digits, never negative", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(599)).toBe("09:59");
    expect(formatClock(3600)).toBe("60:00");
    expect(formatClock(-10)).toBe("00:00");
  });
});

describe("sanitizeTimeLimit", () => {
  test("clamps to a sane duel and rejects junk", () => {
    expect(sanitizeTimeLimit(300)).toBe(300);
    expect(sanitizeTimeLimit(5)).toBe(60);
    expect(sanitizeTimeLimit(99999)).toBe(3600);
    expect(sanitizeTimeLimit("nope")).toBe(DEFAULT_TIME_LIMIT_SECONDS);
    expect(sanitizeTimeLimit(undefined)).toBe(DEFAULT_TIME_LIMIT_SECONDS);
  });
});
