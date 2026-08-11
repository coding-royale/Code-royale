/**
 * Shared helpers for OAuth sign-in.
 *
 * The auth pages (login and signup) use these helpers so that the
 * redirect target and the error handling stay consistent.
 */

/**
 * Build the URL that Supabase sends the user to after a successful OAuth
 * sign-in. It uses NEXT_PUBLIC_SITE_URL when configured. In the browser it
 * falls back to the current origin.
 */
export const getOAuthRedirectTo = () => {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteOrigin = configuredSiteUrl
    ? configuredSiteUrl.replace(/\/$/, "")
    : typeof window !== "undefined"
      ? window.location.origin
      : undefined;

  return siteOrigin ? `${siteOrigin}/home` : undefined;
};

/**
 * Turn a raw OAuth error message into a message the user can act on.
 * It detects a provider that is not enabled in Supabase and network
 * failures. Other errors pass through unchanged.
 */
export const formatOAuthError = (message: string, providerName: string): string => {
  const normalized = message.toLowerCase();

  if (normalized.includes("failed to fetch")) {
    return "Cannot reach Supabase (network/CORS). Verify NEXT_PUBLIC_SUPABASE_URL is correct/https, and that your Supabase project is reachable.";
  }

  if (
    normalized.includes("not enabled") ||
    normalized.includes("not configured") ||
    normalized.includes("unsupported provider") ||
    normalized.includes("is not enabled")
  ) {
    return `${providerName} sign-in is not configured yet. Enable the ${providerName} provider in the Supabase dashboard (Authentication > Sign In / Providers).`;
  }

  return message;
};