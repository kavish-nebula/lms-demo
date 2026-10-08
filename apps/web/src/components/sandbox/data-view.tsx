"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Item } from "@/lib/sandbox/types";

const cell = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Shows spaces, tabs and empty strings, which is where messy data hides. */
function Visible({ value }: { value: unknown }) {
  const text = cell(value);
  if (value === "") return <span className="text-ink-faint italic">empty</span>;
  if (value == null) return <span className="text-ink-faint italic">null</span>;
  const lead = /^\s+/.exec(text)?.[0] ?? "";
  const trail = /\s+$/.exec(text)?.[0] ?? "";
  if (!lead && !trail) return <>{text}</>;
  if (!text.trim())
    return <span className="rounded bg-warn-soft px-0.5 text-warn">{"·".repeat(Math.min(text.length, 12))}</span>;
  const mark = (s: string) => (s ? <span className="rounded bg-warn-soft text-warn">{s.replace(/\t/g, "→").replace(/ /g, "·")}</span> : null);
  return (
    <>
      {mark(lead)}
      {text.slice(lead.length, text.length - trail.length)}
      {mark(trail)}
    </>
  );
}

/**
 * Items as a table (one column per field) or as JSON, like n8n's data panes.
 * Clicking a column name copies the expression that reads it.
 */
export function DataView({ items, emptyLabel, className }: { items: Item[]; emptyLabel: string; className?: string }) {
  const t = useTranslations("sandbox");
  const [mode, setMode] = React.useState<"table" | "json">("table");
  const keys = React.useMemo(() => [...new Set(items.flatMap((i) => Object.keys(i.json)))], [items]);

  if (!items.length) return <p className={cn("rounded-lg border border-dashed border-line p-4 text-center text-sm text-ink-faint", className)}>{emptyLabel}</p>;

  const copy = (k: string) => {
    const expr = /^[A-Za-z_$][\w$]*$/.test(k) ? `{{ $json.${k} }}` : `{{ $json["${k}"] }}`;
    navigator.clipboard?.writeText(expr).then(
      () => toast.success(t("copied", { text: expr })),
      () => {},
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">{t("itemCount", { count: items.length })}</span>
        <div role="group" aria-label={t("dataView")} className="flex rounded-md border border-line p-0.5 text-xs">
          {(["table", "json"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn("rounded px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60", mode === m ? "bg-panel-2 font-medium" : "text-ink-muted")}
            >
              {t(m === "table" ? "viewTable" : "viewJson")}
            </button>
          ))}
        </div>
      </div>
      {mode === "json" ? (
        <pre className="max-h-full overflow-auto rounded-lg border border-line bg-panel-2/50 p-3 font-mono text-xs leading-relaxed">
          {JSON.stringify(
            items.map((i) => i.json),
            null,
            2,
          )}
        </pre>
      ) : (
        <div className="overflow-auto rounded-lg border border-line">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-panel-2/60 text-left">
                {keys.map((k) => (
                  <th key={k} scope="col" className="border-b border-line p-0 font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => copy(k)}
                      title={t("copyExpression")}
                      className="w-full px-2.5 py-1.5 text-left outline-none hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      {k}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  {keys.map((k) => (
                    <td key={k} className="max-w-64 px-2.5 py-1.5 align-top break-words whitespace-pre-wrap">
                      <Visible value={it.json[k]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
