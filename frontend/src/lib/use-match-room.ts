"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase-browser";
import {
  computeClockOffsetMs,
  countdownSecondsRemaining,
  parseIsoMs,
  remainingMatchSeconds,
  resolveMatchPhase,
  type MatchPhase,
} from "./match-room";

export type MatchPlayerState = {
  userId: string;
  username: string;
  rating: number;
  isYou: boolean;
  attempts: number;
  bestPassed: number;
  bestTotal: number;
  lastActiveAt: string | null;
  lastActiveLabel: string;
  solved: boolean;
};

export type MatchRoomState = {
  matchId: string;
  mode: string;
  phase: MatchPhase;
  startedAt: string | null;
  timeLimitSeconds: number;
  /** Seconds on the shared clock; identical for both players. */
  remainingSeconds: number;
  /** Seconds of the shared 3-2-1 lead-in, or 0 once it is over. */
  countdownSeconds: number;
  playersTotal: number;
  playersPresent: number;
  lobbyReason: "waiting" | "abandoned" | null;
  winnerId: string | null;
  /** Set on every terminal path (win, forfeit, timeout) — wins over winnerId. */
  completedAt: string | null;
  forfeit: boolean;
  timedOut: boolean;
  opponentLeft: boolean;
  ratingDelta: { winner: number; loser: number } | null;
  players: MatchPlayerState[];
  error: string | null;
};

type SyncPayload = {
  matchId: string;
  mode?: string;
  phase?: MatchPhase;
  startedAt?: string | null;
  timeLimitSeconds?: number;
  serverNow?: string;
  playersTotal?: number;
  playersPresent?: number;
  lobbyReason?: "waiting" | "abandoned" | null;
  winnerId?: string | null;
  completedAt?: string | null;
  forfeit?: boolean;
  timedOut?: boolean;
  opponentLeft?: boolean;
  ratingDelta?: { winner: number; loser: number } | null;
  players?: MatchPlayerState[];
};

const SYNC_POLL_MS = 1_500;
const TICK_MS = 250;
/** A poll that fails this many times in a row is a real problem, not a blip. */
const ERROR_AFTER_FAILURES = 4;

/**
 * Drives the whole arena from one authoritative server poll.
 *
 * Everything time-related is *derived* from `startedAt` plus a measured clock
 * offset — nothing counts down on its own. That is what makes the two players
 * agree: a throttled tab, a dropped tick or a slow first paint can only make
 * the next render briefly late, never permanently wrong.
 */
export function useMatchRoom(matchId: string | null, fallback: {
  startedAt: string | null;
  timeLimitSeconds: number;
}) {
  const [state, setState] = useState<MatchRoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);

  const offsetRef = useRef(0);
  const presentIdsRef = useRef<string[]>([]);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  /** Whether the realtime channel is actually usable, not merely requested. */
  const presenceLiveRef = useRef(false);
  const failuresRef = useRef(0);
  const inFlightRef = useRef(false);

  const initial = useMemo(
    () => ({
      matchId: matchId ?? "",
      mode: "ranked",
      phase: resolveMatchPhase({
        startedAt: fallback.startedAt,
        winnerId: null,
        nowMs: Date.now(),
      }),
      startedAt: fallback.startedAt,
      timeLimitSeconds: fallback.timeLimitSeconds,
      remainingSeconds: 0,
      countdownSeconds: 0,
      playersTotal: 2,
      playersPresent: 0,
      lobbyReason: "waiting" as const,
      winnerId: null,
      completedAt: null,
      forfeit: false,
      timedOut: false,
      opponentLeft: false,
      ratingDelta: null,
      players: [],
      error: null,
    }),
    [matchId, fallback.startedAt, fallback.timeLimitSeconds],
  );

  const sync = useCallback(async () => {
    if (!matchId || inFlightRef.current) return;
    inFlightRef.current = true;
    const sentAt = Date.now();
    try {
      const res = await fetch(`/api/match/${matchId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentUserIds: presentIdsRef.current,
          presenceLive: presenceLiveRef.current,
        }),
        cache: "no-store",
      });
      const receivedAt = Date.now();
      if (!res.ok) throw new Error(`sync failed (${res.status})`);
      const payload = (await res.json()) as SyncPayload;

      const serverNowMs = parseIsoMs(payload.serverNow ?? null);
      if (serverNowMs !== null) {
        offsetRef.current = computeClockOffsetMs(serverNowMs, sentAt, receivedAt);
      }

      failuresRef.current = 0;
      setConnected(true);
      setState((prev) => {
        const base = prev ?? initial;
        const startedAt = payload.startedAt ?? null;
        return {
          ...base,
          matchId: payload.matchId ?? base.matchId,
          mode: payload.mode ?? base.mode,
          startedAt,
          timeLimitSeconds: payload.timeLimitSeconds ?? base.timeLimitSeconds,
          phase: payload.phase ?? base.phase,
          playersTotal: payload.playersTotal ?? base.playersTotal,
          playersPresent: payload.playersPresent ?? base.playersPresent,
          lobbyReason: payload.lobbyReason ?? null,
          winnerId: payload.winnerId ?? null,
          completedAt: payload.completedAt ?? null,
          forfeit: payload.forfeit === true,
          timedOut: payload.timedOut === true,
          opponentLeft: payload.opponentLeft === true,
          ratingDelta: payload.ratingDelta ?? null,
          players: payload.players ?? base.players,
          error: null,
        };
      });
    } catch {
      failuresRef.current += 1;
      if (failuresRef.current >= ERROR_AFTER_FAILURES) setConnected(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [matchId, initial]);

  // Poll the room. Fast enough to feel live, slow enough to be free.
  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    void sync();
    const interval = window.setInterval(() => {
      if (alive) void sync();
    }, SYNC_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [matchId, sync]);

  // A tab that wakes up re-syncs immediately instead of trusting stale time.
  useEffect(() => {
    if (!matchId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [matchId, sync]);

  /*
   * Room presence over Supabase realtime. This is a hint, not a source of
   * truth: it lets the server open the duel the moment both players are really
   * on the page, instead of waiting out the fallback window. If realtime is
   * unavailable the server still starts the match on time.
   */
  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const tabKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!alive || !userId) return;

      channel = supabase.channel(`match-room:${matchId}`, {
        config: { presence: { key: tabKey } },
      });

      const publish = () => {
        const state = channel?.presenceState() ?? {};
        const ids = new Set<string>();
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            const tracked = entry as { user_id?: unknown };
            if (typeof tracked.user_id === "string" && tracked.user_id) ids.add(tracked.user_id);
          }
        }
        const next = Array.from(ids);
        if (next.length === presentIdsRef.current.length) {
          const same = next.every((id, index) => presentIdsRef.current[index] === id);
          if (same) return;
        }
        presentIdsRef.current = next;
        setPresentUserIds(next);
        // A full room is the cue to open the duel right now.
        void sync();
      };

      channel.on("presence", { event: "sync" }, publish);
      channel.on("presence", { event: "join" }, publish);
      channel.on("presence", { event: "leave" }, publish);

      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Only now does the server treat an unfilled room as "not arrived"
        // rather than "not observable", so it waits for the real opponent.
        presenceLiveRef.current = true;
        void channel?.track({ user_id: userId, at: new Date().toISOString() });
        void sync();
      });
    })();

    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
      presentIdsRef.current = [];
      presenceLiveRef.current = false;
      setPresentUserIds([]);
    };
  }, [matchId, sync]);

  // Repaint the derived clock four times a second.
  useEffect(() => {
    const interval = window.setInterval(() => setTick((prev) => prev + 1), TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  const resolved = useMemo<MatchRoomState>(() => {
    const base = state ?? initial;
    // `tick` is a deliberate dependency: it re-derives the clock from the wall
    // clock instead of decrementing a counter.
    void tick;
    const nowMs = Date.now() + offsetRef.current;
    const phase = resolveMatchPhase({
      startedAt: base.startedAt,
      // A timed-out draw has no winner id but is still finished, so fold
      // completedAt into a truthy marker rather than losing the "over" phase.
      winnerId: base.completedAt ? (base.winnerId ?? "decided") : base.winnerId,
      nowMs,
    });
    return {
      ...base,
      phase,
      remainingSeconds: remainingMatchSeconds({
        startedAt: base.startedAt,
        timeLimitSeconds: base.timeLimitSeconds,
        nowMs,
      }),
      countdownSeconds: countdownSecondsRemaining(base.startedAt, nowMs),
    };
  }, [state, initial, tick]);

  const leaveRoom = useCallback(async () => {
    if (!matchId) return;
    try {
      await fetch(`/api/match/${matchId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abandon: true }),
        keepalive: true,
      });
    } catch {
      // ignore
    }
  }, [matchId]);

  return { room: resolved, connected, presentUserIds, sync, leaveRoom };
}
