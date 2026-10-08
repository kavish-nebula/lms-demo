"use client";

import * as React from "react";
import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Mono code block with language label and copy button (worked examples, practice). */
export function CodeBlock({
  code,
  language = "python",
  output,
  className,
}: {
  code: string;
  language?: string;
  /** optional output shown under the code, like a REPL result */
  output?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is still selectable.
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-plum text-[#efeefe]", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-xs text-white/60">{language}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={copy}
          className="text-white/70 hover:bg-white/10 hover:text-white"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
      {output != null ? (
        <div className="border-t border-white/10 bg-black/20 px-4 py-2 font-mono text-sm">
          <span className="text-teal select-none">{"› "}</span>
          {output}
        </div>
      ) : null}
    </div>
  );
}
