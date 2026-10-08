import * as React from "react";
import { cn } from "cn";
import { Surface } from "@/components/kit/surface";

export type LegendItem = { label: string; colorVar: string };

/**
 * Card frame for charts (reference image 2 "Analysis"): title, legend,
 * optional range control on the right, chart slot below. The chart itself
 * is passed as children so any Recharts or SVG chart can sit inside.
 */
export function ChartCard({
  title,
  description,
  legend,
  control,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  legend?: LegendItem[];
  control?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface pad="md" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
          {legend?.length ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {legend.map((l) => (
                <li key={l.label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(${l.colorVar})` }} />
                  {l.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {control}
      </div>
      {children}
    </Surface>
  );
}
