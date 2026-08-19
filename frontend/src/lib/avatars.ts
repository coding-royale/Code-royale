"use client";

import { supabase } from "./supabase-browser";

/**
 * Fetch avatar URLs for a set of user ids from player_stats.
 * Returns a map of userId -> avatarUrl (null when none).
 */
export async function fetchAvatarMap(ids: string[]): Promise<Record<string, string | null>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data } = await supabase
    .from("player_stats")
    .select("user_id,avatar_url")
    .in("user_id", uniqueIds);

  const map: Record<string, string | null> = {};
  for (const row of data ?? []) {
    map[row.user_id as string] = (row.avatar_url as string | null) || null;
  }
  return map;
}