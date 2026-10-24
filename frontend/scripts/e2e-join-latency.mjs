/**
 * End-to-end join latency, measured from each player's point of view.
 *
 * The DB concurrency test proves the room is created atomically. It does not
 * answer the question "how long does a player sit on the searching screen?".
 * This script does, by running two independent clients that behave exactly like
 * the browser:
 *
 *      POST /api/matchmaking/join
 *      then GET /api/matchmaking/status every 1000ms until a matchId appears
 *
 * Each client has its own Supabase session, so neither can see the other's
 * response. For every round it records:
 *
 *   - how long each /join took
 *   - when each client first learned the match id, from its own traffic
 *   - the gap between the two discoveries
 *   - whether both ids were the same room
 *
 * Two scenarios:
 *   simultaneous  both clients press Start together
 *   staggered     A starts first and waits alone for 2s, then B presses Start
 *
 * Safety: the live queue must contain no player other than the two bots before
 * every round, and the resulting room is checked to contain only bots. If a real
 * player ever appears, the run aborts rather than pairing with them.
 *
 * Usage:
 *   bun scripts/stub-judge.mjs 3999                     (optional)
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/e2e-join-latency.mjs 10
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

const ROUNDS = Number(process.argv[2] ?? 10);
const base = process.env.DUEL_BASE_URL || "http://localhost:3100";
const password = "TestPass123!";
const POLL_MS = 500; // must match game-modes/page.tsx
const TIMEOUT_MS = 30_000;

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tokenFor(email) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { token: data.session.access_token, id: data.user.id, email };
}

const alpha = await tokenFor("duel.alpha@test.local");
const bravo = await tokenFor("duel.bravo@test.local");
const BOT_IDS = new Set([alpha.id, bravo.id]);

async function wipe(who) {
  const { data: seats } = await admin.from("match_players").select("match_id").eq("user_id", who.id);
  const ids = [...new Set((seats ?? []).map((s) => s.match_id))];
  if (ids.length) {
    await admin.from("match_attempts").delete().in("match_id", ids);
    await admin.from("match_players").delete().in("match_id", ids);
    await admin.from("matches").delete().in("id", ids);
  }
  await admin.from("matchmaking_queue").delete().eq("user_id", who.id);
}

async function foreignQueueRows() {
  const { data } = await admin.from("matchmaking_queue").select("user_id");
  return (data ?? []).filter((r) => !BOT_IDS.has(r.user_id));
}

async function post(path, who, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${who.token}` },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function get(path, who) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${who.token}` },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

/**
 * One browser. Returns the wall-clock instant it learned the match id, measured
 * purely from its own request/response traffic.
 */
async function browser(who, startedAt) {
  const joinStart = performance.now();
  const join = await post("/api/matchmaking/join", who, {
    mode: "ranked",
    timeLimitSeconds: 300,
    matchType: "1v1",
    language: "node",
  });
  const joinMs = performance.now() - joinStart;
  const joinAt = performance.now();

  if (join.json.matchId) {
    return { who, matchId: join.json.matchId, joinMs, discoveredAt: joinAt, polls: 0, viaJoin: true };
  }

  let polls = 0;
  // The real client asks immediately after /join, then every POLL_MS.
  while (true) {
    polls += 1;
    const status = await get("/api/matchmaking/status", who);
    if (status.json.matchId) {
      return {
        who,
        matchId: status.json.matchId,
        joinMs,
        discoveredAt: performance.now(),
        polls,
        viaJoin: false,
      };
    }
    if (performance.now() - startedAt >= TIMEOUT_MS) break;
    await sleep(POLL_MS);
  }

  return { who, matchId: null, joinMs, discoveredAt: null, polls, viaJoin: false };
}

async function runRound(label) {
  await wipe(alpha);
  await wipe(bravo);

  const foreign = await foreignQueueRows();
  if (foreign.length) {
    console.log(`\nABORT: ${foreign.length} real player(s) are in the live queue. Not pairing bots with them.`);
    process.exit(2);
  }

  const t0 = performance.now();
  const [a, b] = await Promise.all([browser(alpha, t0), browser(bravo, t0)]);
  const wall = performance.now() - t0;

  if (!a.matchId || !b.matchId) {
    return { ok: false, reason: "one client never saw a match", a, b };
  }

  const sameRoom = a.matchId === b.matchId;
  const gap = Math.abs(a.discoveredAt - b.discoveredAt);

  const seats = (await admin.from("match_players").select("user_id, seat").eq("match_id", a.matchId)).data ?? [];
  const onlyBots = seats.every((s) => BOT_IDS.has(s.user_id));
  if (!onlyBots) {
    console.log(`\nABORT: room ${a.matchId} contains a non-bot player. Cleaning up immediately.`);
    await admin.from("match_attempts").delete().eq("match_id", a.matchId);
    await admin.from("match_players").delete().eq("match_id", a.matchId);
    await admin.from("matches").delete().eq("id", a.matchId);
    process.exit(2);
  }

  await admin.from("match_attempts").delete().eq("match_id", a.matchId);
  await admin.from("match_players").delete().eq("match_id", a.matchId);
  await admin.from("matches").delete().eq("id", a.matchId);

  return {
    ok: sameRoom && seats.length === 2,
    sameRoom,
    seats: seats.length,
    gap,
    wall,
    a,
    b,
    label,
  };
}

/* ------------------------------------------------------------------ *
 * Scenario 1: both clients press Start together.
 * ------------------------------------------------------------------ */
console.log(`\n=== simultaneous: both clients POST /join at the same instant (${ROUNDS} rounds) ===\n`);

const simGap = [];
const simJoin = [];
for (let i = 1; i <= ROUNDS; i++) {
  const r = await runRound("sim");
  if (!r.ok) {
    check(`round ${i}: one room, two seats`, `${r.reason ?? "mismatch"}`, "ok");
    continue;
  }
  simGap.push(r.gap);
  simJoin.push(Math.max(r.a.joinMs, r.b.joinMs));

  const bothViaJoin = r.a.viaJoin && r.b.viaJoin;
  if (i <= 5) {
    console.log(
      `round ${i}: same room=${r.sameRoom} seats=${r.seats} ` +
        `join ${r.a.joinMs.toFixed(0)}/${r.b.joinMs.toFixed(0)}ms ` +
        `discovery gap ${r.gap.toFixed(0)}ms ` +
        `(A via ${r.a.viaJoin ? "/join" : `${r.a.polls} polls`}, B via ${r.b.viaJoin ? "/join" : `${r.b.polls} polls`})`,
    );
  }
  if (!bothViaJoin) {
    console.log(`        note: one side needed polls (A ${r.a.viaJoin ? "join" : `${r.a.polls} polls`}, B ${r.b.viaJoin ? "join" : `${r.b.polls} polls`})`);
  }
}

/* ------------------------------------------------------------------ *
 * Scenario 2: A is already waiting when B presses Start.
 * ------------------------------------------------------------------ */
console.log(`\n=== staggered: A starts, waits 2s alone, then B starts (${ROUNDS} rounds) ===\n`);

const stagGap = [];
for (let i = 1; i <= ROUNDS; i++) {
  await wipe(alpha);
  await wipe(bravo);
  const foreign = await foreignQueueRows();
  if (foreign.length) {
    console.log(`\nABORT: ${foreign.length} real player(s) appeared in the live queue.`);
    process.exit(2);
  }

  const aPromise = browser(alpha, performance.now());
  await sleep(2_000);
  const bPromise = browser(bravo, performance.now());

  const [a, b] = await Promise.all([aPromise, bPromise]);

  if (!a.matchId || !b.matchId || a.matchId !== b.matchId) {
    check(`round ${i}: both matched to one room`, `${a.matchId} vs ${b.matchId}`, "same");
    continue;
  }

  const seats = (await admin.from("match_players").select("user_id").eq("match_id", a.matchId)).data ?? [];
  if (!seats.every((s) => BOT_IDS.has(s.user_id))) {
    console.log(`\nABORT: non-bot seat in ${a.matchId}`);
    process.exit(2);
  }

  const gap = Math.abs(a.discoveredAt - b.discoveredAt);
  stagGap.push(gap);

  if (i <= 5) {
    console.log(
      `round ${i}: same room=true seats=${seats.length} ` +
        `A learned after ${a.polls} poll(s), B via ${b.viaJoin ? "/join" : `${b.polls} polls`}, ` +
        `gap ${(gap / 1000).toFixed(2)}s`,
    );
  }

  await admin.from("match_attempts").delete().eq("match_id", a.matchId);
  await admin.from("match_players").delete().eq("match_id", a.matchId);
  await admin.from("matches").delete().eq("id", a.matchId);
}

function stats(label, values) {
  if (!values.length) return `${label}: no samples`;
  const sorted = [...values].sort((x, y) => x - y);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return `${label}: p50 ${at(0.5).toFixed(0)}ms | p95 ${at(0.95).toFixed(0)}ms | max ${sorted[sorted.length - 1].toFixed(0)}ms`;
}

console.log("\n=== results ===");
console.log(stats("simultaneous  /join response", simJoin));
console.log(stats("simultaneous  discovery gap ", simGap));
console.log(stats("staggered     discovery gap ", stagGap));
console.log("\nThe discovery gap is how long after one player the other player's screen");
console.log("learned about the room. Their clock has not started either way.");

for (const p of [alpha, bravo]) await wipe(p);
const leftoverQueue = (await admin.from("matchmaking_queue").select("user_id")).data ?? [];
check("no queue rows left behind", leftoverQueue.length, 0);

console.log(failures === 0 ? "\nall rounds matched into one room" : `\n${failures} round(s) failed`);
process.exit(failures === 0 ? 0 : 1);
