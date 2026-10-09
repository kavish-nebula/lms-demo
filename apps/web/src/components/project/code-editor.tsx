"use client";

import * as React from "react";
import Editor, { loader } from "@monaco-editor/react";

/**
 * The code editor: Monaco, the editor inside VS Code. Its code loads from
 * jsdelivr (pinned) the first time a workspace opens, so it adds nothing to
 * the app's own bundle. Load this file with next/dynamic and ssr: false.
 */
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.57.0/min/vs" } });

/** Follows the app's theme: dark ("aurora") or light. */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const isDark = () => document.documentElement.dataset.theme === "aurora";

const LANGUAGE: Record<string, string> = { py: "python", md: "markdown", json: "json" };

export default function CodeEditor({
  path,
  value,
  readOnly,
  label,
  loadingText,
  onChange,
  onRun,
}: {
  path: string;
  value: string;
  readOnly?: boolean;
  /** what a screen reader announces for the editor */
  label: string;
  loadingText: string;
  onChange?: (value: string) => void;
  /** Ctrl/Cmd+Enter */
  onRun?: () => void;
}) {
  const dark = React.useSyncExternalStore(subscribe, isDark, () => true);
  const run = React.useRef(onRun);
  React.useEffect(() => {
    run.current = onRun;
  }, [onRun]);

  return (
    <Editor
      path={path}
      language={LANGUAGE[path.split(".").pop() ?? ""] ?? "plaintext"}
      value={value}
      theme={dark ? "vs-dark" : "light"}
      onChange={(v) => onChange?.(v ?? "")}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run.current?.());
      }}
      loading={<div className="p-4 text-sm text-ink-muted">{loadingText}</div>}
      options={{
        readOnly,
        ariaLabel: label,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 4,
        insertSpaces: true,
        automaticLayout: true,
        renderLineHighlight: "line",
        padding: { top: 12, bottom: 12 },
      }}
    />
  );
}
