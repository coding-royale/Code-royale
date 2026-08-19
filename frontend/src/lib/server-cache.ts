// In-memory TTL cache for server-side data (per Node instance). Prevents the
// most-polled API routes from hitting Postgres/Supabase on every request.
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export async function serverCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.data as T;
  }

  const data = await loader();
  cache.set(key, { data, expiresAt: now + ttlMs });

  // Bound the cache size by dropping stale entries.
  if (cache.size > 5_000) {
    for (const [k, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(k);
    }
  }

  return data;
}

export function clearServerCache(prefix = "") {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}