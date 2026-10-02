/**
 * Resolves the caller of a match/matchmaking request from either a bearer
 * token or the browser session cookie.
 *
 * Why this exists: the routes used to "authenticate" a bearer token by
 * base64-decoding its payload and trusting `sub`:
 *
 *   const data = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
 *   return data.sub;
 *
 * That never checks the signature. Anyone who knew a user's uuid could mint
 * `{ alg: "none" }.{ sub: "<their uuid>" }.nonsense`, be accepted as that user,
 * stamp their seat in a match and start the duel clock. It was verified, not
 * theorised — see scripts/verify-auth.mjs.
 *
 * `auth.getUser(token)` asks the Supabase auth server to validate the
 * signature and expiry, so a forged token is simply invalid. The cookie path
 * already did this and is unchanged.
 */

import { createSupabaseServerClient } from "./supabase";
import { createSupabaseServiceClient } from "./supabase-service";

/**
 * Returns the authenticated user id, or null.
 *
 * A supplied bearer token is authoritative: if it is present but invalid we
 * do NOT silently fall through to the cookie, otherwise a bad token would
 * quietly authenticate somebody else.
 */
export async function resolveRequestUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    try {
      const admin = createSupabaseServiceClient();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data.user?.id) return data.user.id;
      return null;
    } catch {
      return null;
    }
  }

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data, error } = await supabaseAuth.auth.getUser();
    if (!error && data.user?.id) return data.user.id;
    return null;
  } catch {
    return null;
  }
}
