import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The auth state for a given session token does not change within a short
// window. Cache the middleware check so repeat requests skip the Supabase
// round trip.
const authCache = new Map<string, { ok: boolean; expiresAt: number }>();
const AUTH_CACHE_TTL_MS = 30_000;

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  // API routes authenticate on their own - do not duplicate the round trip.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  // Public pages without a session do not need auth.
  const sessionToken = request.cookies.get("sb-auth-token")?.value;
  if (!sessionToken) {
    return supabaseResponse;
  }

  const now = Date.now();
  const cached = authCache.get(sessionToken);
  if (cached && cached.expiresAt > now) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl.replace(/\/+$/, ""), supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  authCache.set(sessionToken, { ok: true, expiresAt: now + AUTH_CACHE_TTL_MS });

  // Prune stale entries so the map cannot grow without bound.
  if (authCache.size > 10_000) {
    for (const [key, entry] of authCache) {
      if (entry.expiresAt <= now) {
        authCache.delete(key);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};