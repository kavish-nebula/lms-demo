"use client";

import * as React from "react";
import { cn } from "cn";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode; disabled?: boolean };

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: "sm" | "md";
  "aria-label": string;
  className?: string;
};

/**
 * Pill segmented control, e.g. the 12m / 3m / 30d / 7d / 24h range tabs
 * in reference image 2. Single-select, keyboard navigable (roving tabindex).
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  size = "md",
  className,
  ...aria
}: SegmentedProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as T);
      }}
      aria-label={aria["aria-label"]}
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-pill border border-line bg-panel-2 p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "rounded-pill font-medium whitespace-nowrap text-ink-muted transition-colors duration-(--dur-1) outline-none",
            "hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/60",
            "data-[state=on]:bg-brand-soft data-[state=on]:text-brand-ink data-[state=on]:shadow-[inset_0_0_0_1px_var(--accent-line)]",
            "disabled:pointer-events-none disabled:opacity-50",
            size === "sm" ? "h-6 px-2.5 text-xs" : "h-8 px-3 text-sm",
          )}
        >
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
