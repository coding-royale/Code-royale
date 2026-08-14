"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";

/**
 * The "watch opponent" surface. Renders the opponent's editor with every word
 * blanked out — you see their typing rhythm, indentation and line growth, but
 * never their code.
 *
 * - `code` (bot battles): the opponent's REAL code, masked character by
 *   character. Updates as the bot types.
 * - no `code` (PvP): a simulated masked feed so the space still feels alive.
 */

const SNIPPET_POOL = [
  "function solve(raw) {",
  "  const nums = raw.trim().split(',').map(Number);",
  "  let total = 0;",
  "  for (const n of nums) {",
  "    if (n > 0) total += n;",
  "  }",
  "  return String(total);",
  "}",
  "const fs = require('fs');",
  "const input = fs.readFileSync(0, 'utf8').trim();",
  "process.stdout.write(String(solve(input)));",
  "def solve(raw: str) -> str:",
  "    lines = raw.strip().split('\\n')",
  "    total = sum(int(x) for x in lines[0].split(','))",
  "    return str(total)",
  "import sys",
  "int main() {",
  "    ios::sync_with_stdio(false);",
  "    cin.tie(nullptr);",
  "    string s;",
  "    cin >> s;",
  "    cout << s.size() << endl;",
  "    return 0;",
  "}",
  "class Solution {",
  "  public int solve(int[] nums) {",
  "    int sum = 0;",
  "    for (int n : nums) sum += n;",
  "    return sum;",
  "  }",
  "}",
];

const MAX_SIMULATED_LINES = 48;

function maskLine(line: string): string {
  return line.replace(/\S/g, "█");
}

type MaskedOpponentEditorProps = {
  opponentName?: string;
  code?: string;
};

export function MaskedOpponentEditor({
  opponentName = "Opponent",
  code,
}: MaskedOpponentEditorProps) {
  const realLines = code?.split("\n") ?? null;

  const [simulatedLines, setSimulatedLines] = useState<string[]>([]);
  const snippetIndexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Simulate typing only when we have no real code to mask (PvP matches).
  useEffect(() => {
    if (realLines) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const appendSnippet = () => {
      if (!alive) return;
      const snippet = SNIPPET_POOL[snippetIndexRef.current % SNIPPET_POOL.length];
      snippetIndexRef.current += 1;
      setSimulatedLines((prev) => {
        const next = [...prev, snippet];
        return next.length > MAX_SIMULATED_LINES ? next.slice(next.length - MAX_SIMULATED_LINES) : next;
      });
      timer = setTimeout(appendSnippet, 700 + Math.random() * 1800);
    };

    timer = setTimeout(appendSnippet, 400 + Math.random() * 800);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [realLines]);

  // Keep the newest lines in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [realLines?.length, simulatedLines.length]);

  const lines = realLines ?? simulatedLines;
  const lineCount = lines.length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Eye className="size-3.5" />
          Watching {opponentName}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{lineCount} lines</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-muted-foreground">
          {lines.map((line, index) => (
            <div key={index} className="flex">
              <span className="mr-3 w-6 shrink-0 select-none text-right text-[10px] text-muted-foreground/40">
                {index + 1}
              </span>
              <span className="break-all">{maskLine(line) || " "}</span>
            </div>
          ))}
          <span className="inline-block h-[1em] w-[0.55em] translate-y-[2px] animate-pulse bg-foreground/70" />
        </pre>
      </div>
    </div>
  );
}
