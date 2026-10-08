import * as React from "react";
import { cn } from "cn";
import { Surface } from "@/components/kit/surface";
import { DeltaChip } from "@/components/kit/chip";
import { NumberTicker } from "@/components/kit/number-ticker";

export type StatStatus = "healthy" | "watch" | "red-flag";

export type StatTileProps = {
  label: string;
  /** numbers roll in with the NumberTicker; any other node renders as-is */
  value: number | React.ReactNode;
  /** shown after a numeric value, e.g. "%" or " min" */
  suffix?: string;
  format?: Intl.NumberFormatOptions;
  /** small text under the value, e.g. "of 18" or a healthy range */
  hint?: string;
  icon?: React.ReactNode;
  delta?: { value: number; goodDirection?: "up" | "down"; suffix?: string };
  /** ch13 Stage 8: healthy range / red flag, rendered as a left rule */
  status?: StatStatus;
  sparkline?: number[];
  className?: string;
};

const STATUS_RULE: Record<StatStatus, string> = {
  healthy: "before:bg-ok",
  watch: "before:bg-amber",
  "red-flag": "before:bg-err",
};

/**
 * KPI tile (reference images 2 and 3): icon in a soft square, big value,
 * label, optional delta chip and sparkline. Numeric values tick in.
 * `status` adds a coloured rule for the ch13 healthy / red-flag thresholds.
 */
export function StatTile({
  label,
  value,
  suffix,
  format,
  hint,
  icon,
  delta,
  status,
  sparkline,
  className,
}: StatTileProps) {
  return (
    <Surface
      pad="md"
      spotlight
      className={cn(
        "relative flex h-full min-w-0 flex-col gap-3",
        status &&
          "before:absolute before:top-4 before:bottom-4 before:left-0 before:w-1 before:rounded-r before:content-['']",
        status && STATUS_RULE[status],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink [&_svg]:size-[18px]">
            {icon}
          </span>
        ) : null}
        {delta ? <DeltaChip {...delta} className="ml-auto" /> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {typeof value === "number" ? <NumberTicker value={value} suffix={suffix} format={format} /> : value}
          </div>
          <div className="mt-0.5 text-sm text-ink-muted">{label}</div>
          {hint ? <div className="mt-1 text-xs text-ink-faint">{hint}</div> : null}
        </div>
        {sparkline && sparkline.length > 1 ? <Sparkline data={sparkline} /> : null}
      </div>
    </Surface>
  );
}

export function Sparkline({
  data,
  width = 72,
  height = 28,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible text-brand-ink", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] motion-safe:animate-[draw_1.2s_var(--ease-out)_0.3s_forwards] motion-reduce:[stroke-dashoffset:0]"
      />
    </svg>
  );
}

/** Responsive KPI row: 2 columns on phones, up to 4 on wide screens. */
export function KpiRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4", className)}
      {...props}
    />
  );
}
