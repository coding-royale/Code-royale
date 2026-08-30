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