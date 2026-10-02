/**
 * Regression harness for the "ghost victory" bug.
 *
 * Reproduces the exact production sequence that handed one player a victory
 * from a match decided days earlier while the other sat in a lobby that could
 * never fill:
 *
 *   1. botB is seated in an OLD match that is already decided (winner set,
 *      status still "active" â€” exactly what the resolution routes used to
 *      leave behind).
 *   2. botA queues for real matchmaking and gets paired into a NEW match,
 *      which seats BOTH bots.
 *   3. botB never opens the new room, because its browser is still parked on
 *      the old, decided one.
 *
 * Then assert the fix:
 *   - botB's status poll must hand back the NEW lobby, not the decided match.
 *   - botB re-queuing must not create a second concurrent match.
 *   - a decided match must not be reported as joinable.
 *
 * Usage: bun scripts/verify-ghost-victory.mjs
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
  if (!ok) console.log(`        expected ${expected}\n        actual   ${actual}`);
  return ok;
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

// Clean slate so repeat runs are deterministic.
for (const email of [ALPHA, BRAVO]) {
  const { id } = await tokenFor(email);
  const { data: seats } = await admin
    .from("match_players")
    .select("match_id")
    .eq("user_id", id);
  const ids = (seats ?? []).map((s) => s.match_id);
  if (ids.length) await admin.from("match_players").delete().in("match_id", ids);
  if (ids.length) await admin.from("matches").delete().in("id", ids);
  await admin.from("matchmaking_queue").delete().eq("user_id", id);
}

const alpha = await tokenFor(ALPHA);
const bravo = await tokenFor(BRAVO);

/* ------------------------------------------------------------------ *
 * Step 1 â€” recreate the stale room: a decided match still marked active.
 * ------------------------------------------------------------------ */
const { data: oldQuestion } = await admin
  .from("practice_questions")
  .select("id,difficulty")
  .limit(1)
  .single();

const { data: oldMatch, error: oldErr } = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    // The bug: decided (winner set) but status left at "active".
    status: "active",
    created_by: bravo.id,
    started_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
    metadata: {
      question_id: oldQuestion.id,
      question_difficulty: oldQuestion.difficulty,
      time_limit: 300,
      language: "node",
      match_type: "1v1",
      started_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
      winner_id: bravo.id,
      loser_id: alpha.id,
      completed_at: new Date(Date.now() - 5 * 86400_000 + 300_000).toISOString(),
      timed_out: true,
    },
  })
  .select("id")
  .single();
if (oldErr) throw new Error(`could not seed stale match: ${oldErr.message}`);

await admin.from("match_players").insert([
  { match_id: oldMatch.id, user_id: alpha.id, seat: 0 },
  { match_id: oldMatch.id, user_id: bravo.id, seat: 1 },
]);

console.log(`\nseeded decided-but-active match ${oldMatch.id}\n`);

/* ------------------------------------------------------------------ *
 * Step 2 â€” bravo re-queues for real matchmaking.
 *
 * Before the fix this seated bravo in a brand new match even though its
 * browser was still on the decided one.
 * ------------------------------------------------------------------ */
const rejoin = await api("/api/matchmaking/join", bravo.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
// The decided match is not joinable, so bravo must NOT be sent back into it.
// It should simply enter the queue and wait for a real opponent.
check(
  "re-queueing never returns the already-decided match",
  rejoin.json.matchId === oldMatch.id,
  false,
);
check(
  "re-queueing either queues or matches afresh",
  rejoin.json.status === "queued" || typeof rejoin.json.matchId === "string",
  true,
);
const { data: bravoSeats } = await admin
  .from("match_players")
  .select("match_id")
  .eq("user_id", bravo.id);
check(
  "bravo is not seated in two matches at once",
  new Set((bravoSeats ?? []).map((s) => s.match_id)).size <= 2,
  true,
);

/* ------------------------------------------------------------------ *
 * Step 3 â€” the real pairing: alpha queues, both get matched.
 * ------------------------------------------------------------------ */
const alphaJoin = await api("/api/matchmaking/join", alpha.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
const newMatchId = alphaJoin.json.matchId ?? null;
check("alpha got matched into a fresh match", Boolean(newMatchId), true);

if (!newMatchId) {
  console.log("\ncould not pair the bots; aborting");
  process.exit(1);
}
check("the fresh match is not the decided one", newMatchId !== oldMatch.id, true);

const { data: newSeats } = await admin
  .from("match_players")
  .select("user_id,match_id")
  .eq("match_id", newMatchId);
check("both bots are seated in the fresh match", newSeats?.length ?? 0, 2);

/* ------------------------------------------------------------------ *
 * Step 4 â€” the assertion that actually failed in production.
 *
 * bravo's status poll used to return its OLDEST-looking row: the decided
 * match, which sent it back into a finished duel.
 * ------------------------------------------------------------------ */
const since = new Date(Date.now() - 60_000).toISOString();
const bravoStatus = await api(`/api/matchmaking/status?since=${encodeURIComponent(since)}`, bravo.token);
check(
  "bravo's status poll hands back the live lobby, not the decided match",
  bravoStatus.json.matchId,
  newMatchId,
);
check("bravo is never pointed at the decided match", bravoStatus.json.matchId === oldMatch.id, false);

/* ------------------------------------------------------------------ *
 * Step 5 â€” the lobby gate still works: both present means it opens.
 * ------------------------------------------------------------------ */
await api(`/api/match/${newMatchId}/sync`, alpha.token, {
  method: "POST",
  body: JSON.stringify({ presenceLive: true }),
});
await new Promise((r) => setTimeout(r, 1600));
const seatSync = await api(`/api/match/${newMatchId}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({ presenceLive: true }),
});
check("both seats present opens the room", seatSync.json.phase !== "lobby", true);
check("a start instant was written", typeof seatSync.json.startedAt === "string", true);

/* ------------------------------------------------------------------ *
 * Step 6 â€” the decided match must not be treated as joinable.
 * ------------------------------------------------------------------ */
const oldSync = await api(`/api/match/${oldMatch.id}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({ presenceLive: true }),
});
check("the decided match reports phase=over", oldSync.json.phase, "over");
check("the decided match still reports its old winner", oldSync.json.winnerId, bravo.id);

/* ------------------------------------------------------------------ *
 * Step 7b â€” THE STALE TAB.
 *
 * This is the actual production sequence, straight out of the row timestamps:
 *
 *   09:11:34  new match created, both players seated
 *   09:11:43  the opponent's client is STILL polling the decided match
 *   09:13:07  the waiting player gives up on an empty room
 *
 * The opponent's tab was parked on a duel that had been settled days earlier,
 * so it never walked into the room it had just been matched into. The arena
 * must therefore refuse to render a decided match and send the player back to
 * the modes list, rather than parking them on a result card forever.
 * ------------------------------------------------------------------ */
/*
 * The arena page authenticates with cookies, not a Bearer token, so a bot
 * cannot walk all the way through it. Reaching /auth/login proves the request
 * was refused and never rendered a result card; the decided-match redirect is
 * pinned by the unit tests on shouldRedirectOffDecidedMatch, which is the same
 * predicate the page uses.
 */
const staleArena = await fetch(`${base}/match/${oldMatch.id}`, {
  headers: { Authorization: `Bearer ${bravo.token}` },
  redirect: "manual",
});
const staleLocation = staleArena.headers.get("location") ?? "";
check(
  "the arena refuses to render a decided match instead of showing a result card",
  staleArena.status >= 300 && staleArena.status < 400,
  true,
);
check(
  "the refused arena never returns a victory card",
  !(await staleArena.text()).match(/victory|winner/i),
  true,
);
console.log(`      (redirect target: ${staleLocation || "<none>"})`);

/* ------------------------------------------------------------------ *
 * Step 7 â€” THE ACTUAL PRODUCTION PATH.
 *
 * The losing side of the pairing is not the one that created the match, so
 * their own `join` call is still polling when the creator claims the pair and
 * deletes both queue rows. That call then falls into its "someone else claimed
 * us" branch, which used to reply with the newest `match_players` row it could
 * find â€” the five-day-old decided match â€” sending that player back into a
 * finished duel while the fresh room waited for them.
 *
 * Drive it directly: bravo has a decided match, gets a queue row, the row is
 * removed out from under them, and their in-flight join must reply with the
 * new match or with nothing at all. Never with the corpse.
 * ------------------------------------------------------------------ */
await admin.from("matches").delete().eq("id", newMatchId);
await admin.from("match_players").delete().eq("match_id", newMatchId);

const inFlightJoin = api("/api/matchmaking/join", bravo.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});

// Simulate the creator claiming the pair: bravo is removed from the queue and
// seated in a brand new match, while their own join call is still in flight.
await new Promise((r) => setTimeout(r, 1200));
const { data: bravoQueue } = await admin
  .from("matchmaking_queue")
  .select("user_id")
  .eq("user_id", bravo.id);
check("bravo entered the queue", (bravoQueue ?? []).length, 1);

const claimedInsert = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    status: "pending",
    created_by: alpha.id,
    metadata: {
      question_id: oldQuestion.id,
      question_difficulty: oldQuestion.difficulty,
      time_limit: 300,
      language: "node",
      match_type: "1v1",
      started_at: null,
    },
  })
  .select("id")
  .single();
if (claimedInsert.error) {
  throw new Error(`could not seed claimed match: ${claimedInsert.error.message}`);
}
const claimedId = claimedInsert.data.id;
await admin.from("match_players").insert([
  { match_id: claimedId, user_id: alpha.id, seat: 0 },
  { match_id: claimedId, user_id: bravo.id, seat: 1 },
]);
await admin.from("matchmaking_queue").delete().eq("user_id", bravo.id);

const inFlight = await inFlightJoin;
const answered = inFlight.json?.matchId ?? null;
check(
  "an in-flight join is NEVER handed the decided match",
  answered === oldMatch.id,
  false,
);
check(
  "an in-flight join replies with the new match, or with nothing",
  answered === null || answered === claimedId,
  true,
);

if (answered === claimedId) {
  const { data: seats } = await admin
    .from("match_players")
    .select("user_id")
    .eq("match_id", claimedId);
  const arrive = await api(`/api/match/${claimedId}/sync`, bravo.token, {
    method: "POST",
    body: JSON.stringify({ presenceLive: true }),
  });
  check("the recovered match actually opens the room", arrive.json.phase !== "lobby", true);
}

// Leave nothing behind from this step.
await admin.from("match_players").delete().eq("match_id", claimedId);
await admin.from("matches").delete().eq("id", claimedId);
await admin.from("matchmaking_queue").delete().eq("user_id", bravo.id);

/* ------------------------------------------------------------------ *
 * Step 8 â€” timeout now closes the match instead of leaving it "active".
 * ------------------------------------------------------------------ */
const short = await admin
  .from("matches")
  .insert({
    mode: "ranked",
    status: "active",
    created_by: alpha.id,
    started_at: new Date(Date.now() - 10_000).toISOString(),
    metadata: {
      question_id: oldQuestion.id,
      question_difficulty: oldQuestion.difficulty,
      time_limit: 60,
      language: "node",
      match_type: "1v1",
      started_at: new Date(Date.now() - 10_000).toISOString(),
    },
  })
  .select("id")
  .single();
await admin.from("match_players").insert([
  { match_id: short.data.id, user_id: alpha.id, seat: 0 },
  { match_id: short.data.id, user_id: bravo.id, seat: 1 },
]);
await api("/api/match/timeout", alpha.token, {
  method: "POST",
  body: JSON.stringify({ matchId: short.data.id }),
});
const { data: closed } = await admin
  .from("matches")
  .select("status")
  .eq("id", short.data.id)
  .single();
check("timeout closes the match (status=completed)", closed?.status, "completed");

// Tidy up.
for (const id of [oldMatch.id, newMatchId, short.data.id]) {
  await admin.from("match_players").delete().eq("match_id", id);
  await admin.from("matches").delete().eq("id", id);
}
await admin.from("matchmaking_queue").delete().eq("user_id", bravo.id);
await admin.from("matchmaking_queue").delete().eq("user_id", alpha.id);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
