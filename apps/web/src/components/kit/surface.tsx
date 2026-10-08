import * as React from "react";
import { cn } from "cn";

type SurfaceProps<T extends React.ElementType = "div"> = {
  as?: T;
  /** padding preset; design.md `.glass` default is 20px */
  pad?: "none" | "sm" | "md" | "lg";
  /** lifts and shows the accent border on hover (also enables the spotlight) */
  hover?: boolean;
  /** cursor-follow glow; on by default for hover surfaces */
  spotlight?: boolean;
  /** accent-soft fill for highlighted panels (resume card, callouts) */
  tone?: "default" | "accent" | "plum";
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

const PAD = { none: "", sm: "p-3", md: "p-5", lg: "p-6 md:p-8" } as const;
const TONE = {
  default: "bg-panel border-line",
  accent: "bg-brand-soft border-brand-line",
  plum: "bg-plum text-white border-transparent",
} as const;

/**
 * The frosted white card from design.md: panel surface, hairline border,
 * soft shadow, 16px radius. Use for almost everything in the app.
 */
export function Surface<T extends React.ElementType = "div">({
  as,
  pad = "md",
  hover,
  spotlight,
  tone = "default",
  className,
  children,
  ...props
}: SurfaceProps<T>) {
  const Comp = (as ?? "div") as React.ElementType;
  return (
    <Comp
      data-slot="surface"
      data-spotlight={(spotlight ?? hover) ? "" : undefined}
      className={cn(
        "rounded-card border shadow-sm",
        TONE[tone],
        PAD[pad],
        hover &&
          "transition-[transform,box-shadow,border-color] duration-(--dur-2) ease-(--ease-out) hover:-translate-y-0.5 hover:border-brand-line hover:shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

type GlassCardProps = React.ComponentProps<"div"> & {
  pad?: "none" | "sm" | "md" | "lg";
  blur?: "sm" | "md" | "lg";
  spotlight?: boolean;
};

/**
 * Liquid-glass panel. Accent material only: nav bars, sidebar, tutor dock,
 * hero cards, toasts. Never behind learning text (ch13 coherence rule).
 */
export function GlassCard({ pad = "md", blur = "md", spotlight, className, ...props }: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      data-spotlight={spotlight ? "" : undefined}
      className={cn(
        "glass glass-edge rounded-card-lg",
        blur === "sm" && "glass-sm",
        blur === "lg" && "glass-lg",
        PAD[pad],
        className,
      )}
      {...props}
    />
  );
}
