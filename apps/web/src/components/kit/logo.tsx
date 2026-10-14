import * as React from "react";
import Image from "next/image";
import { cn } from "cn";

/** Supplied Nebula brand mark shared by the shell and course surfaces. */
export function NebulaMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/nebula-mark.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}

export function Logo({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <NebulaMark size={wordmark ? 34 : 28} />
      {wordmark ? (
        <span className="text-lg font-semibold tracking-[-0.035em] whitespace-nowrap">
          Nebula <span className="text-brand-ink">KnowLab</span>
        </span>
      ) : null}
    </span>
  );
}
