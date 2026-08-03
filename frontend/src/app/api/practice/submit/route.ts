import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { createSupabaseServerClient } from "@/lib/supabase";

/*
 * Code execution uses Judge0.
 * - By default it points at https://ce.judge0.com (free public instance, no API key).
 * - If JUDGE0_API_KEY is set, it switches to the RapidAPI Judge0 instance using
 *   JUDGE0_BASE_URL / JUDGE0_API_HOST from the environment.
 * Language IDs are resolved by name so it works on either instance.
 */

const languageNamePatterns: Record<string, string[]> = {
  node: ["JavaScript (Node.js 18.15.0)", "JavaScript (Node.js"],
  javascript: ["JavaScript (Node.js 18.15.0)", "JavaScript (Node.js"],
  python: ["Python (3.10.0)", "Python (3.", "Python 3"],
  cpp: ["C++ (GCC", "C++"],
  java: ["Java (OpenJDK"],
  c: ["C (GCC", "C (Clang"],
};

const fallbackLanguageIds: Record<string, number> = {
  node: 93,
  javascript: 93,
  python: 71,
  cpp: 52,
  java: 62,
  c: 48,
};

const judge0BaseUrl = (process.env.JUDGE0_BASE_URL ?? "https://ce.judge0.com").replace(/\/+$/, "");
const judge0ApiKey = process.env.JUDGE0_API_KEY ?? "";
const judge0ApiHost = process.env.JUDGE0_API_HOST ?? "judge0-ce.p.rapidapi.com";

let cachedLanguages: { baseUrl: string; fetchedAt: number; items: Array<{ id: number; name: string }> } | null = null;
const LANGUAGE_CACHE_TTL_MS = 60 * 60 * 1000;

function buildHeaders(): Record<string, string> {
  if (judge0ApiKey) {
    return {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": judge0ApiKey,
      "X-RapidAPI-Host": judge0ApiHost,
    };
  }
  return { "Content-Type": "application/json" };
}

async function fetchLanguages(): Promise<Array<{ id: number; name: string }>> {
  if (
    cachedLanguages &&
    cachedLanguages.baseUrl === judge0BaseUrl &&
    Date.now() - cachedLanguages.fetchedAt < LANGUAGE_CACHE_TTL_MS
  ) {
    return cachedLanguages.items;
  }

  try {
    const response = await fetch(`${judge0BaseUrl}/languages`, {
      headers: buildHeaders(),
      cache: "no-store",
    });
    if (response.ok) {
      const items = (await response.json()) as Array<{ id: number; name: string }>;
      cachedLanguages = { baseUrl: judge0BaseUrl, fetchedAt: Date.now(), items };
      return items;
    }
  } catch {
    // fall through to fallback IDs
  }

  return [];
}

async function resolveLanguageId(language: string): Promise<number> {
  const patterns = languageNamePatterns[language];
  if (patterns) {
    const languages = await fetchLanguages();
    for (const pattern of patterns) {
      const match = languages.find((entry) => entry.name.startsWith(pattern));
      if (match) return match.id;
    }
  }
  return fallbackLanguageIds[language] ?? 93;
}

type SubmissionStatus = {
  index: number;
  status: string;
  actual: string;
  stderr: string | null;
  time: string | null;
  memory: number | null;
  passed: boolean;
  expected: string;
  input: string;
};

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

  const { questionId, code, language } = payload as {
    questionId?: string;
    code?: string;
    language?: string;
  };

  if (!questionId || !code || !language) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!languageNamePatterns[language]) {
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
    .select("id,languages,testcases")
    .eq("id", questionId)
    .single();

  if (questionError || !question) {
    console.error("Question lookup failed", questionError);
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const allowedLanguages = Array.isArray(question.languages)
    ? (question.languages as string[])
    : [];

  if (allowedLanguages.length && !allowedLanguages.includes(language)) {
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

  let languageId: number;
  try {
    languageId = await resolveLanguageId(language);
  } catch (error) {
    console.error("Failed to resolve language id", error);
    return NextResponse.json(
      { error: "Unable to run code right now. Please try again in a moment." },
      { status: 502 },
    );
  }

  const results: SubmissionStatus[] = [];

  for (const testcase of normalizedTestcases) {
    let submission: {
      stdout?: string;
      stderr?: string;
      compile_output?: string;
      status?: { id?: number; description?: string };
      time?: string;
      memory?: number;
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(
        `${judge0BaseUrl}/submissions?base64_encoded=false&wait=true`,
        {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({
            language_id: languageId,
            source_code: code,
            stdin: testcase.input,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        console.error("Judge0 submission error", response.status, await response.text());
        return NextResponse.json(
          { error: "Unable to run code right now. Please try again in a moment." },
          { status: 502 },
        );
      }

      submission = (await response.json()) as typeof submission;
    } catch (error) {
      console.error("Judge0 request error", error);
      return NextResponse.json(
        { error: "Unable to run code right now. Please try again in a moment." },
        { status: 502 },
      );
    }

    const stdout = submission.stdout ?? "";
    const stderr = submission.stderr ?? submission.compile_output ?? null;

    const cleanExpected = testcase.expected.trim().replace(/\r\n/g, "\n");
    const cleanActual = stdout.trim().replace(/\r\n/g, "\n");

    const statusCode = submission.status?.id ?? 0;
    const isCompileError = statusCode === 6;
    const isRuntimeError = statusCode >= 11 && statusCode <= 12;
    const isTimeLimitExceeded = statusCode === 5;
    const isAccepted = statusCode === 3;

    const passed = isAccepted && cleanActual === cleanExpected;
    const status = isCompileError
      ? "Compilation Error"
      : isTimeLimitExceeded
        ? "Time Limit Exceeded"
        : isRuntimeError
          ? "Runtime Error"
          : passed
            ? "Accepted"
            : "Wrong Answer";

    results.push({
      index: testcase.index,
      status,
      actual: stdout,
      stderr,
      time: submission.time ?? null,
      memory: submission.memory ?? null,
      passed,
      expected: testcase.expected,
      input: testcase.input,
    });

    if (!passed) {
      break;
    }
  }

  const allPassed = results.length > 0 && results.every((result) => result.passed);

  if (allPassed) {
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
    passed: allPassed,
    results,
  });
}
