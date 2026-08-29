import { describe, expect, test } from "bun:test";
import { validateReport } from "../report";

describe("validateReport", () => {
  test("accepts a valid report", () => {
    expect(validateReport({ reporterId: "a", reportedId: "b", reason: "Harassment" })).toEqual({});
  });

  test("rejects reporting yourself", () => {
    const r = validateReport({ reporterId: "a", reportedId: "a", reason: "Cheating" });
    expect(r.error).toBeDefined();
  });

  test("rejects an unknown reason", () => {
    const r = validateReport({ reporterId: "a", reportedId: "b", reason: "Nonsense" });
    expect(r.error).toBeDefined();
  });

  test("rejects missing ids", () => {
    const r = validateReport({ reporterId: "", reportedId: "b", reason: "Spam" });
    expect(r.error).toBeDefined();
  });

  test("rejects an overlong description", () => {
    const r = validateReport({
      reporterId: "a",
      reportedId: "b",
      reason: "Spam",
      description: "x".repeat(501),
    });
    expect(r.error).toBeDefined();
  });
});