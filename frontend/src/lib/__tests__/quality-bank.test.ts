import { describe, expect, test } from "bun:test";
import { QUALITY_BANK, problemMeta } from "../../../scripts/quality-bank.mjs";
import { signatureFromMeta } from "../harness";

describe("quality-bank", () => {
  test("every problem is well-formed and has full metadata", () => {
    expect(QUALITY_BANK.length).toBeGreaterThan(0);
    for (const problem of QUALITY_BANK) {
      expect(["easy", "medium", "hard"]).toContain(problem.difficulty);
      expect(Array.isArray(problem.languages) && problem.languages.length > 0).toBe(true);

      // The signature must be one the harness can execute.
      expect(signatureFromMeta({ signature: problem.signature })).not.toBeNull();

      // Non-empty testcases with string input/output.
      expect(Array.isArray(problem.testcases) && problem.testcases.length > 0).toBe(true);
      for (const tc of problem.testcases) {
        expect(typeof tc.input).toBe("string");
        expect(typeof tc.output).toBe("string");
      }

      // Full metadata so practice doesn't show "To be determined".
      const meta = problemMeta(problem.slug);
      expect(meta).toBeDefined();
      expect(typeof meta?.timeComplexity).toBe("string");
      expect((meta?.timeComplexity ?? "").trim().length).toBeGreaterThan(0);
      expect(typeof meta?.spaceComplexity).toBe("string");
      expect((meta?.spaceComplexity ?? "").trim().length).toBeGreaterThan(0);
      expect(Array.isArray(meta?.topics) && (meta?.topics.length ?? 0) > 0).toBe(true);
    }
  });
});