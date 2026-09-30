import { describe, expect, test } from "bun:test";
import { resolveAvatarUrl } from "../resolve-avatar";

describe("resolveAvatarUrl", () => {
  test("an uploaded photo beats the OAuth provider photo", () => {
    expect(
      resolveAvatarUrl({
        stored: "https://project.supabase.co/storage/v1/object/public/avatars/u1/avatar-1.png",
        provider: "https://lh3.googleusercontent.com/a/abc123",
      }),
    ).toBe("https://project.supabase.co/storage/v1/object/public/avatars/u1/avatar-1.png");
  });

  test("falls back to the provider photo when nothing was uploaded", () => {
    expect(
      resolveAvatarUrl({ stored: null, provider: "https://lh3.googleusercontent.com/a/abc123" }),
    ).toBe("https://lh3.googleusercontent.com/a/abc123");
  });

  test("returns null when neither source has a photo", () => {
    expect(resolveAvatarUrl({ stored: null, provider: null })).toBeNull();
    expect(resolveAvatarUrl({ stored: undefined, provider: undefined })).toBeNull();
  });

  test("treats blank and whitespace-only values as missing", () => {
    expect(resolveAvatarUrl({ stored: "   ", provider: "https://cdn.example/pic.png" })).toBe(
      "https://cdn.example/pic.png",
    );
    expect(resolveAvatarUrl({ stored: "", provider: "" })).toBeNull();
  });

  test("trims surrounding whitespace on the chosen photo", () => {
    expect(resolveAvatarUrl({ stored: "  https://cdn.example/pic.png  ", provider: null })).toBe(
      "https://cdn.example/pic.png",
    );
  });
});
