/**
 * Match room: the single source of truth for "when does the duel start" and
 * "how much time is left".
 *
 * The bug this file exists to kill: each player used to run their own
 * `setInterval(prev => prev - 1, 1000)` counter seeded from a server-rendered
 * number. Background-tab throttling, slow page loads and per-player
 * `started_at` drift made the two clocks disagree by tens of seconds, so one
 * player was quietly solving under a shorter timer than the other.
 *
 * The fix has two halves:
 *  1. The server writes `started_at` exactly once (a conditional UPDATE), so
 *     both players read the same instant. It is written a few seconds in the
 *     future so both get the same visible 3-2-1 countdown.
 *  2. Both clients derive the remaining time from that instant plus the
 *     client's measured clock offset. Nothing decrements, so throttling and
 *     dropped ticks cannot cause drift — every tick recomputes from the
 *     wall clock.
 */

import { formatLastActive } from "./match-activity";

/**
 * How long a player's `present_at` stays fresh. A tab polls the room every
 * 1.5s, so a generous window tolerates a hiccup without letting someone who
 * already closed the tab count as "in the room".
 */
export const ROOM_PRESENCE_TTL_MS = 20_000;

/**
 * Only used when `match_players.present_at` is missing (schema predates the
 * migration): the room cannot be observed, so it opens on a timer rather than
 * stalling the queue forever.
 */
export const LOBBY_FALLBACK_MS = 8_000;

/** After this long in an unfilled room the match is treated as abandoned. */
export const LOBBY_ABANDON_MS = 45_000;

/** Shared 3-2-1 lead-in, baked into `started_at` so both clients agree. */
export const MATCH_COUNTDOWN_MS = 3_000;

/*
 * `matches.status` is guarded by a CHECK constraint that only permits these
 * four values, so the room gate has to speak the existing vocabulary:
 *
 *   pending  -> room created, both seats taken, clock not started yet
 *   active   -> the shared start instant has been written, clock running
 *
 * "pending" is also what a friend challenge uses, which is why accepting one
 * leaves the status alone and only records `accepted_at` in the metadata.
 */
export const MATCH_STATUS_PENDING = "pending";
export const MATCH_STATUS_ACTIVE = "active";
export const MATCH_STATUS_COMPLETED = "completed";
export const MATCH_STATUS_CANCELLED = "cancelled";

export const DEFAULT_TIME_LIMIT_SECONDS = 8 * 60;

/** Opponent is considered "actively working" for this long after a run. */
export const OPPONENT_ACTIVE_WINDOW_MS = 8_000;

export type MatchPhase = "lobby" | "countdown" | "live" | "over";

export function parseIsoMs(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Estimate how far the client clock sits behind the server clock.
 *
 * The server's timestamp was produced somewhere between `sentAtMs` and
 * `receivedAtMs`, so the midpoint of the round trip is the best guess. RTT is
 * tiny against a multi-minute match, but it removes the systematic error of
 * trusting `Date.now()` on a device whose clock is off.
 */
export function computeClockOffsetMs(
  serverNowMs: number,
  sentAtMs: number,
  receivedAtMs: number,
): number {
  const roundTripMs = Math.max(0, receivedAtMs - sentAtMs);
  return serverNowMs + roundTripMs / 2 - receivedAtMs;
}

/**
 * Where the duel is in its life. `startedAt` in the future means the shared
 * countdown is still running; a decided match is always `over` so a late
 * poll can never resurrect a finished arena.
 */
export function resolveMatchPhase(input: {
  startedAt: string | null | undefined;
  winnerId?: string | null;
  nowMs: number;
}): MatchPhase {
  if (typeof input.winnerId === "string" && input.winnerId) return "over";
  const startedMs = parseIsoMs(input.startedAt);
  if (startedMs === null) return "lobby";
  if (input.nowMs < startedMs) return "countdown";
  return "live";
}

/** Whole seconds left on the shared 3-2-1 countdown (0 once it is over). */
export function countdownSecondsRemaining(
  startedAt: string | null | undefined,
  nowMs: number,
): number {
  const startedMs = parseIsoMs(startedAt);
  if (startedMs === null) return 0;
  return Math.max(0, Math.ceil((startedMs - nowMs) / 1000));
}

/** Seconds left in the match, derived from the shared start instant. */
export function remainingMatchSeconds(input: {
  startedAt: string | null | undefined;
  timeLimitSeconds: number;
  nowMs: number;
}): number {
  const startedMs = parseIsoMs(input.startedAt);
  if (startedMs === null) return 0;
  const limit = Number.isFinite(input.timeLimitSeconds) && input.timeLimitSeconds > 0
    ? input.timeLimitSeconds
    : DEFAULT_TIME_LIMIT_SECONDS;
  return Math.max(0, Math.ceil((startedMs + limit * 1000 - input.nowMs) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function sanitizeTimeLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIME_LIMIT_SECONDS;
  return Math.max(60, Math.min(60 * 60, Math.floor(parsed)));
}

export type OpponentSummary = {
  attempts: number;
  bestPassed: number;
  bestTotal: number;
  lastActiveAt: string | null;
  solved?: boolean;
};

export type OpponentState = "waiting" | "reading" | "testing" | "thinking" | "solved";

/** One word for what the opponent is doing right now. */
export function resolveOpponentState(
  summary: OpponentSummary,
  nowMs: number = Date.now(),
): OpponentState {
  if (summary.solved) return "solved";
  if (summary.attempts === 0) return "reading";
  const lastMs = parseIsoMs(summary.lastActiveAt);
  if (lastMs !== null && nowMs - lastMs <= OPPONENT_ACTIVE_WINDOW_MS) return "testing";
  return "thinking";
}

export const opponentStateLabels: Record<OpponentState, string> = {
  waiting: "In the room",
  reading: "Reading the problem",
  testing: "Running tests",
  thinking: "Thinking",
  solved: "Solved it",
};

/** Compact "3 tries · best 4/8 · 12s ago" line for the header chip. */
export function describeOpponentActivity(
  summary: OpponentSummary,
  nowMs: number = Date.now(),
): string {
  if (summary.attempts === 0) {
    return "no runs yet";
  }
  const tries = `${summary.attempts} ${summary.attempts === 1 ? "try" : "tries"}`;
  const best =
    summary.bestTotal > 0
      ? `best ${summary.bestPassed}/${summary.bestTotal}`
      : `best ${summary.bestPassed}`;
  return `${tries} · ${best} · ${formatLastActive(summary.lastActiveAt, nowMs)}`;
}

export type MatchAttemptRow = {
  user_id: string;
  passed: number;
  total: number;
};

/** A run in this match that passed every test case. */
export function pickSolvedPlayerIds(rows: MatchAttemptRow[]): Set<string> {
  const solved = new Set<string>();
  for (const row of rows) {
    const total = typeof row.total === "number" ? row.total : 0;
    const passed = typeof row.passed === "number" ? row.passed : 0;
    if (total > 0 && passed >= total) solved.add(row.user_id);
  }
  return solved;
}

export type TimedOutSubmission = {
  user_id: string;
  created_at: string;
};

/**
 * Who wins when the clock runs out.
 *
 * Only a *submit* records a `practice_submissions` row, and only submissions
 * made after the shared start instant count. The old query had no time bound
 * at all, so anyone who had ever passed that question — in the practice
 * arena, weeks ago — was handed the win, and leaving the arena early was a
 * winning move. Both solved, or neither, is a draw: nobody "won" the race.
 */
export function pickTimedOutWinnerId(input: {
  playerIds: string[];
  submissions: TimedOutSubmission[];
  startedAt: string | null | undefined;
}): string | null {
  const startMs = parseIsoMs(input.startedAt);
  if (startMs === null) return null;

  const solved = new Set<string>();
  for (const row of input.submissions) {
    const at = parseIsoMs(row.created_at);
    if (at !== null && at >= startMs) solved.add(row.user_id);
  }

  if (solved.size !== 1) return null;
  const [only] = Array.from(solved);
  return input.playerIds.includes(only) ? only : null;
}

/**
 * Leaving the arena is a forfeit, never a win.
 *
 * "Committed" means the shared start instant has already been written, which
 * includes the 3-2-1 countdown: the duel is going to run, so walking out then
 * costs the match just like walking out mid-duel does. A player still in the
 * room-gate lobby has committed to nothing and forfeits nothing.
 */
export function isMatchCommitted(phase: MatchPhase): boolean {
  return phase === "countdown" || phase === "live";
}

export function shouldForfeitOnUnload(input: {
  phase: MatchPhase;
  decided: boolean;
  alreadySent: boolean;
}): boolean {
  if (input.alreadySent) return false;
  if (input.decided) return false;
  return isMatchCommitted(input.phase);
}

/** Why the room is still holding, for the waiting screen. */
/**
 * Which seats are really occupied right now.
 *
 * The old room gate gave up after a fixed 8 seconds, which started the clock
 * with one player already solving while the opponent was still loading their
 * page — the exact unfair start this exists to prevent. Presence is tracked
 * per player in `match_players.present_at`, so the duel opens when both seats
 * are genuinely occupied, and only gives up when the room is truly empty.
 */
export function countPresentPlayers(input: {
  presentAtByUser: Map<string, string | null>;
  playerIds: string[];
  nowMs: number;
}): { present: number; total: number; everyoneHere: boolean } {
  const total = input.playerIds.length;
  let present = 0;
  for (const id of input.playerIds) {
    const at = input.presentAtByUser.get(id) ?? null;
    const ms = parseIsoMs(at);
    if (ms !== null && input.nowMs - ms <= ROOM_PRESENCE_TTL_MS) present += 1;
  }
  return { present, total, everyoneHere: total > 1 && present >= total };
}

export type LobbyReason = "waiting" | "abandoned" | null;

export function resolveLobbyReason(input: {
  createdAt: string | null | undefined;
  playersPresent: number;
  playersTotal: number;
  nowMs: number;
}): LobbyReason {
  if (input.playersPresent >= Math.max(1, input.playersTotal)) return "waiting";
  const createdMs = parseIsoMs(input.createdAt);
  if (createdMs === null) return "waiting";
  if (input.nowMs - createdMs >= LOBBY_ABANDON_MS) return "abandoned";
  return "waiting";
}

/*
 * The "ghost victory" bug, and the two rules that close it.
 *
 * Matchmaking seats a player in a brand new match, but nothing stopped that
 * player from still sitting on an older one that had already been decided. The
 * stale page kept polling every 1.5s, so that *old* match kept a fresh
 * `present_at` while the new room sat empty. The player waiting in the new
 * lobby was told "opponent never showed up", and the other player was looking
 * at a victory card from a duel that had already been decided days earlier.
 *
 * `matches.status` cannot save us here on its own: the forfeit/timeout/complete
 * routes only ever wrote `metadata.winner_id`, so a decided match was still
 * sitting in "active". A winner id is therefore treated as authoritative.
 */

/** A match a player may still be sent into. */
export function isMatchJoinable(input: {
  status: string | null | undefined;
  winnerId?: string | null;
  completedAt?: string | null;
}): boolean {
  if (isMatchDecided(input)) return false;
  return input.status === MATCH_STATUS_PENDING || input.status === MATCH_STATUS_ACTIVE;
}

export type MatchMembershipRow = {
  match_id?: string | null;
  status?: string | null;
  winner_id?: string | null;
};

/**
 * Has this match already been settled?
 *
 * `status` alone cannot answer it: the forfeit/timeout/complete routes write
 * `metadata.winner_id` and `metadata.completed_at` but historically never moved
 * `status` off "active", so a duel decided five days ago still looked live.
 * That is how a player ended up staring at a stale victory card for a match
 * nobody was playing any more.
 */
export function isMatchDecided(input: {
  status?: string | null;
  winnerId?: string | null;
  completedAt?: string | null;
}): boolean {
  if (typeof input.winnerId === "string" && input.winnerId) return true;
  if (typeof input.completedAt === "string" && input.completedAt) return true;
  return input.status === MATCH_STATUS_COMPLETED || input.status === MATCH_STATUS_CANCELLED;
}

/**
 * Should the arena refuse to render and send the player back to the modes list?
 *
 * The ghost victory lived here: a browser parked on a match decided days
 * earlier kept its seat "present" and kept showing a result card for a duel
 * nobody was playing, while the room it had just been matched into waited for
 * an opponent that was never going to arrive.
 */
export function shouldRedirectOffDecidedMatch(input: {
  status?: string | null;
  winnerId?: string | null;
  completedAt?: string | null;
}): boolean {
  return isMatchDecided(input);
}

/**
 * The newest match this player can still join, or null.
 *
 * Status polling used to take the most recent `match_players` row and trust it,
 * which meant a long-dead match could outrank a live lobby and send the player
 * back into a finished duel. Filtering to joinable rows first makes the newest
 * *playable* match win.
 */
export function pickJoinableMatch(rows: MatchMembershipRow[]): string | null {
  for (const row of rows) {
    const matchId = typeof row.match_id === "string" ? row.match_id.trim() : "";
    if (!matchId) continue;
    if (isMatchJoinable({ status: row.status, winnerId: row.winner_id })) return matchId;
  }
  return null;
}
