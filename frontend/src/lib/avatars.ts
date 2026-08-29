"use client";

import { supabase } from "./supabase-browser";

/** Aggressive in-memory + sessionStorage cache for avatars */
const AVATAR_TTL_MS = 5 * 60 * 1000;
const avatarCache = new Map<string, { url: string | null; expiresAt: number }>();

function readSessionAvatarCache(userId: string): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(`avatar:${userId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { url: string | null; expiresAt: number };
    if (parsed.expiresAt > Date.now()) return parsed.url;
    sessionStorage.removeItem(`avatar:${userId}`);
  } catch {}
  return undefined;
}

function writeSessionAvatarCache(userId: string, url: string | null) {
  try {
    sessionStorage.setItem(`avatar:${userId}`, JSON.stringify({ url, expiresAt: Date.now() + AVATAR_TTL_MS }));
  } catch {}
}

/**
 * Fetch avatar URLs for a set of user ids from player_stats.
 * Returns a map of userId -> avatarUrl (null when none).
 * Aggressively cached (memory + sessionStorage, 5m TTL) and deduped.
 */
export async function fetchAvatarMap(ids: string[]): Promise<Record<string, string | null>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const now = Date.now();
  const uncached: string[] = [];
  const result: Record<string, string | null> = {};

  for (const id of uniqueIds) {
    const mem = avatarCache.get(id);
    if (mem && mem.expiresAt > now) {
      result[id] = mem.url;
      continue;
    }
    const sessionVal = readSessionAvatarCache(id);
    if (sessionVal !== undefined) {
      avatarCache.set(id, { url: sessionVal, expiresAt: now + AVATAR_TTL_MS });
      result[id] = sessionVal;
      continue;
    }
    uncached.push(id);
  }

  if (uncached.length === 0) return result;

  const { data } = await supabase
    .from("player_stats")
    .select("user_id,avatar_url")
    .in("user_id", uncached);

  const fetched = new Set<string>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    const url = (row.avatar_url as string | null) || null;
    avatarCache.set(uid, { url, expiresAt: now + AVATAR_TTL_MS });
    writeSessionAvatarCache(uid, url);
    result[uid] = url;
    fetched.add(uid);
  }
  // Cache miss = null (no avatar) so we don't refetch every time
  for (const id of uncached) {
    if (!fetched.has(id)) {
      avatarCache.set(id, { url: null, expiresAt: now + AVATAR_TTL_MS });
      writeSessionAvatarCache(id, null);
      result[id] = result[id] ?? null;
    }
  }
  return result;
}

/** Generate deterministic fallback avatar (DiceBear) when no stored avatar */
export function diceBearUrl(username: string, seed?: string) {
  const s = encodeURIComponent((seed ?? username).trim() || "player");
  return `https://api.dicebear.com/9.x/initials/svg?seed=${s}&backgroundType=gradientLinear&fontFamily=Helvetica`;
}

/** Drop the memory + sessionStorage cache so a fresh read reflects a change. */
export function clearAvatarCache(userIds: string[]): void {
  for (const id of userIds) {
    if (!id) continue;
    avatarCache.delete(id);
    try {
      sessionStorage.removeItem(`avatar:${id}`);
    } catch {}
  }
}

export function getAvatarUrl(
  userId: string,
  username: string,
  map: Record<string, string | null>,
): string | null {
  const stored = map[userId];
  if (stored) return stored;
  // Always return a DiceBear so the UI shows a pfp instead of just initials
  return diceBearUrl(username, userId);
}