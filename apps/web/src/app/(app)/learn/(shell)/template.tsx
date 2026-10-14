"use client";

import { motion } from "motion/react";

/**
 * Learner pages must remain visible in server-rendered HTML while hydration
 * starts. Starting them transparent can leave an entire route blank whenever
 * client animation hydration is delayed or interrupted.
 */
export default function LearnTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
