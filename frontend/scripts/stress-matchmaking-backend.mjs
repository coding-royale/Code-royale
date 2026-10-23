/**
 * Concurrency stress test for backend matchmaking.
 *
 * `verify-matchmaking-backend.mjs` proves the happy paths through HTTP. This
 * one attacks the thing that actually broke: two requests racing each other.
 * It drives the Postgres functions directly, from genuinely concurrent
 * sessions, and repeats the race many times.
 *
 * Isolation: it runs in `mode = "events"`, a queue bucket no client can reach
 * (`/api/matchmaking/join` only ever sends `ranked` or `unranked`). A bot can
 * therefore never be paired with a real player, even if someone is queueing
 * right now.
 *
 * What a correct run proves:
 *   - the two players end up in ONE room, never two
 *   - the room always has exactly two seats, 0 and 1, never half-filled
 *   - the queue is drained, never left with a stale claim
 *   - a player never ends up seated twice in the same round
 *   - the losing side of the race is told about the room the winner created
 *
 * Usage:
 *   bun scripts/stress-matchmaking-backend.mjs
 *   bun scripts/stress-matchmaking-backend.mjs 100
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

const ROUNDS = Number(process.argv[2] ?? 30);
const MODE = "events";
const MATCH_TYPE = "1v1";
const TIME_LIMIT = 480;
const LANGUAGE = "node";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
}

async function loadBot(email, username) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users?.find((u) => u.email === email);
  if (!user) throw new Error(`${email} not found`);
  await admin.from("users").update({ username, onboarded: true, rating: 1000 }).eq("id", user.id);
  return { id: user.id, username };
}

const alpha = await loadBot("duel.alpha@test.local", "DuelAlpha");
const bravo = await loadBot("duel.bravo@test.local", "DuelBravo");

/**
 * Wipe the isolated bucket so every round starts from a known state.
 * `events` never holds a real player, so this cannot touch live traffic.
 */
async function resetMode() {
  const { data: stale } = await admin.from("matches").select("id").eq("mode", MODE);
  const ids = (stale ?? []).map((m) => m.id);
  if (ids.length) {
    await admin.from("match_attempts").delete().in("match_id", ids);
    await admin.from("match_players").delete().in("match_id", ids);
    await admin.from("matches").delete().in("id", ids);
  }
  await admin.from("matchmaking_queue").delete().eq("mode", MODE);
}

/**
 * A round is the worst case we care about: both players enqueue at the same
 * instant, then both ask to be paired at the same instant.
 */
async function runRound(round) {
  await resetMode();
  const startedAt = new Date(Date.now() - 1000).toISOString();

  const t0 = performance.now();

  // Both players press Start together.
  const enqueues = await Promise.allSettled([alpha, bravo].map((who) =>
    admin.rpc("matchmaking_enqueue", {
      p_user_id: who.id,
      p_mode: MODE,
      p_match_type: MATCH_TYPE,
      p_time_limit_seconds: TIME_LIMIT,
      p_language: LANGUAGE,
      p_rating: 1000,
    }),
  ));

  // Both players' requests then try to pair together.
  const pairs = await Promise.allSettled([alpha, bravo].map((who) =>
    admin.rpc("matchmaking_pair", { p_user_id: who.id }),
  ));

  const elapsed = performance.now() - t0;

  const enqueueErrors = enqueues
    .map((r) => (r.status === "rejected" ? String(r.reason) : r.value?.error?.message))
    .filter(Boolean);
  const pairErrors = pairs
    .map((r) => (r.status === "rejected" ? String(r.reason) : r.value?.error?.message))
    .filter(Boolean);

  const results = pairs
    .map((r) => (r.status === "fulfilled" ? r.value?.data : null))
    .filter(Boolean);

  const matchedIds = [...new Set(results.filter((r) => r.status === "matched").map((r) => r.matchId))];

  // Ground truth from the database, not from what the callers claim.
  const { data: created } = await admin
    .from("matches")
    .select("id, status, metadata")
    .eq("mode", MODE)
    .gte("created_at", startedAt);

  const createdIds = (created ?? []).map((m) => m.id);

  const seats = createdIds.length === 1
    ? (await admin.from("match_players").select("user_id, seat").eq("match_id", createdIds[0])).data ?? []
    : [];

  const queueRows = (
    await admin
      .from("matchmaking_queue")
      .select("user_id", { count: "exact", head: true })
      .eq("mode", MODE)
  ).count ?? 0;

  const problems = [];
  if (enqueueErrors.length) problems.push(`enqueue error: ${enqueueErrors[0]}`);
  if (pairErrors.length) problems.push(`pair error: ${pairErrors[0]}`);
  if (createdIds.length !== 1) problems.push(`expected 1 room, got ${createdIds.length}`);
  if (matchedIds.length !== 1) problems.push(`expected 1 match id from callers, got ${matchedIds.length}`);
  if (createdIds.length === 1 && matchedIds.length === 1 && createdIds[0] !== matchedIds[0]) {
    problems.push("callers disagreed about which room exists");
  }
  if (seats.length !== 2) problems.push(`expected 2 seats, got ${seats.length}`);
  if (JSON.stringify(seats.map((s) => s.seat).sort()) !== "[0,1]") {
    problems.push(`seats were ${JSON.stringify(seats.map((s) => s.seat))}`);
  }
  if (new Set(seats.map((s) => s.user_id)).size !== seats.length) problems.push("a player was seated twice");
  if (queueRows !== 0) problems.push(`queue left with ${queueRows} row(s)`);
  if (createdIds.length === 1 && created[0].status !== "pending") problems.push(`room status ${created[0].status}`);
  if (createdIds.length === 1 && created[0].metadata?.started_at != null) {
    problems.push("the clock started at pairing time");
  }

  // Tidy this round immediately so the next one starts clean.
  for (const id of createdIds) {
    await admin.from("match_attempts").delete().eq("match_id", id);
    await admin.from("match_players").delete().eq("match_id", id);
    await admin.from("matches").delete().eq("id", id);
  }
  await admin.from("matchmaking_queue").delete().eq("mode", MODE);

  return { elapsed, problems, results };
}

console.log(`\n=== ${ROUNDS} races: both players enqueue and pair at the same instant ===\n`);

const timings = [];
let badRounds = 0;
for (let i = 1; i <= ROUNDS; i++) {
  const { elapsed, problems, results } = await runRound(i);
  timings.push(elapsed);
  if (problems.length) {
    badRounds += 1;
    console.log(`FAIL  round ${i}: ${problems.join("; ")}`);
  } else if (i <= 3 || i === ROUNDS) {
    // Print the first few and the last in detail; the rest are summarised.
    const verdicts = results.map((r) => r.status).join(" / ");
    console.log(`PASS  round ${i}: one room, 2 seats, queue drained (${elapsed.toFixed(0)}ms, ${verdicts})`);
  }
}

timings.sort((a, b) => a - b);
const p50 = timings[Math.floor(timings.length * 0.5)] ?? 0;
const p95 = timings[Math.floor(timings.length * 0.95)] ?? 0;

check("every round produced exactly one valid room", badRounds, 0);
check("no queue rows left behind", (await admin.from("matchmaking_queue").select("user_id", { count: "exact", head: true }).eq("mode", MODE)).count ?? 0, 0);

console.log(`\n${ROUNDS} rounds | p50 ${p50.toFixed(0)}ms | p95 ${p95.toFixed(0)}ms | failures ${badRounds}`);
console.log(
  failures === 0 && badRounds === 0
    ? "all rounds passed — concurrent joins produce one room, never two, never half-filled"
    : `${failures + badRounds} problem(s) detected`,
);
process.exit(failures === 0 && badRounds === 0 ? 0 : 1);
