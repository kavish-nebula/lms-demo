"use client";

import * as React from "react";
import { cn } from "cn";
import { useLocale } from "next-intl";
import { motion, useInView, useReducedMotionConfig } from "motion/react";

export type NumberTickerProps = {
  value: number;
  /** Intl.NumberFormat options, e.g. { style: "percent" } or { maximumFractionDigits: 1 } */
  format?: Intl.NumberFormatOptions;
  prefix?: string;
  suffix?: string;
  /** seconds before the roll starts once in view */
  delay?: number;
  className?: string;
};

/**
 * Odometer-style number ticker (21st.dev "Motion Number" / "Number Flow").
 * Each digit is a 0-9 column that springs to its value when the number
 * scrolls into view, and rolls again whenever the value changes.
 * Screen readers get the final value once; reduced motion shows it instantly.
 */
export function NumberTicker({ value, format, prefix = "", suffix = "", delay = 0, className }: NumberTickerProps) {
  const locale = useLocale();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotionConfig() ?? false;
  const text = React.useMemo(() => new Intl.NumberFormat(locale, format).format(value), [locale, format, value]);
  const chars = text.split("");

  return (
    <span ref={ref} className={cn("inline-flex items-baseline whitespace-nowrap normal-nums", className)}>
      <span className="sr-only">{`${prefix}${text}${suffix}`}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {prefix ? <span className="whitespace-pre">{prefix}</span> : null}
        {chars.map((ch, i) => {
          // key from the right so columns stay put when the number of digits changes
          const pos = chars.length - i;
          return /\d/.test(ch) ? (
            <Digit key={`d${pos}`} digit={Number(ch)} active={inView || reduce} instant={reduce} delay={delay + pos * 0.05} />
          ) : (
            <span key={`c${pos}`}>{ch}</span>
          );
        })}
        {suffix ? <span className="whitespace-pre">{suffix}</span> : null}
      </span>
    </span>
  );
}

function Digit({ digit, active, instant, delay }: { digit: number; active: boolean; instant: boolean; delay: number }) {
  return (
    <span className="relative inline-block overflow-hidden leading-none" style={{ height: "1em" }}>
      {/* the final digit, invisible, sizes the slot so "1" is not padded to a "0" width */}
      <span className="invisible">{digit}</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={false}
        animate={{ y: `${-(active ? digit : 0) * 10}%` }}
        transition={instant ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 16, mass: 0.9, delay }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block leading-none" style={{ height: "1em" }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
