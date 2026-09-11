import { describe, expect, test } from "bun:test";
import { JOIN_SEARCH_TIMEOUT_MS, resolveMatchIdFromParams } from "../matchmaking";

describe("resolveMatchIdFromParams", () => {
  test("resolves sync params (older Next)", async () => {
    await expect(resolveMatchIdFromParams({ matchId: "abc-123" })).resolves.toBe("abc-123");
  });

  test("resolves async params (Next 15/16)", async () => {
    await expect(resolveMatchIdFromParams(Promise.resolve({ matchId: "abc-123" }))).resolves.toBe(
      "abc-123",
    );
  });

  test("returns null for missing or empty match ids", async () => {
    await expect(resolveMatchIdFromParams({ matchId: "" })).resolves.toBeNull();
    await expect(resolveMatchIdFromParams(null)).resolves.toBeNull();
    await expect(resolveMatchIdFromParams(undefined)).resolves.toBeNull();
  });
});

describe("JOIN_SEARCH_TIMEOUT_MS", () => {
  test("stays under the Vercel Hobby function limit", () => {
    // Vercel Hobby kills serverless functions at ~10s. The join route must
    // return fast and let the client status-poll do the waiting.
    expect(JOIN_SEARCH_TIMEOUT_MS).toBeLessThanOrEqual(9000);
  });
});
