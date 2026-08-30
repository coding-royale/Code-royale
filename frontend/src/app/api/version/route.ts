import { NextResponse } from "next/server";
import { satisfiesMinimum } from "@/lib/app-version";
import pkg from "../../../../package.json";

/*
 * Build + integration diagnostics for the deployed frontend.
 *
 * Answers three operational questions without exposing secrets:
 *   1. Which version + commit is actually running? The version comes from
 *      package.json (bump it to release). `?min=<v>` returns whether the
 *      deployed build is at least that version — "minimum versioning" instead
 *      of trusting a raw commit hash.
 *   2. Can this deployment reach the goboxd judge? (Presence of the config
 *      plus one live /healthz probe, reported as a status code.)
 *   3. What's the goboxd backend version exposing? (Parsed from /info.)
 *
 * Only booleans, version numbers, and a status code are returned — never the
 * goboxd auth token or its URL — so this endpoint is safe to expose publicly.
 */

const GOBOXD_HEALTH_TIMEOUT_MS = 5_000;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const goboxdBaseUrl = (process.env.GOBOXD_API_URL ?? "").replace(/\/+$/, "");
  const authTokenConfigured = Boolean(process.env.GOBOXD_AUTH_TOKEN);

  const minParam = new URL(request.url).searchParams.get("min") ?? undefined;

  let goboxdHealth: number | "unreachable" | "not_configured" = "not_configured";
  let goboxdVersion: string | null = null;
  if (goboxdBaseUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GOBOXD_HEALTH_TIMEOUT_MS);
    try {
      const [healthResp, infoResp] = await Promise.allSettled([
        fetch(`${goboxdBaseUrl}/healthz`, {
          signal: controller.signal,
          cache: "no-store",
        }),
        fetch(`${goboxdBaseUrl}/info`, { signal: controller.signal, cache: "no-store" }),
      ]);
      if (healthResp.status === "fulfilled") goboxdHealth = healthResp.value.status;
      else goboxdHealth = "unreachable";
      if (infoResp.status === "fulfilled") {
        try {
          const info = (await infoResp.value.json()) as {
            build_info?: { version?: string };
          };
          goboxdVersion = info.build_info?.version ?? null;
        } catch {
          goboxdVersion = null;
        }
      }
    } catch {
      goboxdHealth = "unreachable";
    } finally {
      clearTimeout(timer);
    }
  }

  const version = (pkg.version ?? "0.0.0").trim() || "0.0.0";
  const response: Record<string, unknown> = {
    version,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
    goboxd: {
      urlConfigured: Boolean(goboxdBaseUrl),
      authTokenConfigured,
      health: goboxdHealth,
      version: goboxdVersion,
    },
  };

  if (minParam) {
    response.min = minParam;
    response.satisfies = satisfiesMinimum(version, minParam);
  }

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
