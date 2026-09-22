import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * OAuth callback (PKCE flow).
 *
 * Supabase redirects here after Google / Microsoft / GitHub sign-in with
 * `?code=...&next=/home`. We exchange the code for a session and then
 * redirect to `next`.
 *
 * New OAuth users (public.users.onboarded = false, set by the
 * handle_new_user_profile trigger) are sent to /auth/complete-profile
 * first so they pick a unique username and a password. Existing
 * (grandfathered) accounts go straight to `next`.
 *
 * The session cookies MUST be attached to the redirect response itself.
 * Creating the server client with next/headers' cookie store is not enough
 * here — the Set-Cookie headers would never reach the browser, leaving the
 * user half-logged-in ("Auth session missing!" on settings/profile pages).
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

  // Collect cookies from the exchange so they can be attached to whichever
  // redirect we end up sending (onboarding gate below may change the target).
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  const supabase = createServerClient(
    supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies);
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base}/auth/auth-code-error`);
  }

  // Onboarding gate: brand-new OAuth users must pick a username + password.
  let destination = next;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: row } = await supabase
        .from("users")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();
      const onboarded = (row as { onboarded?: boolean | null } | null)?.onboarded === true;
      if (!onboarded) {
        destination = `/auth/complete-profile?next=${encodeURIComponent(next)}`;
      }
    }
  } catch {
    // If the gate check fails, fall through to `next` — the app shell
    // re-checks onboarding and will bounce to complete-profile if needed.
  }

  const redirectResponse = NextResponse.redirect(`${base}${destination}`);
  cookiesToSet.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options);
  });

  return redirectResponse;
}
