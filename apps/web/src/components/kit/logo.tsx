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

/**
 * Full brand lockup (mark + wordmark) as one supplied image, swapped per
 * theme: the transparent export serves Aurora (dark), the white-background
 * trademark export serves light mode where its plate blends into the canvas.
 * Both are rendered and toggled with CSS so the swap is server-side and
 * flash-free; the art direction lives in the files, not the component.
 */
export function Logo({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  if (!wordmark) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        <NebulaMark size={28} />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src="/brand/nebula-logo-light.png"
        alt="Nebula KnowLab"
        width={628}
        height={200}
        loading="eager"
        className="h-10 w-auto rounded-md dark:hidden"
      />
      <Image
        src="/brand/nebula-logo-dark.png"
        alt="Nebula KnowLab"
        width={720}
        height={179}
        loading="eager"
        className="hidden h-10 w-auto rounded-md dark:block"
      />
    </span>
  );
}
