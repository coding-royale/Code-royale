"use client";

export type CachedProfile = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  cachedAt: number;
};

const PROFILE_CACHE_KEY = "cr_profile_cache";
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Tiny external store so consuming components can subscribe to the cached
// identity and get it synchronously on the client (no flash, no setState-in-effect).
const profileListeners = new Set<() => void>();

function notifyProfileCache() {
  profileListeners.forEach((listener) => listener());
}

export function subscribeProfileCache(listener: () => void) {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

export function readCachedProfile(): CachedProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedProfile(profile: CachedProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
  notifyProfileCache();
}

export function clearCachedProfile() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
  notifyProfileCache();
}

export function isProfileCacheFresh(cached: CachedProfile): boolean {
  return Date.now() - cached.cachedAt < PROFILE_TTL_MS;
}

export function getFreshCachedProfile(): CachedProfile | null {
  const cached = readCachedProfile();
  return cached && isProfileCacheFresh(cached) ? cached : null;
}