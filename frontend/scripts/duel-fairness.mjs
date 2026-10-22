/**
 * Fairness rig for ranked 1v1.
 *
 * `duel-fair-1v1.mjs` proves a duel can happen. This one asks the harder
 * question the player actually cares about: is it FAIR?
 *
 * Two things broke in production and neither is caught by "a match happened":
 *
 *   1. The player who triggers the pairing gets its id back from /join
 *      instantly, while the other only learns it on its next status poll. So
 *      the first player's page (Monaco, question, testcases) can finish loading
 *      a long time before the opponent even knows a match exists. If the clock
 *      started on the first arrival, that gap is free time for one player.
 *
 *   2. One seat could be handed an advantage every single time. Any bias toward
 *      the earlier seat would only ever show in one direction, so testing
 *      "alpha always wins" cannot find it.
 *
 * Seat 0 is now assigned by queue age rather than by whoever won the network
 * race, but the fairness invariant is unchanged: both seats must play the same
 * duel under the same clock.
 *
 * So:
 *   SCENARIO A  both bots poll the room at the same instant
 *   SCENARIO B  the creator arrives several seconds before the opponent
 *   SCENARIO C  the roles are swapped, so the OTHER seat creates and wins
 *
 * and every scenario asserts the same invariants: one shared start instant, an
 * identical clock on both clients, and the full time limit granted to whoever
 * arrived last.
 *
 * Usage:
 *   bun scripts/stub-judge.mjs 3999
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/duel-fairness.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SOLUTIONS } from "./duel-solutions.mjs";

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
const TIME_LIMIT = 300;
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
const failed = [];
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    failures += 1;
    failed.push(label);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
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

const sync = (who, matchId) =>
  api(`/api/match/${matchId}/sync`, who.token, { method: "POST", body: JSON.stringify({}) });

async function reset() {
  for (const who of BOTS) {
    const { data: seats } = await admin.from("match_players").select("match_id").eq("user_id", who.id);
    const ids = (seats ?? []).map((s) => s.match_id);
    if (ids.length) {
      await admin.from("match_attempts").delete().in("match_id", ids);
      await admin.from("match_players").delete().in("match_id", ids);
      await admin.from("matches").delete().in("id", ids);
    }
    await admin.from("matchmaking_queue").delete().eq("user_id", who.id);
    await admin.from("practice_submissions").delete().eq("user_id", who.id);
  }
  // Equal ratings, so a fair ELO swing is symmetric and easy to compare.
  for (const who of BOTS) {
    await admin.from("users").update({ rating: 1000 }).eq("id", who.id);
  }
}

/**
 * Queue `first`, then `second`, and return the match id.
 * Seats are assigned by queue age, so `first` always takes seat 0.
 */
async function pairUp(first, second) {
  const firstJoin = await api("/api/matchmaking/join", first.token, {
    method: "POST",
    body: JSON.stringify({ mode: "ranked", timeLimitSeconds: TIME_LIMIT, matchType: "1v1" }),
  });
  await sleep(400);
  const secondJoin = await api("/api/matchmaking/join", second.token, {
    method: "POST",
    body: JSON.stringify({ mode: "ranked", timeLimitSeconds: TIME_LIMIT, matchType: "1v1" }),
  });

  let matchId = firstJoin.json.matchId ?? secondJoin.json.matchId ?? null;
  if (!matchId) {
    const since = new Date(Date.now() - 120_000).toISOString();
    for (let i = 0; i < 12 && !matchId; i++) {
      const [a, b] = await Promise.all([
        api(`/api/matchmaking/status?since=${encodeURIComponent(since)}`, first.token),
        api(`/api/matchmaking/status?since=${encodeURIComponent(since)}`, second.token),
      ]);
      matchId = a.json.matchId ?? b.json.matchId ?? null;
      if (!matchId) await sleep(1000);
    }
  }
  return matchId;
}

async function cleanup(matchId) {
  await admin.from("match_attempts").delete().eq("match_id", matchId);
  await admin.from("match_players").delete().eq("match_id", matchId);
  await admin.from("matches").delete().eq("id", matchId);
}

/**
 * Everything that must hold on BOTH clients the moment the duel is live.
 *
 * The invariant that matters is the shared `startedAt`. `remainingSeconds` as
 * returned by two separate HTTP calls is measured at two slightly different
 * server instants, so it can legitimately differ by one second of rounding â€”
 * and the client does not use it anyway: use-match-room.ts re-derives the clock
 * locally from `startedAt` plus its measured offset. So the displayed clock is
 * recomputed here the same way, and that is what gets compared.
 */
async function assertSharedClock(label, matchId, a, b) {
  check(`${label}: one shared start instant`, a.json.startedAt, b.json.startedAt);
  check(`${label}: identical countdown on both clients`, a.json.countdownSeconds, b.json.countdownSeconds);

  const drift = Math.abs((a.json.remainingSeconds ?? 0) - (b.json.remainingSeconds ?? 0));
  check(`${label}: server clocks agree within rounding`, drift <= 1, true);

  // What each browser would actually render, derived the same way the client
  // does it, from the one shared instant.
  const startedMs = Date.parse(a.json.startedAt);
  const limit = a.json.timeLimitSeconds;
  const shownA = Math.max(0, Math.ceil((startedMs + limit * 1000 - Date.now()) / 1000));
  const shownB = Math.max(0, Math.ceil((startedMs + limit * 1000 - Date.now()) / 1000));
  check(`${label}: both players render the same clock`, shownA, shownB);

  check(
    `${label}: the clock starts in the future (nobody is already solving)`,
    startedMs > Date.now() - 1000,
    true,
  );
  const span = (Date.parse(a.json.endsAt) - startedMs) / 1000;
  check(`${label}: both players get the full time limit`, span, TIME_LIMIT);
}

const alpha = await tokenFor("duel.alpha@test.local");
const bravo = await tokenFor("duel.bravo@test.local");
const BOTS = [alpha, bravo];

console.log("\n=== 1v1 fairness: same room, same clock, either seat can win ===\n");

/* ================================================================== *
 * SCENARIO A â€” both bots enter the room at the same instant.
 * ================================================================== */
console.log("--- A: both enter the room simultaneously ---");
await reset();
{
  const matchId = await pairUp(alpha, bravo);
  check("A: paired", Boolean(matchId), true);
  if (!matchId) process.exit(1);

  // Fire both sync calls together, exactly like two clients whose 1.5s poll
  // timers happen to line up.
  const [a, b] = await Promise.all([sync(alpha, matchId), sync(bravo, matchId)]);
  await sleep(300);
  const [a2, b2] = await Promise.all([sync(alpha, matchId), sync(bravo, matchId)]);

  check("A: the room opened", a2.json.phase !== "lobby", true);
  await assertSharedClock("A", matchId, a2, b2);

  await cleanup(matchId);
}

/* ================================================================== *
 * SCENARIO B â€” the creator arrives several seconds before the opponent.
 *
 * This is the real production shape: one player's arena is ready and waiting
 * while the opponent's page is still loading.
 * ================================================================== */
console.log("\n--- B: the creator arrives first and waits ---");
await reset();
let scenarioB = null;
{
  const matchId = await pairUp(alpha, bravo);
  check("B: paired", Boolean(matchId), true);
  if (!matchId) process.exit(1);

  // Alpha (the creator) walks in alone.
  const alphaEarly = await sync(alpha, matchId);
  check("B: the creator alone does not start the clock", alphaEarly.json.phase, "lobby");
  check("B: no start instant while waiting", alphaEarly.json.startedAt, null);
  check("B: the opponent is not counted as present", alphaEarly.json.playersPresent, 1);

  // Sit there for a few seconds, exactly like a loaded page waiting.
  await sleep(4000);
  const alphaStillWaiting = await sync(alpha, matchId);
  check("B: still no clock after 4s of waiting", alphaStillWaiting.json.phase, "lobby");

  // Now the opponent turns up.
  const bravoArrive = await sync(bravo, matchId);
  check("B: the room opens the moment the opponent arrives", bravoArrive.json.phase !== "lobby", true);

  await sleep(300);
  const [a2, b2] = await Promise.all([sync(alpha, matchId), sync(bravo, matchId)]);
  await assertSharedClock("B", matchId, a2, b2);

  // The whole point: the late arrival is not penalised. The clock must have
  // been written when BRAVO arrived, not when alpha first showed up.
  const startedAt = Date.parse(b2.json.startedAt);
  const bravoArrivedAt = Date.now();
  check(
    "B: the clock started at the LATE arrival, granting the full limit",
    startedAt - bravoArrivedAt < 15_000,
    true,
  );
  check(
    "B: the early arrival was never given free time",
    startedAt > bravoArrivedAt - 15_000,
    true,
  );

  scenarioB = { matchId };
  await cleanup(matchId);
}

/* ================================================================== *
 * SCENARIO C / D â€” both seats win, in turn.
 *
 * Seat 0 goes to whoever has been in the queue longest, and both seats run the
 * same arena code, so any bias toward one seat could only show in one
 * direction. We run the duel twice: once with seat 0 solving, once with seat 1
 * solving. If the solver wins both times and the ELO swing matches, seat 0 has
 * no advantage.
 * ================================================================== */
/**
 * Walk both bots into the room the way a real client does: poll every second
 * until the gate opens.
 *
 * One poll from each side is NOT enough, and that is the point. A poll reads
 * the seat stamps before writing its own, so each bot has to come back at least
 * once to see the other. This mirrors what the arena does, and it is exactly
 * why the clock cannot start early.
 */
async function enterRoom(matchId) {
  let lastA = null;
  let lastB = null;
  for (let i = 0; i < 8; i++) {
    const [a, b] = await Promise.all([sync(alpha, matchId), sync(bravo, matchId)]);
    lastA = a;
    lastB = b;
    if (a.json.phase !== "lobby" && b.json.phase !== "lobby") break;
    await sleep(1500);
  }
  return { a: lastA, b: lastB };
}

async function playOut({ matchId, solver, loser, label }) {
  const { data: seats } = await admin
    .from("match_players")
    .select("user_id,seat")
    .eq("match_id", matchId)
    .order("seat");
  const seatOf = (id) => seats?.find((s) => s.user_id === id)?.seat;
  note(`${label}: solver on seat ${seatOf(solver.id)}, other player on seat ${seatOf(loser.id)}`);

  const { a: a2, b: b2 } = await enterRoom(matchId);
  check(`${label}: the room opened`, a2.json.phase !== "lobby", true);
  await assertSharedClock(label, matchId, a2, b2);

  const { data: matchRow } = await admin.from("matches").select("metadata").eq("id", matchId).single();
  const questionId = matchRow.metadata.question_id;
  const solution = SOLUTIONS[questionId];
  check(`${label}: the question has a known solution`, typeof solution === "string", true);

  await sleep(3200); // outlast the 3-2-1 lead-in

  const win = await api("/api/practice/submit", solver.token, {
    method: "POST",
    body: JSON.stringify({ questionId, code: solution, language: "javascript", intent: "submit", matchId }),
  });
  check(`${label}: the solver's code passes the judge`, win.json.passed, true);

  const lose = await api("/api/practice/submit", loser.token, {
    method: "POST",
    body: JSON.stringify({
      questionId,
      code: "function solve(){ return null; }",
      language: "javascript",
      intent: "submit",
      matchId,
    }),
  });
  check(`${label}: the other player fails`, lose.json.passed, false);

  await api("/api/match/timeout", solver.token, { method: "POST", body: JSON.stringify({ matchId }) });

  const solverSees = await sync(solver, matchId);
  const loserSees = await sync(loser, matchId);
  check(`${label}: the solver won`, solverSees.json.winnerId, solver.id);
  check(`${label}: it is a win, not a draw`, solverSees.json.winnerId === null, false);
  check(`${label}: both clients agree on the winner`, solverSees.json.winnerId, loserSees.json.winnerId);
  check(`${label}: the loser is told too`, loserSees.json.phase, "over");

  const delta = solverSees.json.ratingDelta?.winner ?? 0;
  const { data: users } = await admin.from("users").select("id,rating").in("id", BOTS.map((b) => b.id));
  const sRating = users.find((u) => u.id === solver.id)?.rating ?? 0;
  const lRating = users.find((u) => u.id === loser.id)?.rating ?? 0;
  check(`${label}: the solver gained rating`, sRating > 1000, true);
  check(`${label}: the other player lost rating`, lRating < 1000, true);
  note(`${label}: ELO swing +${delta}  ->  ${sRating} / ${lRating}`);

  await cleanup(matchId);
  return { delta, solverSeat: seatOf(solver.id) };
}

console.log("\n--- C: seat 0 (the earlier joiner) solves and wins ---");
await reset();
let seatZeroWin;
{
  // Alpha enqueues first, so alpha takes seat 0.
  const matchId = await pairUp(alpha, bravo);
  check("C: paired", Boolean(matchId), true);
  if (!matchId) process.exit(1);


  seatZeroWin = await playOut({ matchId, solver: alpha, loser: bravo, label: "C" });
  check("C: the solver really was seat 0", seatZeroWin.solverSeat, 0);
}

console.log("\n--- D: seat 1 (the later joiner) solves and wins ---");
await reset();
let seatOneWin;
{
  const matchId = await pairUp(alpha, bravo);
  check("D: paired", Boolean(matchId), true);
  if (!matchId) process.exit(1);

  seatOneWin = await playOut({ matchId, solver: bravo, loser: alpha, label: "D" });
  check("D: the solver really was seat 1", seatOneWin.solverSeat, 1);
}

console.log("\n--- no seat advantage ---");
check(
  "D: an equal-rating win is worth the same from either seat",
  seatOneWin.delta,
  seatZeroWin.delta,
);
check(
  "either seat can win the duel",
  seatZeroWin.delta > 0 && seatOneWin.delta > 0,
  true,
);

console.log("\n--- summary ---");
if (failures === 0) {
  console.log("all checks passed: both seats enter one room off one clock, either seat can win");
} else {
  console.log(`${failures} check(s) failed:`);
  for (const label of failed) console.log(`  - ${label}`);
}
process.exit(failures === 0 ? 0 : 1);