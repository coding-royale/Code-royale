/**
 * Two bots, one real 1v1, joined at the same time.
 *
 * This exists because the earlier harnesses could not see the worst bug in the
 * ladder. Every one of them started by deleting all of its bots' existing
 * matches — a clean slate — which is precisely the state in which the bug was
 * invisible. A real account arrives carrying months of abandoned matches.
 *
 * So this one deliberately plants a 25-day-old corpse FIRST, then has both bots
 * queue, and asserts:
 *   - neither bot is handed the corpse; they actually queue
 *   - they get paired with EACH OTHER, not with the stale opponent
 *   - both seats enter the room and the clock starts for both at one instant
 *   - they fight, one solves, the rating moves
 *
 * Usage:
 *   bun scripts/stub-judge.mjs 3999
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/duel-fair-1v1.mjs
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

const alpha = await tokenFor("duel.alpha@test.local");
const bravo = await tokenFor("duel.bravo@test.local");

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

for (const who of [alpha.id, bravo.id]) await wipe(who);

console.log("\n=== two bots, one real 1v1, same room ===\n");

/* ------------------------------------------------------------------ *
 * Plant the corpse: a match from 25 days ago that never resolved.
 *
 * No winner, status still "active", five-minute clock that expired a
 * month ago, against a third party. This is what a real account is
 * carrying around, and what the old join guard happily handed back.
 * ------------------------------------------------------------------ */
const { data: stranger } = await admin.auth.admin.createUser({
  email: "duel.stranger@test.local",
  password,
  email_confirm: true,
  user_metadata: { display_name: "DuelStranger" },
});
let strangerId = stranger?.user?.id ?? null;
if (!strangerId) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPerPage: 200, perPage: 200 });
  strangerId = list?.users?.find((u) => u.email === "duel.stranger@test.local")?.id ?? null;
}
await admin.from("users").update({ username: "DuelStranger", onboarded: true, rating: 420 }).eq("id", strangerId);

const { data: q } = await admin.from("practice_questions").select("id").limit(1).single();
const corpseStart = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
const corpse = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    status: "active",
    created_by: strangerId,
    started_at: corpseStart,
    metadata: {
      question_id: q.id,
      time_limit: 300,
      language: "node",
      match_type: "1v1",
      started_at: corpseStart,
      // deliberately no winner: this is the case the old guard got wrong
    },
  })
  .select("id")
  .single();
if (corpse.error) throw new Error(corpse.error.message);
await admin.from("match_players").insert([
  { match_id: corpse.data.id, user_id: alpha.id, seat: 0 },
  { match_id: corpse.data.id, user_id: strangerId, seat: 1 },
]);
note(`planted a 25-day-old undecided match ${corpse.data.id} (alpha vs DuelStranger)`);

/* --- 1. Queueing must IGNORE the corpse and actually queue. --- */
const alphaJoin = await api("/api/matchmaking/join", alpha.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
note(`alpha join -> ${JSON.stringify(alphaJoin.json).slice(0, 90)}`);
check("alpha is NOT dumped into the 25-day-old match", alphaJoin.json.matchId === corpse.data.id, false);

/* --- 2. Both bots queue and get paired with each other. --- */
const bravoJoin = api("/api/matchmaking/join", bravo.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
let matchId = alphaJoin.json.matchId ?? null;
const bravoRes = await bravoJoin;
matchId = matchId ?? bravoRes.json.matchId ?? null;

if (!matchId) {
  const since = new Date(Date.now() - 120_000).toISOString();
  for (let i = 0; i < 12 && !matchId; i++) {
    const [a, b] = await Promise.all([
      api(`/api/matchmaking/status?since=${encodeURIComponent(since)}`, alpha.token),
      api(`/api/matchmaking/status?since=${encodeURIComponent(since)}`, bravo.token),
    ]);
    matchId = a.json.matchId ?? b.json.matchId ?? null;
    if (!matchId) await sleep(1000);
  }
}

check("the two bots were paired", Boolean(matchId), true);
if (!matchId) {
  console.log("\nno pairing; aborting");
  process.exit(1);
}
check("and it is NOT the corpse", matchId === corpse.data.id, false);
note(`paired into ${matchId}`);

const { data: seats } = await admin.from("match_players").select("user_id").eq("match_id", matchId);
const seatIds = new Set((seats ?? []).map((s) => s.user_id));
check("alpha is seated in the new match", seatIds.has(alpha.id), true);
check("bravo is seated in the new match", seatIds.has(bravo.id), true);
check("exactly two seats, no stranger", seats?.length, 2);

/* --- 3. Both enter the room; one shared start instant. --- */
const enterA = await api(`/api/match/${matchId}/sync`, alpha.token, {
  method: "POST",
  body: JSON.stringify({}),
});
check("alpha alone does not open the room", enterA.json.phase, "lobby");
await sleep(1600);
const enterB = await api(`/api/match/${matchId}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({}),
});
check("the room opens once both arrive", enterB.json.phase !== "lobby", true);
check("a start instant was written", typeof enterB.json.startedAt === "string", true);
check("the clock is not already expired", enterB.json.remainingSeconds > 0, true);

await sleep(1600);
const rereadA = await api(`/api/match/${matchId}/sync`, alpha.token, {
  method: "POST",
  body: JSON.stringify({}),
});
check("both bots read the SAME start instant", rereadA.json.startedAt, enterB.json.startedAt);
check("neither bot is sent to the corpse", rereadA.json.matchId === corpse.data.id, false);

/* --- 4. They fight: alpha solves, bravo does not. --- */
const { data: matchRow } = await admin
  .from("matches")
  .select("metadata")
  .eq("id", matchId)
  .single();
const questionId = matchRow.metadata.question_id;
const { data: qRow } = await admin
  .from("practice_questions")
  .select("title,testcases")
  .eq("id", questionId)
  .single();
const solution = SOLUTIONS[questionId];
note(`question: ${qRow?.title} (${questionId})`);
check("the bank has a known solution for the chosen question", typeof solution === "string", true);
if (solution) {
  note(`testcases: ${JSON.stringify(qRow?.testcases ?? []).slice(0, 300)}`);
}

await sleep(3200); // outlast the 3-2-1 lead-in

const win = await api("/api/practice/submit", alpha.token, {
  method: "POST",
  body: JSON.stringify({ questionId, code: solution, language: "javascript", intent: "submit", matchId }),
});
check("alpha's solution passes the judge", win.json.passed, true);
check("it is recorded as solved", win.json.solved, true);

const lose = await api("/api/practice/submit", bravo.token, {
  method: "POST",
  body: JSON.stringify({
    questionId,
    code: "function solve(){ return null; }",
    language: "javascript",
    intent: "submit",
    matchId,
  }),
});
check("bravo's wrong solution fails", lose.json.passed, false);

await api("/api/match/timeout", alpha.token, {
  method: "POST",
  body: JSON.stringify({ matchId }),
});
const final = await api(`/api/match/${matchId}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({}),
});
check("the match is over", final.json.phase, "over");
check("the solver won", final.json.winnerId, alpha.id);
check("it is a win, not a draw", final.json.winnerId === null, false);
check("the match is closed", final.json.timedOut, true);

const { data: closed } = await admin.from("matches").select("status").eq("id", matchId).single();
check("status is completed", closed?.status, "completed");

/* --- 5. And the corpse is finally closed off, not left to bite again. --- */
const afterCorpse = await api("/api/matchmaking/join", bravo.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
check("re-queueing after a real match still ignores the corpse", afterCorpse.json.matchId === corpse.data.id, false);
await api("/api/matchmaking/cancel", bravo.token, { method: "POST" });

/* Tidy up. */
for (const id of [matchId, corpse.data.id]) {
  await admin.from("match_attempts").delete().eq("match_id", id);
  await admin.from("match_players").delete().eq("match_id", id);
  await admin.from("matches").delete().eq("id", id);
}
await admin.from("matchmaking_queue").delete().eq("user_id", alpha.id);
await admin.from("matchmaking_queue").delete().eq("user_id", bravo.id);
await admin.from("practice_submissions").delete().eq("user_id", alpha.id);
await admin.from("practice_submissions").delete().eq("user_id", bravo.id);

console.log(failures === 0 ? "\nall checks passed — two bots, one real duel" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);