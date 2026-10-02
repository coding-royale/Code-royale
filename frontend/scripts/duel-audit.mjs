/**
 * Audit harness for the ranked win path, driven from BOTH seats.
 *
 * Every check here is about fairness between the two players in a 1v1:
 *   - can a seated player claim a win they never earned?
 *   - can a player keep submitting after the clock has run out?
 *   - do both players see the same room, clock and result?
 *
 * Run against a server started with the stub judge:
 *   bun scripts/stub-judge.mjs 3999
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/duel-audit.mjs
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
  return ok;
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const ALPHA = "duel.alpha@test.local";
const BRAVO = "duel.bravo@test.local";

async function wipe(who) {
  const { data: seats } = await admin.from("match_players").select("match_id").eq("user_id", who);
  const ids = (seats ?? []).map((s) => s.match_id);
  if (ids.length) {
    await admin.from("match_attempts").delete().in("match_id", ids);
    await admin.from("match_players").delete().in("match_id", ids);
    await admin.from("matches").delete().in("id", ids);
  }
  await admin.from("matchmaking_queue").delete().eq("user_id", who);
  await admin.from("practice_submissions").delete().eq("user_id", who);
}

/** A question that definitely carries inline testcases we know a solution for. */
async function pickQuestion() {
  const { data } = await admin.from("practice_questions").select("id,testcases");
  const usable = (data ?? []).find(
    (q) => Array.isArray(q.testcases) && q.testcases.length > 0 && SOLUTIONS[q.id],
  );
  if (!usable) throw new Error("no question with testcases and a known solution");
  return usable;
}

/** Build a live pending lobby with both bots seated, no clock started. */
async function seedLobby(creator) {
  const q = await pickQuestion();
  const ins = await admin
    .from("matches")
    .insert({
      mode: "ranked",
      status: "pending",
      created_by: creator,
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
  if (ins.error) throw new Error(ins.error.message);
  await admin.from("match_players").insert([
    { match_id: ins.data.id, user_id: alpha.id, seat: 0 },
    { match_id: ins.data.id, user_id: bravo.id, seat: 1 },
  ]);
  return { matchId: ins.data.id, questionId: q.id };
}

/**
 * Both bots walk into the room.
 *
 * Note: no `presentUserIds`. The room gate deliberately ignores that field now,
 * because it is caller-supplied â€” a seated player could otherwise post both
 * uuids and start the duel alone. Only the server-side seat stamps count.
 */
async function startRoom(matchId) {
  const { data: seats } = await admin.from("match_players").select("user_id").eq("match_id", matchId);
  const ids = (seats ?? []).map((s) => s.user_id);
  await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({ presenceLive: true }),
  });
  const res = await api(`/api/match/${matchId}/sync`, bravo.token, {
    method: "POST",
    body: JSON.stringify({ presenceLive: true }),
  });
  return { json: res.json, ids };
}

/** A program that reads stdin and prints `expected`, so the judge accepts it. */
function echoSolution(expected) {
  return [
    "const fs = require('fs');",
    "fs.readFileSync(0, 'utf8');",
    `process.stdout.write(${JSON.stringify(expected)});`,
  ].join("\n");
}

const alpha = await tokenFor(ALPHA);
const bravo = await tokenFor(BRAVO);
await wipe(alpha.id);
await wipe(bravo.id);

console.log("\n=== audit: ranked win path, driven from both seats ===\n");

/* ------------------------------------------------------------------ *
 * BUG 1 â€” a seated player can claim a win they never earned.
 *
 * /api/match/complete writes the CALLER as the winner and never checks that
 * the clock started, that it is still running, or that the caller ever passed
 * a test. During the lobby both players have a seat, so either can just POST it.
 * ------------------------------------------------------------------ */
console.log("--- bug: starting the duel alone ---");
{
  const { matchId } = await seedLobby(alpha.id);

  // Only alpha arrives, but claims the opponent is there too.
  const spoof = await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({ presentUserIds: [alpha.id, bravo.id], presenceLive: true }),
  });
  note(`alpha alone, claiming both seats -> phase ${spoof.json.phase}`);
  check("one player cannot start the duel by claiming both seats", spoof.json.phase, "lobby");
  check("no start instant is written while a seat is empty", spoof.json.startedAt, null);

  // Now the opponent genuinely turns up, and it opens.
  await sleep(1600);
  const real = await api(`/api/match/${matchId}/sync`, bravo.token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  check("the room opens once both seats are really present", real.json.phase !== "lobby", true);
  check("both seats are counted as present", real.json.playersPresent, 2);

  await admin.from("match_players").delete().eq("match_id", matchId);
  await admin.from("matches").delete().eq("id", matchId);
}

console.log("\n--- bug: claiming an unearned win ---");
{
  const { matchId } = await seedLobby(alpha.id);

  // Neither seat has run a single line of code yet.
  const before = await admin.from("users").select("id,rating,wins").in("id", [alpha.id, bravo.id]);
  const bravoBefore = (before.data ?? []).find((u) => u.id === bravo.id);

  const steal = await api("/api/match/complete", bravo.token, {
    method: "POST",
    body: JSON.stringify({ matchId }),
  });
  note(`bravo POSTs /complete during the lobby -> ${steal.status} ${JSON.stringify(steal.json).slice(0, 120)}`);

  const view = await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  check("a lobby cannot be stolen before it starts", view.json.winnerId, null);

  const after = await admin.from("users").select("rating,wins").eq("id", bravo.id).single();
  check("a player who never submitted keeps their rating", after.data.rating, bravoBefore.rating);
  check("a player who never submitted gets no win", after.data.wins, bravoBefore.wins);

  await admin.from("match_players").delete().eq("match_id", matchId);
  await admin.from("matches").delete().eq("id", matchId);
}

/* ------------------------------------------------------------------ *
 * BUG 2 â€” you can keep submitting after the clock has run out, and the
 * late submit is accepted as a win.
 *
 * /api/practice/submit rejects submissions before the match starts but has no
 * upper bound, so once remainingSeconds hits 0 the arena still accepts a
 * passing submit and hands it to /complete.
 * ------------------------------------------------------------------ */
console.log("\n--- bug: submitting after time is up ---");
{
  // A match that started 10 minutes ago with a 60s limit: long expired.
  const expiredQ = await pickQuestion();
  const q = { id: expiredQ.id };
  const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  void q;
  const ins = await admin
    .from("matches")
    .insert({
      mode: "ranked",
      status: "active",
      created_by: alpha.id,
      started_at: startedAt,
      metadata: {
        question_id: q.id,
        time_limit: 60,
        language: "node",
        match_type: "1v1",
        started_at: startedAt,
      },
    })
    .select("id")
    .single();
  const matchId = ins.data.id;
  await admin.from("match_players").insert([
    { match_id: matchId, user_id: alpha.id, seat: 0 },
    { match_id: matchId, user_id: bravo.id, seat: 1 },
  ]);

  const view = await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  note(`remainingSeconds on an expired match = ${view.json.remainingSeconds}`);
  check("an expired match reports zero time left", view.json.remainingSeconds, 0);

  const { data: cases } = await admin
    .from("practice_questions")
    .select("testcases")
    .eq("id", q.id)
    .single();
  const first = cases.testcases[0];

  // A correct solution, submitted long after the clock died.
  const late = await api("/api/practice/submit", alpha.token, {
    method: "POST",
    body: JSON.stringify({
      questionId: q.id,
      code: SOLUTIONS[q.id],
      language: "javascript",
      intent: "submit",
      matchId,
    }),
  });
  note(`submit after the deadline -> ${late.status} ${JSON.stringify(late.json).slice(0, 140)}`);
  check("a submission after the deadline is refused", late.status, 409);

  await admin.from("match_players").delete().eq("match_id", matchId);
  await admin.from("matches").delete().eq("id", matchId);
}

/* ------------------------------------------------------------------ *
 * BUG 3 â€” asymmetry: does the LOSER get told, and does the winner's
 * own view agree with the loser's?
 * ------------------------------------------------------------------ */
console.log("\n--- fairness: both sides agree on the result ---");
{
  const { matchId, questionId } = await seedLobby(alpha.id);
  const started = await startRoom(matchId);
  check("the room started", started.json.phase !== "lobby", true);
  await sleep(3200);

  const { data: cases } = await admin
    .from("practice_questions")
    .select("testcases")
    .eq("id", questionId)
    .single();
  const first = cases.testcases[0];

  const pass = async (who) =>
    api("/api/practice/submit", who.token, {
      method: "POST",
      body: JSON.stringify({
        questionId,
        code: SOLUTIONS[questionId],
        language: "javascript",
        intent: "submit",
        matchId,
      }),
    });

  const alphaPass = await pass(alpha);
  note(`alpha submit -> ${alphaPass.status} ${JSON.stringify(alphaPass.json).slice(0, 300)}`);
  check("alpha's correct code passes", alphaPass.json.passed, true);
  await api("/api/match/complete", alpha.token, {
    method: "POST",
    body: JSON.stringify({ matchId }),
  });

  const alphaView = await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const bravoView = await api(`/api/match/${matchId}/sync`, bravo.token, {
    method: "POST",
    body: JSON.stringify({}),
  });

  check("both players are told the same winner", alphaView.json.winnerId, bravoView.json.winnerId);
  check("the winner is the player who solved it", alphaView.json.winnerId, alpha.id);
  check("the loser sees the match is over", bravoView.json.phase, "over");
  check("the loser sees a result they can read", typeof bravoView.json.completedAt, "string");

  const me = bravoView.json.players.find((p) => p.isYou);
  const them = bravoView.json.players.find((p) => !p.isYou);
  check("the loser is shown their own row", me?.userId, bravo.id);
  check("the loser is shown the winner's row", them?.userId, alpha.id);

  await admin.from("match_attempts").delete().eq("match_id", matchId);
  await admin.from("match_players").delete().eq("match_id", matchId);
  await admin.from("matches").delete().eq("id", matchId);
  await admin.from("practice_submissions").delete().eq("user_id", alpha.id);
  await admin.from("practice_submissions").delete().eq("user_id", bravo.id);
}

/* ------------------------------------------------------------------ *
 * BUG 4 â€” the opponent's activity feed must be symmetric.
 * ------------------------------------------------------------------ */
console.log("\n--- fairness: the activity feed ---");
{
  const { matchId } = await seedLobby(alpha.id);
  await startRoom(matchId);
  await sleep(3200);

  // Only alpha logs attempts.
  await admin.from("match_attempts").insert({
    match_id: matchId,
    user_id: alpha.id,
    passed: 3,
    total: 8,
  });

  const bravoView = await api(`/api/match/${matchId}/sync`, bravo.token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const alphaView = await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const bravoSeesAlpha = bravoView.json.players.find((p) => !p.isYou);
  const alphaSeesBravo = alphaView.json.players.find((p) => !p.isYou);
  check("the opponent's attempts are visible", bravoSeesAlpha?.attempts, 1);
  check("the opponent's best pass count is visible", bravoSeesAlpha?.bestPassed, 3);
  check("an idle opponent still reads as present", typeof alphaSeesBravo?.attempts, "number");

  await admin.from("match_attempts").delete().eq("match_id", matchId);
  await admin.from("match_players").delete().eq("match_id", matchId);
  await admin.from("matches").delete().eq("id", matchId);
}

await admin.from("matchmaking_queue").delete().eq("user_id", alpha.id);
await admin.from("matchmaking_queue").delete().eq("user_id", bravo.id);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
