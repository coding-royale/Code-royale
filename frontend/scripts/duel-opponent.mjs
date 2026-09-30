/**
 * Dev-only harness: plays the second seat of a duel from the terminal so a
 * single browser can exercise the whole room -> start -> result flow.
 *
 * Usage:
 *   bun scripts/duel-opponent.mjs join                 # enter the newest lobby
 *   bun scripts/duel-opponent.mjs activity 3 4 8        # log attempts (passed total)
 *   bun scripts/duel-opponent.mjs win                   # submit a passing solution
 *   bun scripts/duel-opponent.mjs state                 # print the room state
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.DUEL_BASE_URL || "http://localhost:3001";
const email = process.env.DUEL_OPPONENT_EMAIL || "duel.bravo@test.local";
const password = process.env.DUEL_PASSWORD || "TestPass123!";

const admin = createClient(url, service, { auth: { persistSession: false } });
const asOpponent = createClient(url, anon, { auth: { persistSession: false } });

const { data: signIn, error: signInError } = await asOpponent.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error("sign-in failed:", signInError.message);
  process.exit(1);
}
const token = signIn.session.access_token;
const me = signIn.user.id;

const { data: profile } = await admin.from("users").select("username").eq("id", me).maybeSingle();
console.log(`opponent: ${profile?.username ?? me}`);

async function newestMatch() {
  const { data } = await admin
    .from("matches")
    .select("id,status,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return (
    (data ?? []).find((m) => m.status === "pending" || m.status === "active") ?? data?.[0] ?? null
  );
}

async function matchPlayers(matchId) {
  const { data } = await admin.from("match_players").select("user_id").eq("match_id", matchId);
  return (data ?? []).map((r) => r.user_id);
}

async function sync(matchId, body) {
  const res = await fetch(`${base}/api/match/${matchId}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function joinQueue() {
  // Must match the mode the browser player picked: the join route only pairs
  // candidates inside the same mode and match_type. Read it off the *other*
  // seat, not our own leftover queue row.
  const { data: others } = await admin
    .from("matchmaking_queue")
    .select("mode,match_type,time_limit_seconds")
    .neq("user_id", me)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  const partner = others?.[0];
  const body = {
    mode: process.env.DUEL_MODE || partner?.mode || "ranked",
    timeLimitSeconds: partner?.time_limit_seconds ?? 300,
    matchType: partner?.match_type || "1v1",
  };
  const res = await fetch(`${base}/api/matchmaking/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`join ${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function queueWait(seconds) {
  // Keep re-entering the queue until the browser player is seen. The join
  // endpoint re-inserts our own row each call, so this is safe to repeat and
  // survives the tool-call latency between clicking in the UI and running it.
  const deadline = Date.now() + seconds * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const json = await joinQueue();
    if (json?.matchId) {
      console.log(`PAIRED on attempt ${attempt}: ${json.matchId}`);
      return json;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`no pairing after ${attempt} attempts`);
  return null;
}

const [command, ...args] = process.argv.slice(2);

if (command === "queue") {
  // Real matchmaking entry: this is what actually pairs the two seats.
  await joinQueue();
} else if (command === "queuewait") {
  await queueWait(Number(args[0]) || 50);
} else if (command === "state") {
  const match = await newestMatch();
  if (!match) {
    console.log("no match yet");
    process.exit(0);
  }
  const players = await matchPlayers(match.id);
  const { json } = await sync(match.id, { presentUserIds: players });
  console.log(JSON.stringify({ matchId: match.id, status: match.status, ...json }, null, 2));
} else if (command === "join") {
  // Wait for a lobby to appear, then enter it as the second seat.
  const deadline = Date.now() + 60_000;
  let match = null;
  while (Date.now() < deadline) {
    match = await newestMatch();
    if (match && match.status === "pending") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!match) {
    console.log("no lobby appeared");
    process.exit(1);
  }
  const players = await matchPlayers(match.id);
  console.log(`entering room ${match.id} with seats ${players.length}`);
  const { json } = await sync(match.id, { presentUserIds: players, presenceLive: true });
  console.log(
    JSON.stringify(
      {
        status: match.status,
        phase: json.phase,
        startedAt: json.startedAt,
        playersPresent: json.playersPresent,
        playersTotal: json.playersTotal,
        remainingSeconds: json.remainingSeconds,
        countdownSeconds: json.countdownSeconds,
        serverNow: json.serverNow,
        error: json.error,
      },
      null,
      2,
    ),
  );
} else if (command === "activity") {
  const [passed = "3", total = "8"] = args;
  const match = await newestMatch();
  if (!match) process.exit(1);
  await admin.from("match_attempts").insert({
    match_id: match.id,
    user_id: me,
    passed: Number(passed),
    total: Number(total),
  });
  const { json } = await sync(match.id, { presentUserIds: await matchPlayers(match.id) });
  const mine = json.players?.find((p) => !p.isYou);
  console.log(`logged ${passed}/${total}; opponent chip now reads:`);
  console.log(`  attempts=${mine?.attempts} best=${mine?.bestPassed}/${mine?.bestTotal} last=${mine?.lastActiveLabel}`);
} else if (command === "win") {
  const match = await newestMatch();
  if (!match) process.exit(1);
  const startedAt = match.metadata?.started_at;
  await admin.from("practice_submissions").insert({
    user_id: me,
    question_id: match.metadata?.question_id,
    language: "node",
    passed: true,
  });
  await admin.from("match_attempts").insert({
    match_id: match.id,
    user_id: me,
    passed: 1,
    total: 1,
  });
  console.log(`opponent submitted a passing solution (match started at ${startedAt})`);
} else {
  console.log("commands: state | join | activity <passed> <total> | win");
}
