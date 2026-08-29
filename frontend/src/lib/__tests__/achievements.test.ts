import { describe, expect, test } from "bun:test";
import { computeAchievements } from "../achievements";

describe("computeAchievements", () => {
  test("a newcomer has nothing unlocked", () => {
    const achieved = computeAchievements({ wins: 0, losses: 0, solvedProblems: 0 });
    expect(achieved.length).toBeGreaterThan(0);
    expect(achieved.every((a) => !a.unlocked)).toBe(true);
  });

  test("the first win unlocks first-win and matchmaker", () => {
    const achieved = computeAchievements({ wins: 1, losses: 0, solvedProblems: 0 });
    expect(achieved.find((a) => a.id === "first-win")?.unlocked).toBe(true);
    expect(achieved.find((a) => a.id === "matchmaker")?.unlocked).toBe(true);
    expect(achieved.find((a) => a.id === "problem-solver")?.unlocked).toBe(false);
  });

  test("the first solved problem unlocks problem-solver", () => {
    const achieved = computeAchievements({ wins: 0, losses: 0, solvedProblems: 1 });
    expect(achieved.find((a) => a.id === "problem-solver")?.unlocked).toBe(true);
  });

  test("ten wins and ten solves unlock the tiered achievements", () => {
    const achieved = computeAchievements({ wins: 10, losses: 5, solvedProblems: 10 });
    expect(achieved.find((a) => a.id === "double-digits")?.unlocked).toBe(true);
    expect(achieved.find((a) => a.id === "deep-diver")?.unlocked).toBe(true);
    expect(achieved.find((a) => a.id === "first-win")?.unlocked).toBe(true);
  });

  test("matching lost games count toward play but not wins", () => {
    const achieved = computeAchievements({ wins: 0, losses: 3, solvedProblems: 0 });
    expect(achieved.find((a) => a.id === "matchmaker")?.unlocked).toBe(true);
    expect(achieved.find((a) => a.id === "first-win")?.unlocked).toBe(false);
  });
});