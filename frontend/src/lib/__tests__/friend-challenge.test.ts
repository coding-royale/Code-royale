import { describe, expect, test } from "bun:test";
import {
  CHALLENGE_TTL_MS,
  isChallengeExpired,
  isChallengeLive,
  parseChallengeMode,
  resolveChallengeDifficulty,
} from "../friend-challenge";

describe("parseChallengeMode", () => {
  test("unranked stays unranked, everything else is ranked", () => {
    expect(parseChallengeMode("unranked")).toBe("unranked");
    expect(parseChallengeMode("ranked")).toBe("ranked");
    expect(parseChallengeMode(undefined)).toBe("ranked");
    expect(parseChallengeMode("garbage")).toBe("ranked");
  });
});

describe("resolveChallengeDifficulty", () => {
  test("two bronzes get easy (avg rating < 300)", () => {
    expect(resolveChallengeDifficulty(0, 100)).toBe("easy");
  });

  test("bronze + silver mix gets medium (avg < 700)", () => {
    expect(resolveChallengeDifficulty(100, 600)).toBe("medium");
  });

  test("two high-rated players get hard", () => {
    expect(resolveChallengeDifficulty(800, 1200)).toBe("hard");
  });
});

describe("isChallengeExpired", () => {
  test("fresh challenges are live", () => {
    const now = Date.parse("2026-09-12T12:00:00.000Z");
    expect(isChallengeExpired("2026-09-12T11:55:00.000Z", now)).toBe(false);
  });

  test("challenges older than the TTL are expired", () => {
    const now = Date.parse("2026-09-12T12:00:00.000Z");
    expect(isChallengeExpired("2026-09-12T11:40:00.000Z", now)).toBe(true);
  });

  test("invalid timestamps count as expired", () => {
    expect(isChallengeExpired("nope", Date.now())).toBe(true);
  });

  test("default TTL is 15 minutes", () => {
    expect(CHALLENGE_TTL_MS).toBe(15 * 60 * 1000);
  });
});

describe("isChallengeLive", () => {
  test("active + started means both players should enter", () => {
    expect(isChallengeLive("active", "2026-09-12T12:00:00.000Z")).toBe(true);
  });

  test("pending or missing start means keep waiting", () => {
    expect(isChallengeLive("pending", null)).toBe(false);
    expect(isChallengeLive("active", null)).toBe(false);
    expect(isChallengeLive("cancelled", "2026-09-12T12:00:00.000Z")).toBe(false);
  });
});
