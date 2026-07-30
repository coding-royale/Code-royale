import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { createSupabaseServerClient } from "@/lib/supabase";

const languageMap: Record<string, { language: string; version: string; judge0Id: number }> = {
  node: { language: "javascript", version: "18.15.0", judge0Id: 78 },
  javascript: { language: "javascript", version: "18.15.0", judge0Id: 78 },
  python: { language: "python", version: "3.10.0", judge0Id: 71 },
  cpp: { language: "c++", version: "10.2.0", judge0Id: 76 },
  java: { language: "java", version: "15.0.2", judge0Id: 62 },
  c: { language: "c", version: "10.2.0", judge0Id: 75 },
};

const judge0BaseUrl = process.env.JUDGE0_BASE_URL?.replace(/\/+$/, "") ?? "https://judge0-ce.p.rapidapi.com";
const judge0ApiKey = process.env.JUDGE0_API_KEY ?? "";
const judge0ApiHost = process.env.JUDGE0_API_HOST ?? "judge0-ce.p.rapidapi.com";

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

  if (!languageMap[language]) {
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

  const results = [] as Array<{
    index: number;
    status: string;
    actual: string;
    stderr: string | null;
    time: string | null;
    memory: number | null;
    passed: boolean;
    expected: string;
    input: string;
  }>;

  for (const testcase of normalizedTestcases) {
    try {
      const runConfig = languageMap[language];

      if (!judge0ApiKey) {
        return NextResponse.json(
          { error: "Code execution is not configured. Set JUDGE0_API_KEY in .env.local (get a free key at https://judge0-ce.p.rapidapi.com)." },
          { status: 500 },
        );
      }

      const response = await fetch(
        `${judge0BaseUrl}/submissions?base64_encoded=false&wait=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": judge0ApiKey,
            "X-RapidAPI-Host": judge0ApiHost,
          },
          body: JSON.stringify({
            language_id: runConfig.judge0Id,
            source_code: code,
            stdin: testcase.input,
          }),
        },
      );

      if (!response.ok) {
        const message = await response.text();
        console.error("Judge0 submission error", message, "Status:", response.status);
        
        let errorMessage = "Code execution failed";
        try {
          const parsed = JSON.parse(message);
          if (parsed.message) {
            errorMessage = parsed.message;
          } else if (parsed.error) {
            errorMessage = parsed.error;
          }
        } catch (_) {
          if (message) errorMessage = message;
        }
        
        return NextResponse.json({ error: errorMessage }, { status: 502 });
      }

      const submission = (await response.json()) as {
        stdout?: string;
        stderr?: string;
        compile_stderr?: string;
        status?: { id?: number; description?: string };
        time?: string;
        memory?: number;
      };

      const stdout = submission.stdout ?? "";
      const stderr = submission.stderr ?? submission.compile_stderr ?? null;
      
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
        : isRuntimeError || isTimeLimitExceeded
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
    } catch (error) {
      console.error("Judge0 request error", error);
      return NextResponse.json({ error: "Code execution request failed" }, { status: 502 });
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
        // Best-effort write for user progress; do not fail submission response on tracking issues.
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
