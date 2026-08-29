/**
 * Shared code editor scaffolding for Code Royale.
 *
 * Every template reads stdin, splits it into whitespace-separated tokens, and
 * passes those to `solve(...)` — not a raw string. `solve` must return the
 * EXACT output (no trailing newline); the template writes it to stdout
 * verbatim, because judging is strict and byte-exact.
 */

export const languageLabels: Record<string, string> = {
  node: "JavaScript (Node)",
  javascript: "JavaScript (Node)",
  python: "Python 3",
  cpp: "C++",
  java: "Java",
  c: "C",
};

export const codeTemplates: Record<string, string> = {
  node: `// \`data\` holds the whitespace-split input, e.g. "3 4" -> ["3", "4"].
// Adapt the parsing if the problem uses JSON, CSV or multi-line input.
// Return the EXACT output string (no trailing newline).
function solve(data) {
  return "";
}

const fs = require('fs');
const raw = fs.readFileSync(0, 'utf8').trim();
const data = raw ? raw.split(/\\s+/) : [];
process.stdout.write(String(solve(data)));`,
  javascript: `// \`data\` holds the whitespace-split input, e.g. "3 4" -> ["3", "4"].
// Adapt the parsing if the problem uses JSON, CSV or multi-line input.
// Return the EXACT output string (no trailing newline).
function solve(data) {
  return "";
}

const fs = require('fs');
const raw = fs.readFileSync(0, 'utf8').trim();
const data = raw ? raw.split(/\\s+/) : [];
process.stdout.write(String(solve(data)));`,
  python: `# \`data\` holds the whitespace-split input, e.g. "3 4" -> ["3", "4"].
# Adapt the parsing if the problem uses JSON, CSV or multi-line input.
# Return the EXACT output string (no trailing newline).
import sys

def solve(data: list[str]) -> str:
    return ""

def main() -> None:
    data: list[str] = sys.stdin.read().split()
    sys.stdout.write(solve(data))

if __name__ == "__main__":
    main()`,
  cpp: `// \`data\` holds the whitespace-split input tokens.
// Adapt the parsing if the problem uses JSON, CSV or multi-line input.
// Return the EXACT output string (no trailing newline).
#include <bits/stdc++.h>
using namespace std;

string solve(const vector<string>& data) {
    return "";
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    vector<string> data;
    string token;
    while (cin >> token) data.push_back(token);
    cout << solve(data);
    return 0;
}`,
  java: `// \`data\` holds the whitespace-split input tokens.
// Adapt the parsing if the problem uses JSON, CSV or multi-line input.
// Return the EXACT output string (no trailing newline).
import java.io.*;
import java.util.*;

public class Main {
  static String solve(List<String> data) {
    return "";
  }

  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {
      String line;
      while ((line = br.readLine()) != null) sb.append(line).append('\\n');
    }
    StringTokenizer st = new StringTokenizer(sb.toString());
    List<String> data = new ArrayList<>();
    while (st.hasMoreTokens()) data.add(st.nextToken());
    System.out.print(solve(data));
  }
}`,
  c: `// \`data\` holds up to \`n\` whitespace-split input tokens.
// Adapt the parsing if the problem uses JSON, CSV or multi-line input.
// Write the EXACT output string (no trailing newline) into \`out\`.
#include <stdio.h>
#include <string.h>

void solve(int n, char data[][64], char out[]) {
    out[0] = '\\0';
}

int main(void) {
    char data[1024][64];
    int n = 0;
    char token[64];
    while (n < 1024 && scanf("%63s", token) == 1) {
        strcpy(data[n++], token);
    }
    char out[8192];
    solve(n, data, out);
    printf("%s", out);
    return 0;
}`,
};

export const normalizeLanguage = (language: string): string =>
  language === "javascript" ? "node" : language;

export function buildTemplate(language: string, title?: string): string {
  const key = normalizeLanguage(language);
  const template = codeTemplates[key];
  if (!template) {
    return title ? `// ${title}\n// Write your solution here\n` : "// Write your solution here\n";
  }
  return template;
}