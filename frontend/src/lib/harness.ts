/**
 * LeetCode-style execution harness for Code Royale.
 *
 * Each problem declares a signature (param types + return type). The editor
 * shows only a clean `def solve(...)`-style function; the harness (generated
 * here, hidden from the user) reads stdin, decodes it into the parameters,
 * calls `solve`, and writes the result to stdout byte-exact.
 *
 * Input decoding conventions (from the problem's stored testcases):
 *  - single `int`            -> first whitespace token
 *  - single `str`            -> the whole trimmed input
 *  - single `list[int]`      -> all tokens as ints (no length prefix)
 *  - `list[int]` + scalars   -> length-prefixed: n, then n ints, then the scalars
 *  - only scalars             -> tokens consumed in order
 *  - `str, str`               -> first token, then the remaining tokens joined
 *
 * Return serialization:
 *  - int -> decimal string; str -> as-is; list[int] -> space-joined; bool -> "true"/"false"
 */

export type HarnessParamType = "int" | "str" | "list[int]";
export type HarnessReturnType = "int" | "str" | "list[int]" | "bool";
export type HarnessParam = { name: string; type: HarnessParamType };
export type HarnessSignature = { params: HarnessParam[]; returns: HarnessReturnType };

export type HarnessLang = "node" | "python" | "cpp" | "java" | "c";

const returnPlaceholder: Record<HarnessReturnType, string> = {
  int: "0",
  str: '""',
  "list[int]": "[]",
  bool: "false",
};

/** Reads a signature from question meta (returns null when absent/unsupported). */
export function signatureFromMeta(meta: unknown): HarnessSignature | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const sig = m.signature;
  if (!sig || typeof sig !== "object") return null;
  const s = sig as Record<string, unknown>;
  const params = Array.isArray(s.params) ? s.params : [];
  const returns = s.returns as HarnessReturnType | undefined;
  if (params.length === 0 || !returns) return null;
  const typedParams: HarnessParam[] = [];
  for (const p of params) {
    if (!p || typeof p !== "object") return null;
    const pp = p as Record<string, unknown>;
    const type = pp.type as HarnessParamType | undefined;
    if (type !== "int" && type !== "str" && type !== "list[int]") return null;
    if (typeof pp.name !== "string" || !pp.name) return null;
    typedParams.push({ name: pp.name, type });
  }
  if (returns !== "int" && returns !== "str" && returns !== "list[int]" && returns !== "bool") return null;
  return { params: typedParams, returns };
}

const typesOnly = (sig: HarnessSignature) => sig.params.map((p) => p.type);
const names = (sig: HarnessSignature) => sig.params.map((p) => p.name);

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function pyType(t: HarnessParamType): string {
  return t === "list[int]" ? "list[int]" : t;
}
function pyParamList(sig: HarnessSignature): string {
  return sig.params.map((p) => `${p.name}: ${pyType(p.type)}`).join(", ");
}

function pyDecode(sig: HarnessSignature): string {
  const t = typesOnly(sig);
  const n = names(sig);
  if (t.length === 1) {
    if (t[0] === "list[int]") return `${n[0]} = list(map(int, _tokens))`;
    if (t[0] === "int") return `${n[0]} = int(_tokens[0])`;
    return `${n[0]} = _raw.strip()`;
  }
  if (t[0] === "list[int]") {
    // length-prefixed: n, list, then scalars
    const lines: string[] = [`_n = int(_tokens[0])`, `${n[0]} = list(map(int, _tokens[1:1 + _n]))`];
    for (let i = 1; i < n.length; i++) {
      lines.push(`${n[i]} = int(_tokens[1 + _n + ${i - 1}])`);
    }
    return lines.join("\n    ");
  }
  // scalar sequence
  const lines: string[] = [];
  for (let i = 0; i < n.length; i++) {
    if (t[i] === "int") lines.push(`${n[i]} = int(_tokens[${i}])`);
    else if (t[i] === "str")
      lines.push(
        i === n.length - 1 ? `${n[i]} = " ".join(_tokens[${i}:])` : `${n[i]} = _tokens[${i}]`,
      );
  }
  return lines.join("\n    ");
}

function pySerialize(ret: HarnessReturnType): string {
  switch (ret) {
    case "int":
      return "_code_royale_out = str(_result)";
    case "str":
      return "_code_royale_out = _result";
    case "list[int]":
      return '_code_royale_out = " ".join(map(str, _result))';
    case "bool":
      return '_code_royale_out = "true" if _result else "false"';
  }
}

export function buildPythonProgram(userSolve: string, sig: HarnessSignature): string {
  const decode = pyDecode(sig);
  const serialize = pySerialize(sig.returns);
  return `import sys

${userSolve}

def _code_royale_main() -> None:
    _raw = sys.stdin.read()
    _tokens = _raw.split()
    ${decode}
    _result = solve(${names(sig).join(", ")})
    ${serialize}
    sys.stdout.write(_code_royale_out)

if __name__ == "__main__":
    _code_royale_main()
`;
}

export function buildPythonTemplate(sig: HarnessSignature): string {
  return `def solve(${pyParamList(sig)}) -> ${sig.returns === "list[int]" ? "list[int]" : sig.returns}:
    # Inputs are already parsed. Return the exact result; the judge compares
    # your output byte-for-byte.
    return ${returnPlaceholder[sig.returns]}\n`;
}

// ---------------------------------------------------------------------------
// JavaScript / Node
// ---------------------------------------------------------------------------

function jsType(t: HarnessParamType): string {
  return t === "list[int]" ? "number[]" : "number";
}
function jsParamList(sig: HarnessSignature): string {
  return sig.params.map((p) => p.name).join(", ");
}
const jsDocType = (t: HarnessParamType | HarnessReturnType): string =>
  t === "list[int]" ? "number[]" : t === "str" ? "string" : "number";

function jsDecode(sig: HarnessSignature): string {
  const t = typesOnly(sig);
  const n = names(sig);
  if (t.length === 1) {
    if (t[0] === "list[int]") return `const ${n[0]} = _tokens.map(Number);`;
    if (t[0] === "int") return `const ${n[0]} = Number(_tokens[0]);`;
    return `const ${n[0]} = _raw.trim();`;
  }
  if (t[0] === "list[int]") {
    const lines: string[] = [
      `const _n = Number(_tokens[0]);`,
      `const ${n[0]} = _tokens.slice(1, 1 + _n).map(Number);`,
    ];
    for (let i = 1; i < n.length; i++) lines.push(`const ${n[i]} = Number(_tokens[1 + _n + ${i - 1}]);`);
    return lines.join("\n  ");
  }
  const lines: string[] = [];
  for (let i = 0; i < n.length; i++) {
    if (t[i] === "int") lines.push(`const ${n[i]} = Number(_tokens[${i}]);`);
    else if (t[i] === "str")
      lines.push(i === n.length - 1 ? `const ${n[i]} = _tokens.slice(${i}).join(" ");` : `const ${n[i]} = _tokens[${i}];`);
  }
  return lines.join("\n  ");
}

export function buildNodeProgram(userSolve: string, sig: HarnessSignature): string {
  const decode = jsDecode(sig);
  const serialize = jsSerialize(sig.returns);
  return `function _code_royale_main() {
  const fs = require('fs');
  const _raw = fs.readFileSync(0, 'utf8');
  const _tokens = _raw.trim() ? _raw.trim().split(/\\s+/) : [];
  ${decode}
  const _result = solve(${names(sig).join(", ")});
  ${serialize}
  process.stdout.write(_code_royale_out);
}
${userSolve}
_code_royale_main();
`;
}

function jsSerialize(ret: HarnessReturnType): string {
  switch (ret) {
    case "int":
      return "const _code_royale_out = String(_result);";
    case "str":
      return "const _code_royale_out = String(_result);";
    case "list[int]":
      return "const _code_royale_out = _result.map(Number).join(' ');";
    case "bool":
      return "const _code_royale_out = _result ? 'true' : 'false';";
  }
}

function jsDoc(sig: HarnessSignature): string {
  const lines = ["/**"];
  for (const p of sig.params) lines.push(` * @param {${jsDocType(p.type)}} ${p.name}`);
  lines.push(` * @returns {${jsDocType(sig.returns)}}`);
  lines.push(" */");
  return lines.join("\n");
}

export function buildNodeTemplate(sig: HarnessSignature): string {
  return `${jsDoc(sig)}
function solve(${jsParamList(sig)}) {
  // Inputs are already parsed. Return the exact result; the judge compares
  // your output byte-for-byte.
  return ${returnPlaceholder[sig.returns]};
}\n`;
}

// ---------------------------------------------------------------------------
// Tepl = "template"; users edit only the function. The harness (`buildProgram`)
// is prepended/`appended around the user function with includes/entry points.
// ---------------------------------------------------------------------------

export function buildTemplate(language: HarnessLang, sig: HarnessSignature): string {
  switch (language) {
    case "python":
      return buildPythonTemplate(sig);
    case "node":
      return buildNodeTemplate(sig);
    case "cpp":
      return buildCppTemplate(sig);
    case "c":
      return buildCTemplate(sig);
    case "java":
      return buildJavaTemplate(sig);
  }
}

export function buildProgram(
  language: HarnessLang,
  sig: HarnessSignature,
  userSolve: string,
): string {
  switch (language) {
    case "python":
      return buildPythonProgram(userSolve, sig);
    case "node":
      return buildNodeProgram(userSolve, sig);
    case "cpp":
      return buildCppProgram(userSolve, sig);
    case "c":
      return buildCProgram(userSolve, sig);
    case "java":
      return buildJavaProgram(userSolve, sig);
  }
}

// ---------------------------------------------------------------------------
// C++
// ---------------------------------------------------------------------------

function cppType(t: HarnessParamType): string {
  return t === "list[int]" ? "vector<int>& " /* handled below */ : t === "int" ? "int" : "string";
}
function cppParamList(sig: HarnessSignature): string {
  return sig.params
    .map((p) => (p.type === "list[int]" ? `vector<int>& ${p.name}` : `${cppType(p.type)} ${p.name}`))
    .join(", ");
}
function cppRet(ret: HarnessReturnType): string {
  return ret === "list[int]" ? "vector<int>" : ret === "str" ? "string" : ret === "bool" ? "bool" : "long long";
}

export function buildCppTemplate(sig: HarnessSignature): string {
  return `// Inputs are already parsed. Return the exact result; the judge compares
// your output byte-for-byte.
${cppRet(sig.returns)} solve(${cppParamList(sig)}) {
    ${sig.returns === "list[int]" ? `return {};` : `return ${returnPlaceholder[sig.returns]};`}
}\n`;
}

export function buildCppProgram(userSolve: string, sig: HarnessSignature): string {
  const t = typesOnly(sig);
  const n = names(sig);

  let decl = "";
  for (const p of sig.params) {
    if (p.type === "list[int]") decl += `    vector<int> ${p.name};\n`;
    else if (p.type === "int") decl += `    long long ${p.name};\n`;
    else decl += `    string ${p.name};\n`;
  }

  let decode = "";
  if (t.length === 1) {
    if (t[0] === "list[int]")
      decode = `    ${n[0]}.resize(_tokens.size());\n    for (size_t _i=0;_i<_tokens.size();_i++) ${n[0]}[_i]=stoll(_tokens[_i]);`;
    else if (t[0] === "int") decode = `    ${n[0]} = stoll(_tokens[0]);`;
    else decode = `    ${n[0]} = _raw;`;
  } else if (t[0] === "list[int]") {
    decode = `    ${n[0]}.resize(stoll(_tokens[0]));\n    for (size_t _i=0;_i<${n[0]}.size();_i++) ${n[0]}[_i]=stoll(_tokens[1+_i]);`;
    for (let i = 1; i < n.length; i++) decode += `\n    ${n[i]} = stoll(_tokens[1+stoll(_tokens[0])+${i - 1}]);`;
  } else {
    for (let i = 0; i < n.length; i++) {
      decode += t[i] === "int" ? `\n    ${n[i]} = stoll(_tokens[${i}]);` : `\n    ${n[i]} = _tokens[${i}];`;
    }
    decode = decode.replace(/^\n/, "");
  }

  let call = `    auto _result = solve(${n.join(", ")});`;
  let out: string;
  if (sig.returns === "list[int]") {
    out = `    for (size_t _i=0;_i<_result.size();_i++) { if(_i) cout << ' '; cout << _result[_i]; }`;
  } else if (sig.returns === "bool") {
    out = `    cout << (_result ? "true" : "false");`;
  } else {
    out = `    cout << _result;`;
  }

  return `#include <bits/stdc++.h>
using namespace std;

${userSolve}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    vector<string> _tokens;
    string _tok;
    while (cin >> _tok) _tokens.push_back(_tok);
    string _raw;
    for (size_t _i=0;_i<_tokens.size();_i++) { if(_i) _raw += ' '; _raw += _tokens[_i]; }
${decl}${decode}
${call}
${out}
    cout << flush;
    return 0;
}
`;
}

// ---------------------------------------------------------------------------
// C
// ---------------------------------------------------------------------------

// C cannot return arrays, so for list[int] returns the solve writes the output.
// For all returns, solve writes the exact output string into `char out[]`.
function cParamList(sig: HarnessSignature): string {
  const decls: string[] = [];
  for (const p of sig.params) {
    if (p.type === "list[int]") decls.push(`int* ${p.name}, int ${p.name}_size`);
    else if (p.type === "int") decls.push(`long long ${p.name}`);
    else decls.push(`const char* ${p.name}`);
  }
  decls.push("char out[]");
  return decls.join(", ");
}

export function buildCTemplate(sig: HarnessSignature): string {
  return `// Inputs are already parsed. Write the exact result into \`out\`; the judge
// compares your output byte-for-byte.
void solve(${cParamList(sig)}) {
    out[0] = '\\0';
}\n`;
}

export function buildCProgram(userSolve: string, sig: HarnessSignature): string {
  const t = typesOnly(sig);
  const n = names(sig);

  let decl = "";
  for (const p of sig.params) {
    if (p.type === "list[int]") decl += `    int ${p.name}[4096];\n    int ${p.name}_size = 0;\n`;
    else if (p.type === "int") decl += `    long long ${p.name};\n`;
    else decl += `    char ${p.name}[4096];\n`;
  }

  let decode = "";
  if (t.length === 1) {
    if (t[0] === "list[int]")
      decode = `    ${n[0]}_size = _tokc;\n    for (int _i=0;_i<_tokc;_i++) ${n[0]}[_i]=atoi(_toks[_i]);`;
    else if (t[0] === "int") decode = `    ${n[0]} = atoll(_toks[0]);`;
    else decode = `    strcpy(${n[0]}, _raw);`;
  } else if (t[0] === "list[int]") {
    decode = `    ${n[0]}_size = atoi(_toks[0]);\n    for (int _i=0;_i<${n[0]}_size;_i++) ${n[0]}[_i]=atoi(_toks[1+_i]);`;
    for (let i = 1; i < n.length; i++) decode += `\n    ${n[i]} = atoll(_toks[1+atoi(_toks[0])+${i - 1}]);`;
  } else {
    for (let i = 0; i < n.length; i++) {
      decode += t[i] === "int" ? `\n    ${n[i]} = atoll(_toks[${i}]);` : `\n    strcpy(${n[i]}, _toks[${i}]);`;
    }
    decode = decode.replace(/^\n/, "");
  }

  const call = `    solve(${n
    .map((nm, i) => (t[i] === "list[int]" ? `${nm}, ${nm}_size` : nm))
    .join(", ")}, _out);`;

  return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${userSolve}

int main(void) {
    char _buf[262144];
    size_t _len = fread(_buf, 1, sizeof(_buf) - 1, stdin);
    _buf[_len] = '\\0';
    char _cpy[262144];
    strcpy(_cpy, _buf);
    char _raw[262144];
    strcpy(_raw, _buf);
    if (_len > 0 && _raw[_len - 1] == '\\n') _raw[_len - 1] = '\\0';
    int _tokc = 0;
    char* _toks[4096];
    char* _p = strtok(_cpy, " \\t\\n\\r");
    while (_p) { _toks[_tokc++] = _p; _p = strtok(NULL, " \\t\\n\\r"); }
${decl}${decode}
    char _out[262144];
    ${call}
    printf("%s", _out);
    return 0;
}
`;
}

// ---------------------------------------------------------------------------
// Java
// ---------------------------------------------------------------------------

function javaType(t: HarnessParamType | HarnessReturnType, returns = false): string {
  if (returns) {
    return t === "list[int]" ? "int[]" : t === "str" ? "String" : t === "bool" ? "boolean" : "long";
  }
  return t === "list[int]" ? "int[]" : t === "str" ? "String" : "long";
}
function javaParamList(sig: HarnessSignature): string {
  return sig.params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
}

export function buildJavaTemplate(sig: HarnessSignature): string {
  return `// Inputs are already parsed. Return the exact result; the judge compares
// your output byte-for-byte.
static ${javaType(sig.returns, true)} solve(${javaParamList(sig)}) {
    ${sig.returns === "list[int]" ? `return new int[0];` : sig.returns === "str" ? `return "";` : sig.returns === "bool" ? `return false;` : `return 0;`}
}\n`;
}

export function buildJavaProgram(userSolve: string, sig: HarnessSignature): string {
  const t = typesOnly(sig);
  const n = names(sig);
  let decode = "";
  if (t.length === 1) {
    if (t[0] === "list[int]") decode = `    ${n[0]} = new int[list.size()];\n    for (int _i=0;_i<list.size();_i++) ${n[0]}[_i]=Long.parseLong(list.get(_i));`;
    else if (t[0] === "int") decode = `    ${n[0]} = Long.parseLong(list.get(0));`;
    else decode = `    ${n[0]} = raw;`;
  } else if (t[0] === "list[int]") {
    decode = `    int _nn = (int) Long.parseLong(list.get(0));\n    ${n[0]} = new int[_nn];\n    for (int _i=0;_i<_nn;_i++) ${n[0]}[_i]=Long.parseLong(list.get(1+_i));\n`;
    for (let i = 1; i < n.length; i++) decode += `    ${n[i]} = Long.parseLong(list.get(1+_nn+${i - 1}));\n`;
  } else {
    for (let i = 0; i < n.length; i++) {
      if (t[i] === "int") decode += `    ${n[i]} = Long.parseLong(list.get(${i}));\n`;
      else
        decode +=
          i === n.length - 1
            ? `    ${n[i]} = String.join(" ", list.subList(${i}, list.size()));\n`
            : `    ${n[i]} = list.get(${i});\n`;
    }
  }
  let out = "";
  if (sig.returns === "list[int]") {
    out = "    StringBuilder _sb = new StringBuilder();\n    for (int _x : _result) { if (_sb.length()>0) _sb.append(' '); _sb.append(_x); }\n    System.out.print(_sb.toString());";
  } else {
    const expr =
      sig.returns === "bool"
        ? "(_result ? \"true\" : \"false\")"
        : sig.returns === "str"
          ? "_result"
          : "_result";
    out = `    System.out.print(${expr});`;
  }
  const call = `    ${sig.returns === "list[int]" ? "int[]" : sig.returns === "str" ? "String" : sig.returns === "bool" ? "boolean" : "long"} _result = solve(${n.join(", ")});`;
  return `import java.io.*;
import java.util.*;

public class Main {
${userSolve.split("\n").map((l) => (l ? "  " + l : l)).join("\n")}
  public static void main(String[] args) throws Exception {
    StringBuilder _sb = new StringBuilder();
    try (BufferedReader _br = new BufferedReader(new InputStreamReader(System.in))) {
      String _line;
      while ((_line = _br.readLine()) != null) _sb.append(_line).append('\\n');
    }
    String raw = _sb.toString().trim();
    List<String> list = new ArrayList<>();
    for (String _t : raw.split("\\\\s+")) if (!_t.isEmpty()) list.add(_t);
${decode}
${call}
${out}
  }
}
`;
}