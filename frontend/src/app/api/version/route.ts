import { NextResponse } from "next/server";

/*
 * Build + integration diagnostics for the deployed frontend.
 *
 * Answers two operational questions without exposing secrets:
 *   1. Which commit is actually running? (Vercel stamps
 *      VERCEL_GIT_COMMIT_SHA on every build; "unknown" for a local `bun dev`.)
 *   2. Can this deployment reach the goboxd judge? (Presence of the config
 *      plus one live /healthz probe, reported as a status code.)
 *
 * Only booleans and a status code are returned — never the goboxd auth token
 * or its URL — so this endpoint is safe to expose publicly.
 */

const GOBOXD_HEALTH_TIMEOUT_MS = 5_000;

export const dynamic = "force-dynamic";

export async function GET() {
  const goboxdBaseUrl = (process.env.GOBOXD_API_URL ?? "").replace(/\/+$/, "");
  const authTokenConfigured = Boolean(process.env.GOBOXD_AUTH_TOKEN);

  let goboxdHealth: number | "unreachable" | "not_configured" = "not_configured";
  if (goboxdBaseUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GOBOXD_HEALTH_TIMEOUT_MS);
    try {
      const response = await fetch(`${goboxdBaseUrl}/healthz`, {
        signal: controller.signal,
        cache: "no-store",
      });
      goboxdHealth = response.status;
    } catch {
      goboxdHealth = "unreachable";
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
      goboxd: {
        urlConfigured: Boolean(goboxdBaseUrl),
        authTokenConfigured,
        health: goboxdHealth,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
