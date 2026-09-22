import { describe, expect, test } from "bun:test";
import { suggestUsername, validateUsername } from "../username";

describe("validateUsername", () => {
  test("accepts letters, digits, underscore and dot", () => {
    expect(validateUsername("lohit")).toBeNull();
    expect(validateUsername("Lohit_99")).toBeNull();
    expect(validateUsername("code.royale")).toBeNull();
    expect(validateUsername("a1_.b2")).toBeNull();
  });

  test("rejects other signs and spaces", () => {
    expect(validateUsername("Swaminath Sivakumar")).not.toBeNull();
    expect(validateUsername("name-with-dash")).not.toBeNull();
    expect(validateUsername("name@x")).not.toBeNull();
    expect(validateUsername("a/b")).not.toBeNull();
    expect(validateUsername("a+b")).not.toBeNull();
  });

  test("enforces length 3-20", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("a".repeat(21))).not.toBeNull();
    expect(validateUsername("abc")).toBeNull();
    expect(validateUsername("a".repeat(20))).toBeNull();
  });

  test("must start with a letter or number", () => {
    expect(validateUsername("_lohit")).not.toBeNull();
    expect(validateUsername(".lohit")).not.toBeNull();
    expect(validateUsername("9lives")).toBeNull();
  });

  test("rejects non-strings", () => {
    expect(validateUsername(null)).not.toBeNull();
    expect(validateUsername(undefined)).not.toBeNull();
  });
});

describe("suggestUsername", () => {
  test("strips disallowed signs", () => {
    expect(suggestUsername("Swaminath Sivakumar")).toBe("SwaminathSivakumar");
    expect(suggestUsername("lohit@gmail")).toBe("lohitgmail");
  });

  test("returns empty string when nothing usable remains", () => {
    expect(suggestUsername("ab")).toBe("");
    expect(suggestUsername("---")).toBe("");
    expect(suggestUsername("")).toBe("");
  });
});
