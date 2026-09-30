import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { createSupabaseServerClient } from "@/lib/supabase";
import { judgeCode, normalizeAppLanguage, SUPPORTED_LANGUAGES } from "@/lib/goboxd";
import { buildProgram, signatureFromMeta, type HarnessLang } from "@/lib/harness";
import { checkSubmitRateLimit } from "@/lib/submit-rate-limit";

/*
 * Code execution uses goboxd, a self-hosted hardened sandbox service.
 * GOBOXD_API_URL (required) points at the goboxd server, e.g.
 * https://goboxd.nithitsuki.com. A single POST /run runs the source against
 * every test case and returns a result per test, judged byte-exact.
 *
 * The endpoint is authenticated: only signed-in players may execute code, so
 * the per-user submission rate limit (submit-rate-limit.ts / the
 * `bump_submit_rate` RPC) can key on the real `user_id` instead of an IP.
 * Both the `run` and `submit` intents execute code, so both consume the user's
 * submission budget.
 *
 * The `intent` field (run | submit) controls whether a passed submission is
 * recorded on the player's profile: only intent "submit" does. The response
 * carries both `passed` (all tests pass) and `solved` (all tests pass AND it
 * was a submit).
 */

const supportedLanguageSet = new Set(SUPPORTED_LANGUAGES);

function getUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf-8");
    const data = JSON.parse(json);
    return typeof data.sub === "string" ? data.sub : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Invalid JSON payload", error);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { questionId, code, language, intent, matchId } = payload as {
    questionId?: string;
    code?: string;
    language?: string;
    intent?: "run" | "submit";
    matchId?: string;
  };

  if (!questionId || !code || !language) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isSubmit = intent === "submit";

  // Collapse "javascript" and "node" to the canonical "node" so the supported
  // set and per-question allow-list can be compared unambiguously.
  const normalizedLanguage = normalizeAppLanguage(language);

  if (!supportedLanguageSet.has(normalizedLanguage)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  // Non-anonymous rate limiting needs a real identity. Require auth before any
  // further work (and before any code execution) so anonymous callers cannot
  // consume compute or hide behind a rotating IP.
  // A Bearer token is accepted first so bots and API tests can drive a real
  // duel end to end; browsers keep using the session cookie.
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    userId = getUserIdFromToken(authHeader.slice(7));
  }
  if (!userId) {
    const authSupabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await authSupabase.auth.getUser();
    if (!authError && authData.user?.id) userId = authData.user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;

  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  /*
   * Inside a duel, only a seated player may run code, and only once the shared
   * clock has actually started. Without this, anyone could log attempts into
   * somebody else's match and pre-empt the room gate by submitting during the
   * lobby.
   */
  const trimmedMatchId = typeof matchId === "string" ? matchId.trim() : "";
  let liveMatchId: string | null = null;
  if (trimmedMatchId) {
    const { data: membership } = await supabase
      .from("match_players")
      .select("match_id")
      .eq("match_id", trimmedMatchId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a participant in this match" }, { status: 403 });
    }

    const { data: matchRow } = await supabase
      .from("matches")
      .select("metadata")
      .eq("id", trimmedMatchId)
      .maybeSingle();

    const meta =
      matchRow?.metadata && typeof matchRow.metadata === "object"
        ? (matchRow.metadata as Record<string, unknown>)
        : {};
    const startedAt = typeof meta.started_at === "string" ? meta.started_at : null;
    const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;

    if (!Number.isFinite(startedMs)) {
      return NextResponse.json({ error: "Match has not started" }, { status: 409 });
    }
    if (Date.now() < startedMs) {
      return NextResponse.json({ error: "Match has not started" }, { status: 409 });
    }
    liveMatchId = trimmedMatchId;
  }

  const { data: question, error: questionError } = await supabase
    .from("practice_questions")
    .select("id,languages,testcases,meta")
    .eq("id", questionId)
    .single();

  if (questionError || !question) {
    console.error("Question lookup failed", questionError);
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const allowedLanguages = Array.isArray(question.languages)
    ? (question.languages as string[])
    : [];

  // The allow-list can store either "javascript" or "node"; normalize both
  // sides so a "node" submission is not wrongly rejected.
  const normalizedAllowed = new Set(allowedLanguages.map(normalizeAppLanguage));

  if (allowedLanguages.length && !normalizedAllowed.has(normalizedLanguage)) {
    return NextResponse.json({ error: "Language not allowed for this question" }, { status: 400 });
  }

  const rawTestcases = Array.isArray(question.testcases)
    ? (question.testcases as Array<{ id?: string; input?: string; output?: string; stdin?: string; expected_output?: string }>)
    : [];

  let normalizedTestcases = rawTestcases.map((testcase, index) => ({
    id: testcase.id ?? `${question.id}-case-${index + 1}`,
    input: testcase.input ?? testcase.stdin ?? "",
    expected: testcase.output ?? testcase.expected_output ?? "",
    index,
  }));

  if (normalizedTestcases.length === 0) {
    const { data: legacyTestcases } = await supabase
      .from("practice_testcases")
      .select("id,stdin,expected_output")
      .eq("question_id", questionId)
      .order("id", { ascending: true });

    normalizedTestcases = (legacyTestcases ?? []).map((testcase, index) => ({
      id: String(testcase.id ?? `${question.id}-legacy-${index + 1}`),
      input: testcase.stdin ?? "",
      expected: testcase.expected_output ?? "",
      index,
    }));
  }

  if (normalizedTestcases.length === 0) {
    console.error("No testcases configured for question", question.id);
    return NextResponse.json({ error: "No testcases configured" }, { status: 500 });
  }

  // Problems with a LeetCode-style signature get their `solve` wrapped in a
  // hidden stdin/stdout harness; others are submitted as-is.
  const signature = signatureFromMeta(question.meta);
  const source = signature
    ? buildProgram(normalizeAppLanguage(language) as HarnessLang, signature, code)
    : code;

  // Per-user (non-anonymous) rate limit. Consumes budget on every request that
  // reaches code execution (both run and submit intents), so a malicious or
  // compromised session can't saturate goboxd. Keyed by user_id, not IP.
  const rateLimit = await checkSubmitRateLimit(userId);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Submission rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.resetAfterSeconds) },
      },
    );
  }

  let judged;
  try {
    judged = await judgeCode(
      source,
      language,
      normalizedTestcases.map((testcase) => ({
        input: testcase.input,
        expected: testcase.expected,
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("goboxd execution failed", message);

    if (message.includes("GOBOXD_API_URL")) {
      return NextResponse.json(
        { error: "Code execution is not configured. Set GOBOXD_API_URL and try again." },
        { status: 502 },
      );
    }

    // Surface the underlying judge error (HTTP status + goboxd's response
    // body) alongside the friendly message so a misconfigured token, a
    // saturated judge, or a tunnel outage is diagnosable from the UI instead
    // of collapsing into a generic "try again".
    return NextResponse.json(
      {
        error: "Unable to run code right now. Please try again in a moment.",
        detail: message.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const { passed, results } = judged;
  const solved = passed && isSubmit;

  // Match activity feed: every run/submit inside a match is logged so the
  // opponent can see real progress (attempts, best, last active).
  if (liveMatchId) {
    try {
      const passedCount = results.filter((r) => r.passed).length;
      await supabase.from("match_attempts").insert({
        match_id: liveMatchId,
        user_id: userId,
        passed: passedCount,
        total: results.length,
      });
    } catch {
      // ignore tracking failures — never break a submission
    }
  }

  if (solved) {
    try {
      // Reuse the authenticated user already resolved earlier in this request;
      // no second session fetch is needed.
      await supabase.from("practice_submissions").insert({
        user_id: userId,
        question_id: questionId,
        language,
        passed: true,
      });
    } catch {
      // ignore tracking failures
    }
  }

  return NextResponse.json({
    passed,
    solved,
    results,
  });
}