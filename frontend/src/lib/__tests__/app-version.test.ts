import { describe, expect, test } from "bun:test";
import { appVersionLabel, parseVersionParts, satisfiesMinimum } from "../app-version";

describe("parseVersionParts", () => {
  test("parses a plain semantic version", () => {
    expect(parseVersionParts("1.2.3")).toEqual([1, 2, 3]);
  });

  test("drops prerelease and build metadata", () => {
    expect(parseVersionParts("1.2.3-beta.1+build.5")).toEqual([1, 2, 3]);
  });

  test("pads missing segments with zero", () => {
    expect(parseVersionParts("1")).toEqual([1, 0, 0]);
  });
});

describe("satisfiesMinimum", () => {
  test("accepts equal and higher versions", () => {
    expect(satisfiesMinimum("1.0.0", "1.0.0")).toBe(true);
    expect(satisfiesMinimum("1.2.0", "1.1.9")).toBe(true);
  });

  test("rejects lower versions", () => {
    expect(satisfiesMinimum("0.9.0", "1.0.0")).toBe(false);
  });
});

describe("appVersionLabel", () => {
  test("formats version and commit", () => {
    expect(appVersionLabel("1.0.0", "a1b2c3d")).toBe("v1.0.0 · a1b2c3d");
  });

  test("omits an unknown commit", () => {
    expect(appVersionLabel("1.0.0", "unknown")).toBe("v1.0.0");
  });

  test("omits an empty commit", () => {
    expect(appVersionLabel("1.0.0", "")).toBe("v1.0.0");
  });

  test("falls back to 0.0.0 for an empty version", () => {
    expect(appVersionLabel("", "a1b2c3d")).toBe("v0.0.0 · a1b2c3d");
  });
});