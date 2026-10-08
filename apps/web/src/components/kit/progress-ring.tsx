"use client";

import * as React from "react";
import { cn } from "cn";
import { motion } from "motion/react";
import { NumberTicker } from "@/components/kit/number-ticker";

export type ProgressRingProps = {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  /** text inside the ring; defaults to a ticking percentage */
  label?: React.ReactNode;
  tone?: "brand" | "ok" | "amber" | "coral";
  className?: string;
  "aria-label"?: string;
};

const TONE = {
  brand: "text-brand-ink",
  ok: "text-ok",
  amber: "text-amber",
  coral: "text-coral",
} as const;

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Circular progress for dashboard and course cards; the arc draws in on mount. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  label,
  tone = "brand",
  className,
  ...aria
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={aria["aria-label"] ?? `${pct}%`}
      className={cn("relative inline-grid shrink-0 place-items-center", TONE[tone], className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
          style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, currentColor 45%, transparent))" }}
        />
      </svg>
      <span aria-hidden className="absolute text-sm font-semibold text-ink tabular-nums">
        {label ?? <NumberTicker value={pct} suffix="%" />}
      </span>
    </div>
  );
}

export type ProgressBarProps = {
  value: number;
  tone?: "brand" | "ok" | "amber" | "coral" | "ink";
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
};

const BAR_TONE = {
  brand: "bg-[linear-gradient(90deg,var(--accent-deep),var(--accent))]",
  ok: "bg-ok",
  amber: "bg-amber",
  coral: "bg-coral",
  ink: "bg-ink",
} as const;

/** Linear progress (reference image 3 course cards); fills from the left on mount. */
export function ProgressBar({ value, tone = "brand", size = "md", className, ...aria }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const pct = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={aria["aria-label"] ?? `${pct}%`}
      className={cn(
        "w-full overflow-hidden rounded-pill bg-chart-track",
        size === "sm" ? "h-1.5" : "h-2.5",
        className,
      )}
    >
      <motion.div
        className={cn("h-full w-full origin-left rounded-pill", BAR_TONE[tone])}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
      />
    </div>
  );
}
