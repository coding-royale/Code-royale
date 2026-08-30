/**
 * Code execution backend client for goboxd.
 *
 * goboxd is a hardened sandbox service (nsjail + seccomp + cgroups) that
 * compiles and runs untrusted code and judges it against test cases. A single
 * POST /run call accepts source code plus every test case and returns the
 * outcome for each one. This module adapts the goboxd API to Code Royale's
 * submission flow.
 *
 * Config:
 *   GOBOXD_API_URL  (required) — base URL of the self-hosted goboxd server,
 *   e.g. https://goboxd.nithitsuki.com (trailing slash is stripped).
 *   GOBOXD_AUTH_TOKEN (optional) — shared secret sent as `Authorization:
 *   Bearer <token>`. goboxd rejects requests without a valid bearer token when
 *   it is configured to require one (GOBOXD_AUTH_TOKEN set server-side). Leave
 *   unset to match a dev goboxd that has authentication disabled.
 *
 * Judging is STRICT (byte-exact): a run only passes when goboxd reports
 * "accepted", which requires stdout to exactly match the expected output
 * character for character. goboxd's "output_whitespace_mismatch" (identical
 * after trimming leading/trailing whitespace) and "wrong_output" both fail.
 */

const goboxdBaseUrl = (process.env.GOBOXD_API_URL ?? "").replace(/\/+$/, "");
const goboxdAuthToken = process.env.GOBOXD_AUTH_TOKEN ?? "";

export function getGoboxdBaseUrl(): string {
  if (!goboxdBaseUrl) {
    throw new Error("Missing GOBOXD_API_URL environment variable");
  }
  return goboxdBaseUrl;
}

/**
 * Maps Code Royale's canonical language identifiers to goboxd's registry ids.
 * The app exposes javascript/node, python, cpp, java and c. goboxd advertises
 * many more languages, but these are the ones the game offers.
 */
export const APP_LANGUAGE_TO_GOBOXD: Record<string, string> = {
  javascript: "js",
  node: "js",
  python: "py3",
  cpp: "cpp",
  java: "java",
  c: "c",
};

export const SUPPORTED_LANGUAGES = Object.freeze(Object.keys(APP_LANGUAGE_TO_GOBOXD));

/**
 * Normalizes a language identifier to the canonical form the game uses
 * internally. The client sends "node" for JavaScript (the DB stores
 * "javascript"); this collapses both to "node" so comparisons and lookups are
 * unambiguous.
 */
export function normalizeAppLanguage(language: string): string {
  return language === "javascript" ? "node" : language;
}

export function toGoboxdLanguage(language: string): string | null {
  return APP_LANGUAGE_TO_GOBOXD[language] ?? null;
}

export type GoboxdTestResult = {
  status: string;
  stdout: string;
  stderr: string;
  duration_ms: number;
  cpu_time_ms: number;
  memory_peak_kb: number;
  exit_code: number;
  termination_signal: number;
};

type GoboxdRunResponse = {
  status: string;
  build: {
    status: string;
    stdout: string;
    stderr: string;
    duration_ms: number;
    cpu_time_ms: number;
  };
  tests: GoboxdTestResult[];
};

export type CodeRunTestCase = {
  input: string;
  expected: string;
};

export type CodeRunResult = {
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

// Maps goboxd's closed status vocabulary to the human-readable status the
// frontend shows. Only "accepted" carries passed=true; every other value is a
// failure. Whitespace mismatches are explicitly treated as Wrong Answer
// because judging is byte-exact.
const GOBOXD_STATUS_TO_APP: Record<string, string> = {
  build_failed: "Compilation Error",
  internal_error: "Internal Error",
  runtime_error: "Runtime Error",
  time_exceeded: "Time Limit Exceeded",
  cpu_time_exceeded: "Time Limit Exceeded",
  memory_exceeded: "Memory Limit Exceeded",
  wrong_output: "Wrong Answer",
  output_whitespace_mismatch: "Wrong Answer",
  not_executed: "Not Executed",
  cancelled: "Cancelled",
};

function toTimeSeconds(durationMs: number): string | null {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }
  return (durationMs / 1000).toFixed(3);
}

/**
 * Sends the full submission (source + every test case) to goboxd in a single
 * POST /run and returns one CodeRunResult per test case, in test order.
 *
 * Runs all test cases; it does not stop at the first failure.
 *
 * Judging rules (bytes exact):
 *  - goboxd "accepted" (stdout === expected) → passed.
 *  - Everything else, including "output_whitespace_mismatch" and
 *    "wrong_output" → failed.
 *  - A test case with an empty expected output must produce exactly nothing.
 *    goboxd would treat empty `expected_stdout` as "accept any output", so we
 *    recompute that case ourselves from the returned stdout.
 *
 * Throws when the goboxd service itself fails (network, non-200 HTTP).
 */
export async function judgeCode(
  source: string,
  language: string,
  testcases: CodeRunTestCase[],
): Promise<{ passed: boolean; results: CodeRunResult[] }> {
  const goboxdLanguage = toGoboxdLanguage(language);
  if (!goboxdLanguage) {
    throw new Error(`Unsupported language for goboxd execution: ${language}`);
  }

  const baseUrl = getGoboxdBaseUrl();
  const controller = new AbortController();
  // goboxd runs every test case in one request; the wall-clock limit is per
  // test, so allow a generous window for the whole batch.
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let payload: GoboxdRunResponse;
  try {
    const response = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authenticate to goboxd when it requires a bearer token. Setting both
        // headers unconditionally is harmless when the token is empty, but we
        // omit Authorization to keep dev flows (auth disabled) byte-identical.
        ...(goboxdAuthToken ? { Authorization: `Bearer ${goboxdAuthToken}` } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        language: goboxdLanguage,
        source,
        max_parallel: 4,
        tests: testcases.map((testcase) => ({
          stdin: testcase.input,
          expected_stdout: testcase.expected,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`goboxd /run failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    payload = (await response.json()) as GoboxdRunResponse;
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const goboxdTests = Array.isArray(payload.tests) ? payload.tests : [];

  // When the build fails, goboxd returns every test as `not_executed` with an
  // empty stderr and puts the compiler output in build.stderr. Surface that
  // so the UI can show the real compiler/compile error instead of a generic
  // message.
  const buildFailed =
    payload.build?.status === "failed";
  const buildDiagnostics =
    buildFailed ? (payload.build.stderr || payload.build.stdout || null) : null;

  const results: CodeRunResult[] = testcases.map((testcase, index) => {
    const goboxdResult = goboxdTests[index];
    const expected = testcase.expected;
    const actual = goboxdResult?.stdout ?? "";
    const goboxdStatus = goboxdResult?.status ?? "internal_error";

    // Only a genuine goboxd "accepted" can ever pass (byte-exact judging).
    if (goboxdStatus !== "accepted") {
      // A top-level build failure marks every test `not_executed`. Surface it
      // as a Compilation Error with the compiler output instead of leaving the
      // test as a generic "not executed".
      const status = buildFailed
        ? "Compilation Error"
        : (GOBOXD_STATUS_TO_APP[goboxdStatus] ?? "Wrong Answer");
      let stderr = goboxdResult?.stderr ?? null;
      if (status === "Compilation Error" && !stderr && buildDiagnostics) {
        stderr = buildDiagnostics;
      }
      return {
        index,
        status,
        actual,
        stderr,
        time: toTimeSeconds(goboxdResult?.duration_ms ?? 0),
        memory: goboxdResult?.memory_peak_kb ?? null,
        passed: false,
        expected,
        input: testcase.input,
      };
    }

    // The program ran and goboxd accepted its output. With a non-empty
    // expected output, goboxd "accepted" is a byte-exact match, so pass.
    // With an empty expected output, goboxd treats it as "any output must
    // pass", so enforce the strict requirement that the program produce
    // exactly nothing.
    if (expected !== "") {
      return {
        index,
        status: "Accepted",
        actual,
        stderr: goboxdResult?.stderr ?? null,
        time: toTimeSeconds(goboxdResult?.duration_ms ?? 0),
        memory: goboxdResult?.memory_peak_kb ?? null,
        passed: true,
        expected,
        input: testcase.input,
      };
    }

    const passed = actual === "";
    return {
      index,
      status: passed ? "Accepted" : "Wrong Answer",
      actual,
      stderr: goboxdResult?.stderr ?? null,
      time: toTimeSeconds(goboxdResult?.duration_ms ?? 0),
      memory: goboxdResult?.memory_peak_kb ?? null,
      passed,
      expected,
      input: testcase.input,
    };
  });

  return {
    passed: results.length > 0 && results.every((result) => result.passed),
    results,
  };
}