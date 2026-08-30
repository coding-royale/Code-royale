/**
 * Per-user (non-anonymous) rate limiting for code submissions.
 *
 * Instead of keying on an IP address, it keys on the authenticated Supabase
 * `user_id`. That defeats the two classic per-IP weaknesses:
 *   1. Many users behind a shared IP (office/NAT/school) no longer trip one
 *      another's limit.
 *   2. A single attacker cannot hide behind many IPs to bypass the limit.
 *
 * The counter lives in Postgres (`public.bump_submit_rate`, see
 * `frontend/supabase-submit-rate-limit.sql`), so it is shared across every
 * Vercel serverless instance and survives cold starts — an in-memory map would
 * reset per lambda and be trivially bypassed.
 *
 * Wired into `POST /api/practice/submit` (used by the practice, bot-battle,
 * and match arenas). The route requires an authenticated session first, so
 * only requests with a real `user_id` reach the limiter.
 */

import { createSupabaseServiceClient } from "./supabase-service";

export type SubmitRateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; resetAfterSeconds: number };

// Defaults and env overrides. Purely server-side; never sent to the browser.
const DEFAULT_LIMIT = 20; // submissions per user per window
const DEFAULT_WINDOW_SECONDS = 20; // window length

function numberFromEnv(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Atomically records one submission for `userId` and reports whether the user
 * is still within their window limit.
 *
 * Fails OPEN on a store/network error: we log and allow rather than break the
 * game (or, worse, block every player) because Supabase is briefly
 * unreachable. The limiter is defence-in-depth on top of goboxd's own
 * per-IP throttle, so a momentary bypass does not expose any new surface.
 */
export async function checkSubmitRateLimit(
  userId: string,
): Promise<SubmitRateLimitResult> {
  const limit = numberFromEnv(process.env.SUBMIT_RATE_LIMIT, DEFAULT_LIMIT);
  const windowSeconds = numberFromEnv(
    process.env.SUBMIT_RATE_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS,
  );

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("submit rate limit: service client unavailable", message);
    return { ok: true, remaining: limit };
  }

  const { data, error } = await supabase.rpc("bump_submit_rate", {
    p_user_id: userId,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("submit rate limit rpc failed", error.message);
    return { ok: true, remaining: limit };
  }

  const payload: unknown = Array.isArray(data) ? data[0] : data;
  if (isRecord(payload) && payload.allowed === false) {
    const resetAfter = Number(payload.reset_after);
    return {
      ok: false,
      resetAfterSeconds: Number.isFinite(resetAfter) && resetAfter > 0
        ? resetAfter
        : windowSeconds,
    };
  }

  const remaining = Number(isRecord(payload) ? payload.remaining : NaN);
  return {
    ok: true,
    remaining: Number.isFinite(remaining) ? remaining : limit,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}