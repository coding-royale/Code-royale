/**
 * End-to-end duel test: two bots queue, get matched, enter the room, actually
 * WRITE AND SUBMIT CODE, and the match resolves to a real winner.
 *
 * This is the test that matters. The ghost-victory harness proved nobody got
 * handed a stale result card; this one proves the whole loop still works —
 * matchmaking pairs real players, the shared clock starts, code really runs
 * through the judge, and the player who solved it wins the rating.
 *
 *   bot A (alpha) submits a CORRECT solution
 *   bot B (bravo) submits a WRONG   solution
 *   -> alpha must win, bravo must lose, rating must move
 *
 * Usage: bun scripts/duel-battle.mjs
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Real solutions for the seeded easy bank, keyed by question id. Each returns a
 * `solve` matching the question's LeetCode-style signature, so the server's
 * harness wraps it and the judge runs genuine code.
 */
const SOLUTIONS = {
  "dede78a9-5c1e-4583-8447-030d0f7bad9c": `function solve(nums) {
  let total = 0;
  for (const n of nums) total += n;
  return total;
}`,
  "e1c396cc-90c7-42de-97a0-e5768ad0516d": `function solve(nums, target) {
  let count = 0;
  for (const n of nums) if (n === target) count++;
  return count;
}`,
  "a3541476-7117-42f8-bdea-7d5b86572653": `function solve(n) {
  return n % 2 === 0 ? "Even" : "Odd";
}`,
  "7d228300-b414-423f-99a0-6781c23bdb40": `function solve(n) {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}`,
  "c7ca0bbd-69a6-4cdd-9c97-1fc28c8f3486": `function solve(a, b) {
  let x = Math.abs(a), y = Math.abs(b);
  while (y) { const t = y; y = x % y; x = t; }
  return x;
}`,
  "d25d79b6-0136-4de7-ba7d-6e1242468b4c": `function solve(nums) {
  for (let i = 1; i < nums.length; i++) if (nums[i] < nums[i - 1]) return false;
  return true;
}`,
  "24238e70-7983-4c14-bf21-f4cc1a93967f": `function solve(a, b, c) {
  return Math.max(a, Math.max(b, c));
}`,
  "9ea8dd84-175f-4d9c-8b0b-37ebc7e4a1f7": `function solve(nums) {
  let best = nums[0];
  for (const n of nums) if (n > best) best = n;
  return best;
}`,
  "fdac5911-e921-4907-a675-66cb26a678a4": `function solve(s) {
  return s.split("").reverse().join("");
}`,
  "18c08da6-a687-4949-a51a-eaf3de7a1b55": `function solve(a, b) {
  return a + b;
}`,
  "fa941443-c8d8-4f6e-aed1-879723255c2b": `function solve(nums) {
  let best = nums[0], running = nums[0];
  for (let i = 1; i < nums.length; i++) {
    running = Math.max(nums[i], running + nums[i]);
    best = Math.max(best, running);
  }
  return best;
}`,
  "a52e15ed-9070-4b50-9db2-de39e6c65eab": `function solve(nums) {
  const out = new Array(nums.length).fill(1);
  let prefix = 1;
  for (let i = 0; i < nums.length; i++) { out[i] = prefix; prefix *= nums[i]; }
  let suffix = 1;
  for (let i = nums.length - 1; i >= 0; i--) { out[i] *= suffix; suffix *= nums[i]; }
  return out;
}`,
  "629dfb2f-699e-470e-8648-3150316ee8b5": `function solve(colors) {
  let z = 0, o = 0, t = 0;
  for (const c of colors) { if (c === 0) z++; else if (c === 1) o++; else t++; }
  const out = new Array(colors.length);
  let i = 0;
  for (; i < z; i++) out[i] = 0;
  for (let k = 0; k < o; k++) out[i++] = 1;
  for (let k = 0; k < t; k++) out[i++] = 2;
  return out;
}`,
  "e1bce1b7-f480-4110-8c5c-e379e8a76c52": `function solve(prices) {
  let best = 0, min = prices[0];
  for (const p of prices) {
    if (p < min) min = p;
    else if (p - min > best) best = p - min;
  }
  return best;
}`,
  "d563b23f-f2ca-46e6-b232-79dd0270297e": `function solve(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}`,
  "b5401843-2456-4a03-be27-099d57bdac4a": `function solve(s) {
  const seen = new Map();
  for (let i = 0; i < s.length; i++) seen.set(s[i], (seen.get(s[i]) || 0) + 1);
  for (let i = 0; i < s.length; i++) if (seen.get(s[i]) === 1) return i;
  return -1;
}`,
  "d2236e87-19b7-45ec-a529-4fcfb7e30ffb": `function solve(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) nums[write++] = nums[read];
  }
  while (write < nums.length) nums[write++] = 0;
  return nums;
}`,
  "d550d473-ffb7-47df-b968-6d1c68f59e76": `function solve(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (read === 0 || nums[read] !== nums[read - 1]) nums[write++] = nums[read];
  }
  return nums.slice(0, write);
}`,
  "6139b633-a516-438a-9022-4e0949285c46": `function solve(nums, k) {
  const n = nums.length;
  const shift = ((k % n) + n) % n;
  return nums.slice(n - shift).concat(nums.slice(0, n - shift));
}`,
  "2aacf404-2e1f-42a8-9227-a2b1da5404d2": `function solve(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const want = target - nums[i];
    if (seen.has(want)) return [seen.get(want), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
  "af4d00ed-a964-4b74-a3a8-2a523e427c6a": `function solve(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}`,
};

/** Deliberately wrong, so the judge rejects it and no win is recorded. */
const WRONG_SOLUTION = `function solve() {
  return "definitely-not-the-answer";
}`;

const ALPHA = "duel.alpha@test.local";
const BRAVO = "duel.bravo@test.local";

const alpha = await tokenFor(ALPHA);
const bravo = await tokenFor(BRAVO);

/* Clean slate. */
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

const ratingsBefore = {};
for (const who of [alpha, bravo]) {
  const { data } = await admin.from("users").select("rating,wins,losses").eq("id", who.id).single();
  ratingsBefore[who.id] = data;
}

console.log("\n=== two bots queue for a real duel ===\n");

/*
 * Code execution needs the goboxd shared secret, which deliberately lives only
 * in the production environment (a local .env.local has GOBOXD_API_URL but no
 * GOBOXD_AUTH_TOKEN). Rather than fish a production secret off a machine, the
 * harness runs against a local stub judge that implements the same POST /run
 * contract and really executes the submitted JavaScript. Every Code Royale step
 * — matchmaking, the room gate, the shared clock, submission recording, the
 * result — is therefore exercised for real. Start the server with
 * GOBOXD_API_URL pointed at the stub; see the run instructions in the header.
 */
if (process.env.JUDGE === "real") {
  note("using the live goboxd judge (GOBOXD_AUTH_TOKEN must be set)");
} else {
  note("using the local stub judge — the server must be started with GOBOXD_API_URL=http://127.0.0.1:3999");
}

/* Both queue for real, exactly like two players clicking "Find a Match". */
const alphaJoin = api("/api/matchmaking/join", alpha.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
const bravoJoin = api("/api/matchmaking/join", bravo.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});

const [alphaRes, bravoRes] = await Promise.all([alphaJoin, bravoJoin]);
note(`alpha join -> ${alphaRes.status} ${JSON.stringify(alphaRes.json).slice(0, 120)}`);
note(`bravo join -> ${bravoRes.status} ${JSON.stringify(bravoRes.json).slice(0, 120)}`);

// Whichever side created the match knows it; the other finds it by status poll.
let matchId = alphaRes.json.matchId ?? bravoRes.json.matchId ?? null;

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

check("the two bots were matched into one match", Boolean(matchId), true);
if (!matchId) {
  console.log("\nno match formed; aborting");
  process.exit(1);
}
note(`match ${matchId}`);

const { data: matchRow } = await admin
  .from("matches")
  .select("metadata,status")
  .eq("id", matchId)
  .single();
const questionId = matchRow?.metadata?.question_id ?? null;
check("the match has a question", Boolean(questionId), true);
note(`question ${questionId}`);

const { data: seats } = await admin.from("match_players").select("user_id").eq("match_id", matchId);
check("both bots are seated", seats?.length, 2);

const seatIds = (seats ?? []).map((s) => s.user_id);

/* Both bots walk into the room: this is what starts the shared clock. */
const seatA = await api(`/api/match/${matchId}/sync`, alpha.token, {
  method: "POST",
  body: JSON.stringify({ presentUserIds: seatIds, presenceLive: true }),
});
const seatB = await api(`/api/match/${matchId}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({ presentUserIds: seatIds, presenceLive: true }),
});
check("the room opened once both seats arrived", seatB.json.phase !== "lobby", true);
check("a shared start instant was written", typeof seatB.json.startedAt, "string");
check("both clients read the SAME start instant", seatA.json.startedAt, seatB.json.startedAt);
check("both clients see the same countdown", seatA.json.countdownSeconds, seatB.json.countdownSeconds);
note(`started at ${seatB.json.startedAt}, phase ${seatB.json.phase}`);

// Judge refuses code until the shared clock actually begins.
const tooEarly = await api("/api/practice/submit", alpha.token, {
  method: "POST",
  body: JSON.stringify({
    questionId,
    code: SOLUTIONS[questionId] ?? SOLUTIONS["dede78a9-5c1e-4583-8447-030d0f7bad9c"],
    language: "javascript",
    intent: "submit",
    matchId,
  }),
});
note(`submit before the clock starts -> ${tooEarly.status} ${tooEarly.json.error ?? ""}`);

// Wait out the 3-2-1 lead-in.
await sleep(3200);

/* ---- Now the bots actually write and submit code. ---- */
const solution = SOLUTIONS[questionId];
if (!solution) {
  console.log(`\nno known solution for question ${questionId}; cannot battle`);
  process.exit(1);
}

const alphaSubmit = await api("/api/practice/submit", alpha.token, {
  method: "POST",
  body: JSON.stringify({ questionId, code: solution, language: "javascript", intent: "submit", matchId }),
});
note(`alpha submit -> ${alphaSubmit.status} ${JSON.stringify(alphaSubmit.json).slice(0, 300)}`);
check("alpha's correct solution passes the judge", alphaSubmit.json.passed, true);
check("alpha's submission is recorded as solved", alphaSubmit.json.solved, true);

const bravoSubmit = await api("/api/practice/submit", bravo.token, {
  method: "POST",
  body: JSON.stringify({ questionId, code: WRONG_SOLUTION, language: "javascript", intent: "submit", matchId }),
});
check("bravo's wrong solution fails the judge", bravoSubmit.json.passed, false);
check("bravo's wrong submission is NOT recorded as solved", bravoSubmit.json.solved ?? false, false);

/* The duel runs out of time; the server decides. */
await api("/api/match/timeout", alpha.token, {
  method: "POST",
  body: JSON.stringify({ matchId }),
});

const after = await api(`/api/match/${matchId}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({ presentUserIds: seatIds, presenceLive: true }),
});
check("the match is over", after.json.phase, "over");
check("the solver won", after.json.winnerId, alpha.id);
check("the result is flagged as a timeout", after.json.timedOut, true);

const { data: closed } = await admin.from("matches").select("status").eq("id", matchId).single();
check("the match is closed, not left active", closed?.status, "completed");

const ratingsAfter = {};
for (const who of [alpha, bravo]) {
  const { data } = await admin.from("users").select("rating,wins,losses").eq("id", who.id).single();
  ratingsAfter[who.id] = data;
}
check("the winner's rating went up", ratingsAfter[alpha.id].rating > ratingsBefore[alpha.id].rating, true);
check("the loser's rating went down", ratingsAfter[bravo.id].rating < ratingsBefore[bravo.id].rating, true);
check("the winner's win count incremented", ratingsAfter[alpha.id].wins, ratingsBefore[alpha.id].wins + 1);
check("the loser's loss count incremented", ratingsAfter[bravo.id].losses, ratingsBefore[bravo.id].losses + 1);
note(
  `alpha ${ratingsBefore[alpha.id].rating} -> ${ratingsAfter[alpha.id].rating}, ` +
  `bravo ${ratingsBefore[bravo.id].rating} -> ${ratingsAfter[bravo.id].rating}`,
);

/* The loser is told, and the winner is not re-settled twice. */
const bravoView = await api(`/api/match/${matchId}/sync`, bravo.token, {
  method: "POST",
  body: JSON.stringify({ presentUserIds: seatIds, presenceLive: true }),
});
check("the loser is told who won", bravoView.json.winnerId, alpha.id);

const replay = await api("/api/match/timeout", bravo.token, {
  method: "POST",
  body: JSON.stringify({ matchId }),
});
check("a second timeout does not re-award the win", replay.json.alreadyCompleted, true);

/* ---- And a decided match now refuses to hand out another seat. ---- */
const requeue = await api("/api/matchmaking/join", bravo.token, {
  method: "POST",
  body: JSON.stringify({ mode: "ranked", timeLimitSeconds: 300, matchType: "1v1" }),
});
check("a settled match is not handed back on re-queue", requeue.json.matchId === matchId, false);

/* Tidy up. */
await admin.from("match_attempts").delete().eq("match_id", matchId);
await admin.from("match_players").delete().eq("match_id", matchId);
await admin.from("matches").delete().eq("id", matchId);
await admin.from("matchmaking_queue").delete().eq("user_id", alpha.id);
await admin.from("matchmaking_queue").delete().eq("user_id", bravo.id);
await admin.from("practice_submissions").delete().eq("user_id", alpha.id);
await admin.from("practice_submissions").delete().eq("user_id", bravo.id);

console.log(failures === 0 ? "\nall checks passed — the bots really fought" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
