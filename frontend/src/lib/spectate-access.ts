/**
 * Who is allowed to spectate a duel, and whose side they get to see.
 *
 * The bug this exists to close: `getSpectateSnapshot` only checked that the
 * caller was signed in. Anyone who obtained a match id — and the arena URL is
 * deliberately shareable, so a challenger is handed one to send to someone —
 * could watch any duel, including one they had no connection to. Watching a
 * stranger mid-competition is a scouting tool, which is exactly the cheating
 * vector a ranked ladder cannot afford.
 *
 * So spectating is friend-only:
 *   1. You may only spectate a match you have a friend playing in.
 *   2. And you only ever see that friend — never the opponent on the other
 *      side, who has nothing to do with you.
 */

export type SpectateAccessInput = {
  /** Everyone seated in the match. */
  playerIds: string[];
  /** The spectator's accepted connections. Never expected to contain the viewer. */
  friendIds: string[];
  /**
   * The spectator. Excluded explicitly, so a viewer that somehow appears in
   * their own friend list cannot become their own key to the match.
   */
  viewerId?: string;
};

/** The players in the match who are also friends of the viewer. */
export function friendParticipants(input: SpectateAccessInput): string[] {
  const friends = new Set(input.friendIds);
  if (input.viewerId) friends.delete(input.viewerId);
  return input.playerIds.filter((id) => friends.has(id));
}

/**
 * Spectating is friend-gated.
 *
 * Being in the match yourself does NOT grant access: a player already has the
 * live arena, and letting them pull the read-only snapshot would be a way to
 * read a settled result they are not entitled to. Friendship is the only key.
 */
export function canSpectate(input: SpectateAccessInput): boolean {
  return friendParticipants(input).length > 0;
}

/**
 * The subset of players the snapshot may disclose.
 *
 * Empty means "you may not watch this" — the caller turns that into a 404 so
 * the endpoint does not confirm that the match exists at all.
 */
export function visibleSpectatePlayers(input: SpectateAccessInput): string[] {
  return friendParticipants(input);
}