/**
 * Proves (or disproves) whether the `Authorization: Bearer` shortcut on the
 * match API actually authenticates the caller.
 *
 * The routes decode a JWT payload with a plain base64 decode and trust `sub`:
 *
 *   const payload = token.split(".")[1];
 *   const data = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
 *   return data.sub;
 *
 * No signature is verified, so a hand-written token should be enough to act as
 * any user whose uuid is known. This script signs NOTHING and simply asserts it
 * can (or cannot) drive a match as the victim.
 *
 * Usage: bun scripts/verify-auth.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const raw of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const base = process.env.DUEL_BASE_URL || "http://localhost:3100";
const password = "TestPass123!";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function tokenFor(email) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { token: data.session.access_token, id: data.user.id };
}

/** A token nobody signed: valid shape, forged payload, bogus signature. */
function forgeToken(subject) {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return [
    b64({ alg: "none", typ: "JWT" }),
    b64({ sub: subject, role: "authenticated", exp: 9999999999 }),
    "not-a-real-signature",
  ].join(".");
}

async function api(path, token, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const alpha = await tokenFor("duel.alpha@test.local");
const bravo = await tokenFor("duel.bravo@test.local");

// Clean slate for the two bots.
for (const who of [alpha, bravo]) {
  const { data: seats } = await admin.from("match_players").select("match_id").eq("user_id", who.id);
  const ids = (seats ?? []).map((s) => s.match_id);
  if (ids.length) {
    await admin.from("match_attempts").delete().in("match_id", ids);
    await admin.from("match_players").delete().in("match_id", ids);
    await admin.from("matches").delete().in("id", ids);
  }
  await admin.from("matchmaking_queue").delete().eq("user_id", who.id);
}

console.log("\n=== is the Bearer token actually verified? ===\n");

// A pending lobby with both bots seated.
const { data: q } = await admin.from("practice_questions").select("id").limit(1).single();
const ins = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    status: "pending",
    created_by: alpha.id,
    metadata: {
      question_id: q.id,
      time_limit: 300,
      language: "node",
      match_type: "1v1",
      started_at: null,
    },
  })
  .select("id")
  .single();
const matchId = ins.data.id;
await admin.from("match_players").insert([
  { match_id: matchId, user_id: alpha.id, seat: 0 },
  { match_id: matchId, user_id: bravo.id, seat: 1 },
]);

const forgedAsAlpha = forgeToken(alpha.id);
console.log(`forged token for alpha: ${forgedAsAlpha.slice(0, 90)}...`);
console.log(`(real alpha token:     ${alpha.token.slice(0, 90)}...)\n`);

/*
 * The test: a FORGED token claiming to be alpha must not be able to do
 * anything alpha's real token can do. If it can, the Bearer path is an
 * unauthenticated impersonation hole.
 */
const forgedSync = await api(`/api/match/${matchId}/sync`, forgedAsAlpha, {
  method: "POST",
  body: JSON.stringify({ presentUserIds: [alpha.id, bravo.id] }),
});
console.log(`sync with forged alpha token -> ${forgedSync.status}`);
console.log(`  body: ${JSON.stringify(forgedSync.json).slice(0, 200)}\n`);

const { data: alphaSeat } = await admin
  .from("match_players")
  .select("present_at")
  .eq("match_id", matchId)
  .eq("user_id", alpha.id)
  .single();

console.log("--- verdict ---");
if (forgedSync.status === 200 && forgedSync.json?.matchId) {
  console.log("VULNERABLE: an unsigned token was accepted as a seated player.");
  console.log("Anyone who knows a user's uuid can act as them in a match.");
} else {
  console.log("SAFE: the forged token was rejected.");
}
console.log(
  `alpha's seat stamped by the forged call: ${alphaSeat?.present_at ? "YES (impersonation worked)" : "no"}`,
);

// Clean up.
await admin.from("match_players").delete().eq("match_id", matchId);
await admin.from("matches").delete().eq("id", matchId);
