"use client";

/**
 * In-memory TTL cache for GET requests. Keeps the dashboard from hitting the
 * API (and Supabase) on every poll tick — only one fetch per TTL window.
 */
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export async function cachedFetch<T>(
  url: string,
  { ttlMs = 60_000 }: { ttlMs?: number } = {},
): Promise<T | null> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && hit.expiresAt > now) {
    return hit.data as T;
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    cache.set(url, { data, expiresAt: now + ttlMs });
    return data;
  } catch {
    return null;
  }
}

export function clearCachedFetch() {
  cache.clear();
}