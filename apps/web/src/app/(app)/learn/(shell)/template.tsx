"use client";

import { motion } from "motion/react";

/**
 * Route transition for learner pages: a template re-mounts on every
 * navigation, so each page fades and rises in. MotionConfig turns this
 * into an instant render under reduced motion.
 */
export default function LearnTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
