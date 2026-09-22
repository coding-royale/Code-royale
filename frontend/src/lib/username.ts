/**
 * Shared username rules for Code Royale.
 *
 * Usernames must be unique (case-insensitive, enforced by the
 * `users_username_unique_ci` index) and may only contain letters, digits,
 * underscores and dots.
 *
 * Existing accounts created before this rule are grandfathered in the
 * database — this module only validates *new* choices (signup, onboarding,
 * settings).
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

const USERNAME_RE = /^[A-Za-z0-9_.]+$/;
const USERNAME_START_RE = /^[A-Za-z0-9]/;

/**
 * Returns an error message when `raw` is not an acceptable new username,
 * or null when it is valid.
 */
export function validateUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return "Username must be text.";
  const value = raw.trim();
  if (value.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_RE.test(value)) {
    return "Only letters, numbers, underscore (_) and dot (.) are allowed.";
  }
  if (!USERNAME_START_RE.test(value)) {
    return "Username must start with a letter or number.";
  }
  return null;
}

/**
 * Turn an arbitrary display string (OAuth name, email prefix) into a
 * best-effort valid username suggestion. Returns "" when nothing usable
 * remains — the caller should fall back to a generated default.
 */
export function suggestUsername(raw: string): string {
  const cleaned = (raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_.]/g, "")
    .replace(/^[_.]+/, "")
    .slice(0, USERNAME_MAX_LENGTH);
  return validateUsername(cleaned) === null ? cleaned : "";
}

/** Escape `%`, `_` and `\` so a username can be matched exactly with ilike. */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
