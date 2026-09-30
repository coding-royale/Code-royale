/**
 * Local stand-in for the goboxd code-execution sandbox, used only by
 * `duel-battle.mjs` when GOBOXD_AUTH_TOKEN is not available locally.
 *
 * It implements the same POST /run contract the real judge does — same request
 * shape, same byte-exact "accepted" / "wrong_output" statuses — and it really
 * executes the submitted JavaScript in a child process. It is NOT a security
 * sandbox and must never be used to judge untrusted code in production; it only
 * exists so a duel can be driven end to end on a developer machine.
 *
 * Start it with: bun scripts/stub-judge.mjs [port]
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const port = Number(process.argv[2] || 3999);

const server = createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.endsWith("/run")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "bad json" }));
      return;
    }

    const source = String(payload.source ?? "");
    const tests = Array.isArray(payload.tests) ? payload.tests : [];

    if (payload.language !== "js") {
      // Only JS is implemented; the duel harness only submits JS.
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          build: { status: "failed", stdout: "", stderr: "stub judge only runs js", duration_ms: 0, cpu_time_ms: 0 },
          tests: tests.map(() => ({ status: "not_executed", stdout: "", stderr: "", duration_ms: 0, cpu_time_ms: 0, memory_peak_kb: 0, exit_code: 0, termination_signal: 0 })),
        }),
      );
      return;
    }

    // The harness wraps `solve` in a stdin/stdout driver already, so the source
    // is a complete program. Feed each test case on stdin and capture stdout.
    const results = [];
    for (const test of tests) {
      const stdout = await runJs(source, String(test.stdin ?? ""));
      const expected = String(test.expected_stdout ?? "");
      const accepted = stdout === expected;
      results.push({
        status: accepted ? "accepted" : "wrong_output",
        stdout,
        stderr: "",
        duration_ms: 1,
        cpu_time_ms: 1,
        memory_peak_kb: 0,
        exit_code: 0,
        termination_signal: 0,
      });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: results.every((r) => r.status === "accepted") ? "accepted" : "wrong_output",
        build: { status: "ok", stdout: "", stderr: "", duration_ms: 0, cpu_time_ms: 0 },
        tests: results,
      }),
    );
  });
});

function runJs(source, stdin) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", source], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill(), 5000);
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("close", () => {
      clearTimeout(timer);
      // goboxd reports the raw stdout; a runtime error surfaces as empty output.
      resolve(err ? "" : out);
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

server.listen(port, () => {
  console.log(`stub judge listening on http://127.0.0.1:${port}`);
});
