import * as React from "react";
import Image from "next/image";
import { cn } from "cn";

/**
 * The brand mark: interlaced rings (public/brand), on a white disc so its deep
 * teal and plum stay readable on the dark theme. Decorative; the name sits
 * beside it or in a label.
 */
export function NebulaMark({ size = 28, className }: { size?: number; className?: string }) {
  const inner = Math.round(size * 0.86);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/brand/logo-256.png" alt="" width={inner} height={inner} className="select-none" draggable={false} />
    </span>
  );
}

export function Logo({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <NebulaMark size={32} />
      {wordmark ? (
        <span className="text-base font-semibold tracking-tight whitespace-nowrap">
          Nebula <span className="text-brand-ink">KnowLab</span>
        </span>
      ) : null}
    </span>
  );
}
