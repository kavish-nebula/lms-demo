import * as React from "react";
import { cn } from "cn";
import { STAGE_META, type StageId } from "@/lib/stages";

export type ChipTone =
  | "neutral"
  | "accent"
  | "ok"
  | "warn"
  | "err"
  | "info"
  | "inverse"
  | StageId;

const TONE: Record<Exclude<ChipTone, StageId>, string> = {
  neutral: "bg-panel-2 text-ink-muted border-line",
  accent: "bg-brand-soft text-brand-ink border-brand-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  err: "bg-err-soft text-err border-err-line",
  info: "bg-info-soft text-info border-info-line",
  inverse: "bg-ink text-canvas border-transparent",
};

function toneClass(tone: ChipTone) {
  return tone in STAGE_META ? STAGE_META[tone as StageId].chip : TONE[tone as keyof typeof TONE];
}

export type ChipProps = React.ComponentProps<"span"> & {
  tone?: ChipTone;
  size?: "sm" | "md";
  /** leading icon or dot */
  icon?: React.ReactNode;
  dot?: boolean;
};

/**
 * Small pill label. design.md `.chip`: statuses, nav meta, stage tags.
 * Status tones always pair soft fill + line border + ink text.
 */
export function Chip({
  tone = "neutral",
  size = "md",
  icon,
  dot,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      data-slot="chip"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-pill border font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        toneClass(tone),
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {icon}
      {children}
    </span>
  );
}

export type DeltaChipProps = {
  value: number;
  /** "up" is good by default; set goodDirection="down" for metrics like drop-off */
  goodDirection?: "up" | "down";
  suffix?: string;
  className?: string;
};

/** The small +24.4% / -3% chip beside a KPI (reference image 2). */
export function DeltaChip({ value, goodDirection = "up", suffix = "%", className }: DeltaChipProps) {
  const flat = value === 0;
  const good = flat ? null : goodDirection === "up" ? value > 0 : value < 0;
  const tone: ChipTone = flat ? "neutral" : good ? "ok" : "err";
  const arrow = flat ? "→" : value > 0 ? "↑" : "↓";
  return (
    <Chip tone={tone} size="sm" className={cn("tabular-nums", className)}>
      <span aria-hidden>{arrow}</span>
      {Math.abs(value)}
      {suffix}
    </Chip>
  );
}
