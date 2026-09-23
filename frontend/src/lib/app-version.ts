/**
 * Minimal semantic-version helpers.
 *
 * ga: We identify deployments by version number rather than git commit SHA —
 * a commit hash can't be compared, but "0.9.3" can. Code Royale's canonical
 * version lives in package.json (the single source of truth) and is echoed by
 * /api/version. Callers can assert a deployed build meets a floor with `?min=`.
 */

/** Returns [major, minor, patch] ignoring prerelease/build metadata. */
export function parseVersionParts(version: string): number[] {
  const clean = version.split(/[-+]/)[0]; // drop "-beta.1" / "+build.5"
  const parts = clean.split(".").map((n) => {
    const parsed = Number.parseInt(n, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/** Reports whether `version` is at least `minimum` (semver numeric compare). */
export function satisfiesMinimum(version: string, minimum: string): boolean {
  const a = parseVersionParts(version);
  const b = parseVersionParts(minimum);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

/** App version injected at build time from package.json. */
export const APP_VERSION = (process.env.NEXT_PUBLIC_APP_VERSION ?? "").trim() || "0.0.0";

/** Short git commit injected at build time; "unknown" when unavailable. */
export const APP_COMMIT = (process.env.NEXT_PUBLIC_APP_COMMIT ?? "").trim() || "unknown";

/** Human-readable build label, for example "v1.0.0 · a1b2c3d". */
export function appVersionLabel(
  version: string = APP_VERSION,
  commit: string = APP_COMMIT,
): string {
  const cleanVersion = version.trim() || "0.0.0";
  const cleanCommit = commit.trim();
  if (!cleanCommit || cleanCommit === "unknown") return `v${cleanVersion}`;
  return `v${cleanVersion} · ${cleanCommit}`;
}
