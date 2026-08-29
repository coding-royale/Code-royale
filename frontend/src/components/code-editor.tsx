"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Load Monaco only in the browser (Turbopack/SSR-safe). The default export of
// @monaco-editor/react is the Editor component.
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const MONACO_LANGUAGE: Record<string, string> = {
  node: "javascript",
  javascript: "javascript",
  python: "python",
  cpp: "cpp",
  java: "java",
  c: "c",
};

type CodeEditorProps = {
  language: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export function CodeEditor({ language, value, onChange, readOnly = false }: CodeEditorProps) {
  const [isDark, setIsDark] = useState(false);

  // Track the app's light/dark theme so Monaco matches it.
  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const monacoLanguage = MONACO_LANGUAGE[language] ?? "plaintext";

  return (
    <Editor
      height="100%"
      width="100%"
      defaultLanguage={monacoLanguage}
      language={monacoLanguage}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      theme={isDark ? "vs-dark" : "light"}
      loading={<div className="p-4 text-sm text-muted-foreground">Loading editor…</div>}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "JetBrains Mono, Menlo, Consolas, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
        wordWrap: "off",
        tabSize: 2,
        scrollbar: { verticalScrollbarSize: 8 },
        renderLineHighlight: "none",
        lineNumbersMinChars: 3,
      }}
    />
  );
}