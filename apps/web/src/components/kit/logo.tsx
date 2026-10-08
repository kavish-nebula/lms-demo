import * as React from "react";
import { cn } from "cn";

/** Orbit mark carried over from the prototype's NebulaMark. */
export function NebulaMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("shrink-0 text-brand-ink", className)}
    >
      <circle cx="16" cy="16" r="6" fill="currentColor" />
      <ellipse
        cx="16"
        cy="16"
        rx="13"
        ry="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        transform="rotate(-25 16 16)"
        opacity="0.75"
      />
      <circle cx="27" cy="9.5" r="2" fill="var(--coral)" />
    </svg>
  );
}

export function Logo({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <NebulaMark />
      {wordmark ? (
        <span className="text-base font-semibold tracking-tight whitespace-nowrap">
          Nebula <span className="text-brand-ink">KnowLab</span>
        </span>
      ) : null}
    </span>
  );
}
