import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { createSupabaseServerClient } from "@/lib/supabase";
import { judgeCode, normalizeAppLanguage, SUPPORTED_LANGUAGES } from "@/lib/goboxd";
import { buildProgram, signatureFromMeta, type HarnessLang } from "@/lib/harness";

/*
 * Code execution uses goboxd, a self-hosted hardened sandbox service.
 * GOBOXD_API_URL (required) points at the goboxd server, e.g.
 * https://judge.example.com. A single POST /run runs the source against every
 * test case and returns a result per test, judged byte-exact.
 *
 * The `intent` field (run | submit) controls whether a passed submission is
 * recorded on the player's profile: only intent "submit" does. The response
 * carries both `passed` (all tests pass) and `solved` (all tests pass AND it
 * was a submit).
 */

const supportedLanguageSet = new Set(SUPPORTED_LANGUAGES);

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

  const { questionId, code, language, intent } = payload as {
    questionId?: string;
    code?: string;
    language?: string;
    intent?: "run" | "submit";
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

  let supabase;

  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    console.error("Supabase service client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
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

    return NextResponse.json(
      { error: "Unable to run code right now. Please try again in a moment." },
      { status: 502 },
    );
  }

  const { passed, results } = judged;
  const solved = passed && isSubmit;

  if (solved) {
    try {
      const authSupabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await authSupabase.auth.getUser();

      if (user?.id) {
        await supabase.from("practice_submissions").insert({
          user_id: user.id,
          question_id: questionId,
          language,
          passed: true,
        });
      }
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