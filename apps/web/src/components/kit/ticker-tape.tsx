"use client";

import * as React from "react";
import { cn } from "cn";
import { useReducedMotionConfig } from "motion/react";
import { Pause, Play } from "lucide-react";

export type TickerItem = { id: string; content: React.ReactNode };

export type TickerTapeProps = {
  items: TickerItem[];
  /** accessible name for the region, e.g. "Up next" */
  label: string;
  /** optional leading badge, e.g. an "Up next" chip */
  lead?: React.ReactNode;
  /** seconds for one full loop */
  duration?: number;
  pauseLabel: string;
  playLabel: string;
  className?: string;
};

/**
 * Scrolling ticker tape. Follows the UI/UX rules for moving content:
 * a pause control, pause on hover and keyboard focus, and a static,
 * wrapped list under reduced motion. The duplicate loop copy is hidden
 * from assistive tech so items are read once.
 */
export function TickerTape({
  items,
  label,
  lead,
  duration = 36,
  pauseLabel,
  playLabel,
  className,
}: TickerTapeProps) {
  const reduce = useReducedMotionConfig() ?? false;
  const [paused, setPaused] = React.useState(false);
  const moving = !reduce && !paused && items.length > 1;

  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-8 whitespace-nowrap">
          {it.content}
          <span aria-hidden className="size-1 rounded-full bg-ink-faint/60" />
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label={label}
      className={cn(
        "glass glass-sm flex items-center gap-3 overflow-hidden rounded-pill border py-1.5 pr-1.5 pl-2 shadow-sm",
        className,
      )}
    >
      {lead ? <div className="shrink-0">{lead}</div> : null}
      {reduce ? (
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1 py-1 text-sm">
          {items.map((it) => (
            <li key={it.id}>{it.content}</li>
          ))}
        </ul>
      ) : (
        <div
          className="group relative flex min-w-0 flex-1 overflow-hidden text-sm [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]"
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div
            className="flex w-max animate-[marquee_linear_infinite] group-hover:[animation-play-state:paused]"
            style={{ animationDuration: `${duration}s`, animationPlayState: moving ? undefined : "paused" }}
          >
            {row(false)}
            {row(true)}
          </div>
        </div>
      )}
      {!reduce && items.length > 1 ? (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? playLabel : pauseLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted outline-none hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
      ) : null}
    </section>
  );
}
