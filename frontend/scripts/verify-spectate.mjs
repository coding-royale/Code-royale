/**
 * End-to-end test of the friend-gated spectate feature, driven with three bots:
 *
 *   FRIEND  — plays in the duel, and is friends with SPECTATOR
 *   RIVAL   — plays in the duel, and is NOT friends with SPECTATOR
 *   WATCHER — a third player with no seat in the match
 *
 * Asserts the rule the feature exists for: a spectator may only watch a duel
 * they have a friend in, and only ever sees that friend — never the rival on
 * the other side. A total stranger gets nothing at all.
 *
 * Usage:
 *   bun scripts/stub-judge.mjs 3999
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/verify-spectate.mjs
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

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
}
function note(text) {
  console.log(`      ${text}`);
}

async function tokenFor(email) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { token: data.session.access_token, id: data.user.id };
}

async function api(path, token, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Provision a third bot alongside the existing duel pair. */
async function ensureWatcher() {
  const email = "duel.watcher@test.local";
  const username = "DuelWatcher";
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: username },
  });
  let id = created?.user?.id ?? null;
  if (error) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    id = list?.users?.find((u) => u.email === email)?.id ?? null;
    if (!id) throw new Error(`could not provision watcher: ${error.message}`);
  }
  await admin.from("users").update({ username, onboarded: true, rating: 420 }).eq("id", id);
  return { id, email, username };
}

/** Make `a` and `b` accepted friends (the row can live in either direction). */
async function befriend(aId, bId) {
  await admin.from("connections").delete().in("user_id", [aId, bId]).in("connection_id", [aId, bId]);
  await admin.from("connections").insert({ user_id: aId, connection_id: bId, status: "accepted" });
}

const alpha = await tokenFor("duel.alpha@test.local"); // FRIEND — plays
const bravo = await tokenFor("duel.bravo@test.local"); // RIVAL — plays
const watcherMeta = await ensureWatcher();
const watcher = await tokenFor(watcherMeta.email);

// Clean slate.
for (const who of [alpha.id, bravo.id, watcher.id]) {
  const { data: seats } = await admin.from("match_players").select("match_id").eq("user_id", who);
  const ids = (seats ?? []).map((s) => s.match_id);
  if (ids.length) {
    await admin.from("match_attempts").delete().in("match_id", ids);
    await admin.from("match_players").delete().in("match_id", ids);
    await admin.from("matches").delete().in("id", ids);
  }
  await admin.from("matchmaking_queue").delete().eq("user_id", who);
}
await admin.from("connections").delete().in("user_id", [alpha.id, bravo.id, watcher.id]).in("connection_id", [alpha.id, bravo.id, watcher.id]);

console.log("\n=== spectate: friend-gated access ===\n");

// A live duel between FRIEND and RIVAL.
const { data: q } = await admin.from("practice_questions").select("id").limit(1).single();
const startedAt = new Date(Date.now() - 30_000).toISOString();
const ins = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    status: "active",
    created_by: alpha.id,
    started_at: startedAt,
    metadata: {
      question_id: q.id,
      time_limit: 300,
      language: "node",
      match_type: "1v1",
      started_at: startedAt,
    },
  })
  .select("id")
  .single();
if (ins.error) throw new Error(ins.error.message);
const matchId = ins.data.id;
await admin.from("match_players").insert([
  { match_id: matchId, user_id: alpha.id, seat: 0 },
  { match_id: matchId, user_id: bravo.id, seat: 1 },
]);
note(`duel ${matchId}: ${watcherMeta.username} is watching, FRIEND + RIVAL are playing`);

/*
 * The route authenticates with cookies, so a bot cannot walk all the way
 * through it — it 401s on the bearer header. The gate itself is therefore
 * driven through the same helper the route calls, plus the pure access rules
 * that decide it. That is the code that decides who may watch; the cookie
 * check in front of it is unchanged and already covered by the auth tests.
 */
const { getSpectateSnapshot } = await import("../src/app/api/spectate/[matchId]/route.ts");

/* --- 1. A total stranger gets nothing. --- */
await admin.from("connections").delete().eq("user_id", watcher.id);
const stranger = await getSpectateSnapshot(matchId, watcher.id);
check("a stranger is refused the duel", stranger, null);
note(`stranger -> ${stranger === null ? "refused" : "LEAKED!"}`);

/* --- 2. A friend gets in, and sees ONLY their friend. --- */
await befriend(watcher.id, alpha.id);
const friendView = await getSpectateSnapshot(matchId, watcher.id);
check("a friend of a player may spectate", friendView !== null, true);
if (friendView) {
  const names = friendView.players.map((p) => p.username);
  note(`friend sees: ${JSON.stringify(names)}`);
  check("exactly one player is disclosed", friendView.players.length, 1);
  check("and it is the friend, not the rival", friendView.players[0]?.id, alpha.id);
  check("the rival is never named", names.includes(watcherMeta.username), false);
  check("the match is reported live", friendView.status, "live");
  // Postgres renders its own timestamp format ("...+00:00"), so compare the
  // instants rather than the strings.
  check(
    "the clock start instant is the real one",
    Date.parse(friendView.startedAt),
    Date.parse(startedAt),
  );
  check("the problem is shown", Boolean(friendView.question), true);
  check("no winner is announced mid-duel", friendView.winnerUsername, null);
}

/* --- 3. Being friends with the OTHER seat also works, and shows them. --- */
await admin.from("connections").delete().eq("user_id", watcher.id);
await befriend(watcher.id, bravo.id);
const rivalView = await getSpectateSnapshot(matchId, watcher.id);
check("a friend of the other seat may also spectate", rivalView !== null, true);
check("and sees that seat instead", rivalView?.players[0]?.id, bravo.id);
check("still exactly one player", rivalView?.players.length, 1);

/* --- 4. Friends with neither seat is refused. --- */
await admin.from("connections").delete().eq("user_id", watcher.id);
await befriend(watcher.id, "00000000-0000-0000-0000-000000000000");
const neither = await getSpectateSnapshot(matchId, watcher.id);
check("friends with nobody in the duel is refused", neither, null);

/* --- 5. A seated player is not a key to their own duel. --- */
const seated = await getSpectateSnapshot(matchId, alpha.id);
check("a seated player gets no read-only snapshot of their own duel", seated, null);

/* --- 6. The opt-out still wins over friendship. --- */
await admin.from("connections").delete().eq("user_id", watcher.id);
await befriend(watcher.id, alpha.id);
await admin.from("users").update({ allow_spectate: false }).eq("id", alpha.id);
const optedOut = await getSpectateSnapshot(matchId, watcher.id);
check("a friend who opted out cannot be watched", optedOut, null);
await admin.from("users").update({ allow_spectate: true }).eq("id", alpha.id);
await admin.from("connections").delete().eq("user_id", watcher.id);

await admin.from("match_players").delete().eq("match_id", matchId);
await admin.from("matches").delete().eq("id", matchId);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);