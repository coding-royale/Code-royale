/**
 * Backend matchmaking, verified end to end.
 *
 * The old flow decided pairings inside `/api/matchmaking/join`'s 8-second
 * request loop, and `/status` only read. So when two players' join windows
 * missed each other, both sat queued and both timed out — matchable, never
 * matched. These checks pin the replacement: one atomic Postgres transaction
 * owns pairing, and either side's request can trigger it.
 *
 * Cases:
 *   1. simultaneous join   — both players, same instant, one room
 *   2. staggered join      — A waits, B arrives, A's /status pairs them
 *   3. solo queue          — one player never pairs with themselves, no dupes
 *   4. cancel              — leaving really removes the queue row
 *
 * Usage:
 *   bun scripts/stub-judge.mjs 3999
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/verify-matchmaking-backend.mjs
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
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  }
}
function note(text) {
  console.log(`      ${text}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const join = (who, body = {}) =>
  api("/api/matchmaking/join", who.token, {
    method: "POST",
    body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1", ...body }),
  });

const status = (who) => api("/api/matchmaking/status", who.token);

async function queueDepth(userId) {
  const { count } = await admin
    .from("matchmaking_queue")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

async function seatsOf(matchId) {
  const { data } = await admin.from("match_players").select("user_id, seat").eq("match_id", matchId);
  return data ?? [];
}

async function wipe(who) {
  const { data: seats } = await admin.from("match_players").select("match_id").eq("user_id", who);
  const ids = [...new Set((seats ?? []).map((s) => s.match_id))];
  if (ids.length) {
    await admin.from("match_attempts").delete().in("match_id", ids);
    await admin.from("match_players").delete().in("match_id", ids);
    await admin.from("matches").delete().in("id", ids);
  }
  await admin.from("matchmaking_queue").delete().eq("user_id", who);
}

/** Poll both players' /status until each has a match, or give up. */
async function converge(players, timeoutMs = 12_000) {
  const started = Date.now();
  const seen = new Map();
  while (Date.now() - started < timeoutMs) {
    const results = await Promise.all(players.map((p) => status(p).catch(() => ({ json: {} }))));
    results.forEach((r, i) => {
      if (r?.json?.matchId) seen.set(players[i].id, r.json.matchId);
    });
    if (players.every((p) => seen.has(p.id))) return seen;
    await sleep(500);
  }
  return seen;
}

const alpha = await tokenFor("duel.alpha@test.local");
const bravo = await tokenFor("duel.bravo@test.local");

/* ================================================================== *
 * 1. Simultaneous join.
 * ================================================================== */
console.log("\n=== 1. two players press Start at the same instant ===\n");
for (const p of [alpha, bravo]) await wipe(p.id);

const [joinA, joinB] = await Promise.all([join(alpha), join(bravo)]);
note(`alpha /join -> ${JSON.stringify(joinA.json)}`);
note(`bravo /join -> ${JSON.stringify(joinB.json)}`);

const immediate = joinA.json.matchId ?? joinB.json.matchId ?? null;
const seen = immediate ? new Map() : await converge([alpha, bravo]);
if (immediate) {
  seen.set(alpha.id, immediate);
  seen.set(bravo.id, immediate);
  // Give the second side a beat to be told the same thing.
  await sleep(700);
}

const matchIds = new Set([...seen.values()]);
const matchId1 = [...matchIds][0] ?? null;
check("both players are matched", Boolean(matchId1), true);
check("both players are matched to the SAME room", matchIds.size, 1);

if (matchId1) {
  const seats = await seatsOf(matchId1);
  const seatNums = seats.map((s) => s.seat).sort();
  check("exactly two seats", seats.length, 2);
  check("seats are 0 and 1", JSON.stringify(seatNums), JSON.stringify([0, 1]));
  check("alpha is seated", seats.some((s) => s.user_id === alpha.id), true);
  check("bravo is seated", seats.some((s) => s.user_id === bravo.id), true);
  check("the queue is drained for alpha", await queueDepth(alpha.id), 0);
  check("the queue is drained for bravo", await queueDepth(bravo.id), 0);

  const { data: row } = await admin
    .from("matches")
    .select("status, metadata")
    .eq("id", matchId1)
    .single();
  check("the room opens as pending, not already running", row?.status, "pending");
  check("the room has a question", typeof row?.metadata?.question_id, "string");
  check("the room has a time limit", row?.metadata?.time_limit, 300);
  note(`rooms seen: ${matchIds.size}, queue drained, clock not started`);
}

/* ================================================================== *
 * 2. Staggered join.
 *
 * This is the case the old design could not rescue: A's join request is
 * long gone by the time B arrives, so nothing was pairing. Now A polls
 * /status, and each poll runs a pairing pass.
 * ================================================================== */
console.log("\n=== 2. A waits alone, B arrives later ===\n");
for (const p of [alpha, bravo]) await wipe(p.id);

const lone = await join(alpha);
check("a lone player is not matched instantly", lone.json.matchId ?? null, null);
check("the lone player is queued exactly once", await queueDepth(alpha.id), 1);

// Repeated polling must not duplicate the queue row.
const early = await Promise.all([status(alpha), status(alpha), status(alpha)]);
check("polling alone finds no match", early.every((r) => !r.json.matchId), true);
check("polling does not duplicate the queue row", await queueDepth(alpha.id), 1);

await sleep(1_200);

const arrivedAt = Date.now();
const second = await join(bravo);
note(`bravo /join -> ${JSON.stringify(second.json)}`);
check("the arriving player is matched", typeof second.json.matchId, "string");

// A must learn about the same room from its own poll, not from B.
const alphaStatus = await status(alpha);
const latency = Date.now() - arrivedAt;
check("the waiting player sees the same room", alphaStatus.json.matchId, second.json.matchId);
note(`waiting player learned of it in ${latency}ms`);

const staggeredId = second.json.matchId;
if (staggeredId) {
  const seats = await seatsOf(staggeredId);
  check("staggered room has two seats", seats.length, 2);
  check("the queue is empty afterwards", (await queueDepth(alpha.id)) + (await queueDepth(bravo.id)), 0);
  check(
    "the player who waited longer gets seat 0",
    seats.find((s) => s.user_id === alpha.id)?.seat,
    0,
  );
}

/* ================================================================== *
 * 3. Solo queue never self-pairs.
 * ================================================================== */
console.log("\n=== 3. one player alone never matches themselves ===\n");
for (const p of [alpha, bravo]) await wipe(p.id);

await join(alpha);
let selfMatched = false;
for (let i = 0; i < 6; i++) {
  const r = await status(alpha);
  if (r.json.matchId) selfMatched = true;
  await sleep(250);
}
check("never paired with itself", selfMatched, false);
check("still exactly one queue row", await queueDepth(alpha.id), 1);

const { data: soloMatches } = await admin
  .from("match_players")
  .select("match_id")
  .eq("user_id", alpha.id);
check("no match was created", (soloMatches ?? []).length, 0);

/* ================================================================== *
 * 4. Cancel.
 * ================================================================== */
console.log("\n=== 4. leaving the queue ===\n");
const cancelled = await api("/api/matchmaking/cancel", alpha.token, { method: "POST" });
check("cancel succeeds", cancelled.status, 200);
check("the queue row is gone", await queueDepth(alpha.id), 0);

const afterCancel = await status(alpha);
check("a cancelled player is not matched", afterCancel.json.matchId ?? null, null);

/* --- tidy up --- */
for (const p of [alpha, bravo]) await wipe(p.id);
const { count: leftover } = await admin
  .from("matchmaking_queue")
  .select("user_id", { count: "exact", head: true })
  .in("user_id", [alpha.id, bravo.id]);
check("no bot rows left in the queue", leftover ?? 0, 0);

console.log(
  failures === 0
    ? "\nall checks passed — pairing is server-owned and atomic"
    : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
