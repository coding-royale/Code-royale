/**
 * Proves the opponent progress panel reports the opponent's REAL runs.
 *
 * The panel it replaced animated a hardcoded `SNIPPET_POOL` on a timer in PvP.
 * It looked live, moved on its own, and had no connection to the other player —
 * pure decoration. This drives two bots and asserts the numbers one player is
 * shown about the other are the other player's actual recorded runs.
 *
 * Also pins the backend fix: each player now gets their own attempt window, so
 * one player spamming Run can no longer push the other's history out of the
 * payload and make their progress bar freeze or reset.
 *
 * Usage:
 *   bun scripts/stub-judge.mjs 3999
 *   $env:GOBOXD_API_URL="http://127.0.0.1:3999"; bun run start -p 3100
 *   bun scripts/verify-opponent-progress.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SOLUTIONS } from "./duel-solutions.mjs";
import { ATTEMPTS_PER_PLAYER } from "../src/app/api/match/[matchId]/sync/route.ts";

const RECENT_ATTEMPT_FEED = 8;

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
  if (!ok) {
    failures += 1;
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

const alpha = await tokenFor("duel.alpha@test.local"); // the player watching
const bravo = await tokenFor("duel.bravo@test.local"); // the player being watched

for (const who of [alpha, bravo]) {
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

console.log("\n=== opponent progress is real, not decoration ===\n");

const { data: q } = await admin.from("practice_questions").select("id").limit(1).single();
const startedAt = new Date(Date.now() - 20_000).toISOString();
const ins = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    status: "active",
    created_by: bravo.id,
    started_at: startedAt,
    metadata: {
      question_id: q.id,
      time_limit: 600,
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
  { match_id: matchId, user_id: bravo.id, seat: 0 },
  { match_id: matchId, user_id: alpha.id, seat: 1 },
]);
note(`match ${matchId}: alpha is watching bravo`);

const view = async () => {
  const res = await api(`/api/match/${matchId}/sync`, alpha.token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (res.status !== 200) {
    console.log(`      DEBUG sync -> ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`);
  }
  return res.json;
};

const them = (payload) => payload.players?.find((p) => p && !p.isYou);

/* --- 1. Before anything runs: honest zeros, not fake activity. --- */
{
  const initial = them(await view());
  check("no runs yet is reported as none", initial.attempts, 0);
  check("best is 0/0", `${initial.bestPassed}/${initial.bestTotal}`, "0/0");
  check("not marked solved", initial.solved, false);
  const feed = Array.isArray(initial.recent) ? initial.recent : [];
  check("the run feed starts empty", feed.length, 0);
  note("this is the state the fake editor used to animate over");
}

/* --- 2. bravo really runs code, and alpha sees it move. --- */
{
  const questionId = q.id;
  // Record runs directly, mirroring what /api/practice/submit writes.
  const runs = [
    { passed: 1, total: 3 },
    { passed: 2, total: 3 },
    { passed: 3, total: 3 },
  ];
  for (const run of runs) {
    await admin.from("match_attempts").insert({
      match_id: matchId,
      user_id: bravo.id,
      passed: run.passed,
      total: run.total,
    });
  }

  const after = them(await view());
  check("the watcher sees every run the opponent made", after.attempts, 3);
  check("best score is the opponent's real best", `${after.bestPassed}/${after.bestTotal}`, "3/3");
  check("a clean sweep marks them solved", after.solved, true);

  const feed = after.recent ?? [];
  check("the run feed is populated", feed.length, 3);
  check("the feed is newest first", `${feed[0].passed}/${feed[0].total}`, "3/3");
  check("the feed carries the real earlier runs", `${feed[2].passed}/${feed[2].total}`, "1/3");
  check("only the clean sweep is flagged", feed.filter((r) => r.passedAll).length, 1);
  note(`feed: ${feed.map((r) => `${r.passed}/${r.total}`).join(" -> ")}`);
}

/* --- 3. The panel's progress math follows those real numbers. --- */
{
  const { computeProgress, latestAttemptLabel, describeOpponentProgress } = await import(
    "../src/lib/match-activity.ts"
  );
  const after = them(await view());

  const solved = computeProgress({
    attempts: after.attempts,
    bestPassed: after.bestPassed,
    bestTotal: after.bestTotal,
    lastActiveAt: after.lastActiveAt,
  });
  check("a solved opponent fills the bar", solved.fraction, 1);
  check("the bar label names the real totals", solved.label, "all 3 tests passing");
  check("the chip reads the real score", latestAttemptLabel(after.bestPassed, after.bestTotal), "3/3");
  check(
    "the status line is built from the real runs",
    describeOpponentProgress({
      attempts: after.attempts,
      bestPassed: after.bestPassed,
      bestTotal: after.bestTotal,
      lastActiveAt: after.lastActiveAt,
    }),
    "3 runs · best 3/3",
  );
}

/* --- 4. Backend fix: spamming one player cannot evict the other's feed. --- */
{
  // The old query shared one limit(200) across both players, so 250 runs from
  // bravo would push alpha's history off the end and alpha's own bar would
  // depend on how fast bravo was clicking Run.
  const spam = Array.from({ length: 250 }, () => ({
    match_id: matchId,
    user_id: bravo.id,
    passed: 2,
    total: 3,
  }));
  for (let i = 0; i < spam.length; i += 50) {
    await admin.from("match_attempts").insert(spam.slice(i, i + 50));
  }
  // alpha has made exactly three runs of their own.
  for (const passed of [1, 1, 2]) {
    await admin.from("match_attempts").insert({
      match_id: matchId,
      user_id: alpha.id,
      passed,
      total: 3,
    });
  }

  const payload = await view();
  const watcher = payload.players?.find((p) => p && p.isYou);
  const watched = payload.players?.find((p) => p && !p.isYou);
  note(`bravo now has 253 runs recorded, alpha has 3`);

  // The fix: the window is per player, so the flood lands on the spammer alone.
  check("the quiet player still sees ALL of their own runs", watcher?.attempts, 3);
  check("their best score survives the flood", `${watcher?.bestPassed}/${watcher?.bestTotal}`, "2/3");
  check("their feed is not truncated by the spammer", (watcher?.recent ?? []).length, 3);

  // The spammer's own history is capped, which bounds the payload. That is the
  // intended trade: only the player generating the flood loses detail.
  check(
    "the spammer's own history is capped at the per-player window",
    watched?.attempts,
    ATTEMPTS_PER_PLAYER,
  );
  check(
    "and their feed is capped too",
    (watched?.recent ?? []).length <= RECENT_ATTEMPT_FEED,
    true,
  );
  note(`spammer sees ${watched?.attempts} of 253 runs; quiet player still sees all 3`);
}

/* --- 5. Cleanup --- */
await admin.from("match_attempts").delete().eq("match_id", matchId);
await admin.from("match_players").delete().eq("match_id", matchId);
await admin.from("matches").delete().eq("id", matchId);
await admin.from("practice_submissions").delete().eq("user_id", alpha.id);
await admin.from("practice_submissions").delete().eq("user_id", bravo.id);

console.log(failures === 0 ? "\nall checks passed — the panel reports real runs" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);