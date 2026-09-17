import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase";

/**
 * OAuth callback (PKCE flow).
 *
 * Supabase redirects here after Google / Microsoft / GitHub sign-in with
 * `?code=...&next=/home`. We exchange the code for a session (sets cookies)
 * and then redirect to `next`.
 *
 * Docs: https://supabase.com/docs/guides/auth/social-login/auth-azure
 * (same callback pattern applies to the Google provider).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/home";
  if (!next.startsWith("/")) {
    next = "/home";
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
