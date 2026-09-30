"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const relayoutRef = useRef<(() => void) | null>(null);

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

  /*
   * Monaco sizes itself from its own DOM node, and `automaticLayout` only
   * watches that same node. If the first measurement happens before the flex
   * chain above the editor has settled, the node lands at Monaco's 5x5 default
   * and never grows again — the editor renders zero lines with no error. The
   * host is fully sized, so the fix is to re-measure from the outside.
   */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => relayoutRef.current?.());
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const handleMount = useCallback((editor: { layout: () => void }) => {
    relayoutRef.current = () => {
      // Measure the real box, not Monaco's stale one.
      editor.layout();
    };
    relayoutRef.current();
  }, []);

  useEffect(() => () => {
    relayoutRef.current = null;
  }, []);

  const monacoLanguage = MONACO_LANGUAGE[language] ?? "plaintext";

  return (
    <div ref={hostRef} className="size-full min-h-0 min-w-0">
      <Editor
        height="100%"
        width="100%"
        onMount={handleMount}
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
    </div>
  );
}
