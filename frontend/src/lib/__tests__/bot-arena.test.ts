import { describe, expect, test } from "bun:test";
import { buildMatchUrl } from "../matchmaking";
import {
  getBotRevealSummary,
  shouldRevealBotCode,
} from "../bot-arena";

describe("buildMatchUrl", () => {
  test("returns the arena path for a match id (direct spawn, no gate)", () => {
    expect(buildMatchUrl("abc-123")).toBe("/match/abc-123");
  });

  test("returns null when there is no match id", () => {
    expect(buildMatchUrl(null)).toBeNull();
    expect(buildMatchUrl("")).toBeNull();
  });
});

describe("shouldRevealBotCode", () => {
  test("keeps code redacted while the battle is live", () => {
    expect(shouldRevealBotCode("playing")).toBe(false);
  });

  test("reveals code once the match is over for any reason", () => {
    expect(shouldRevealBotCode("won")).toBe(true);
    expect(shouldRevealBotCode("bot_won")).toBe(true);
    expect(shouldRevealBotCode("draw")).toBe(true);
    expect(shouldRevealBotCode("lost")).toBe(true);
  });
});

describe("getBotRevealSummary", () => {
  test("reports how far the bot got: lines and percent", () => {
    const summary = getBotRevealSummary("function solve(raw) {\n  return 1;\n}", 0.42);
    expect(summary.lines).toBe(3);
    expect(summary.percent).toBe(42);
  });

  test("handles empty code", () => {
    const summary = getBotRevealSummary("", 0);
    expect(summary.lines).toBe(0);
    expect(summary.percent).toBe(0);
  });

  test("clamps percent to 0-100", () => {
    expect(getBotRevealSummary("a", 1.5).percent).toBe(100);
    expect(getBotRevealSummary("a", -0.2).percent).toBe(0);
  });
});
