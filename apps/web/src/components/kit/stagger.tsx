"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";

const container: Variants = {
  hidden: {},
  show: (step: number) => ({ transition: { staggerChildren: step, delayChildren: 0.05 } }),
};

const item: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 26 } },
};

/**
 * Staggered entrance for a group of cards (stagger list, ~0.06s per item).
 * Wrap each child in <StaggerItem>. Under reduced motion MotionConfig makes
 * this an instant render.
 */
export function Stagger({
  children,
  className,
  step = 0.06,
  inView = false,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  /** wait until scrolled into view instead of animating on mount */
  inView?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={container}
      custom={step}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-60px" } } : { animate: "show" })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
