/**
 * Which picture represents a player, in one place.
 *
 * The order is deliberate: a photo the player uploaded in Settings always wins
 * over the one the OAuth provider (Google, GitHub) handed us at signup. The
 * provider picture is only a seed — before this rule existed, a Google user who
 * uploaded a new photo kept seeing the Google one on their own profile, and the
 * upload looked like it had never saved.
 */

export type AvatarSources = {
  /** `player_stats.avatar_url`, written by /api/avatar/upload. */
  stored?: string | null;
  /** `user_metadata.avatar_url` / `user_metadata.picture` from the OAuth provider. */
  provider?: string | null;
};

function clean(value?: string | null): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns the stored upload when there is one, else the provider picture, else
 * null. Callers layer their own placeholder (initials, DiceBear) on top.
 */
export function resolveAvatarUrl({ stored, provider }: AvatarSources): string | null {
  return clean(stored) ?? clean(provider);
}
