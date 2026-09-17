import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * OAuth callback (PKCE flow).
 *
 * Supabase redirects here after Google / Microsoft / GitHub sign-in with
 * `?code=...&next=/home`. We exchange the code for a session and then
 * redirect to `next`.
 *
 * The session cookies MUST be attached to the redirect response itself
 * (via setAll below). Creating the server client with next/headers'
 * cookie store is not enough here — the Set-Cookie headers would never
 * reach the browser, leaving the user half-logged-in ("Auth session
 * missing!" on settings/profile pages).
 *
 * Docs: https://supabase.com/docs/guides/auth/social-login/auth-azure
 * (same callback pattern applies to the Google provider).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/home";
  if (!next.startsWith("/")) {
    next = "/home";
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const base = isLocalEnv
    ? origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : origin;

  if (!code) {
    return NextResponse.redirect(`${base}/auth/auth-code-error`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${base}/auth/auth-code-error`);
  }

  // Build the redirect response first so the session cookies produced by
  // exchangeCodeForSession can be written onto it.
  const redirectResponse = NextResponse.redirect(`${base}${next}`);

  const supabase = createServerClient(
    supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base}/auth/auth-code-error`);
  }

  return redirectResponse;
}
