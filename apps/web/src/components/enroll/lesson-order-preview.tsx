"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BookOpen, ListChecks, PencilRuler } from "lucide-react";
import type { LessonPart } from "@/lib/setup";

const PART: Record<LessonPart, { icon: typeof BookOpen; tone: string }> = {
  idea: { icon: BookOpen, tone: "text-stage-explainer border-stage-explainer-line bg-stage-explainer-soft" },
  example: { icon: ListChecks, tone: "text-stage-worked border-stage-worked-line bg-stage-worked-soft" },
  try: { icon: PencilRuler, tone: "text-stage-guided border-stage-guided-line bg-stage-guided-soft" },
};

/**
 * The three parts of every lesson, in the order this learner gets them.
 * Cards glide to their new place when "What helps first" changes (layout
 * animation), so the effect of the answer is visible, not just described.
 */
export function LessonOrderPreview({ order, className }: { order: LessonPart[]; className?: string }) {
  const t = useTranslations("enroll");
  return (
    <ol className={cn("flex flex-col gap-2", className)} aria-label={t("orderLabel")}>
      {order.map((p, i) => {
        const Icon = PART[p].icon;
        return (
          <motion.li
            key={p}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2.5"
          >
            <span className="w-4 font-mono text-xs text-ink-faint tabular-nums">{i + 1}</span>
            <span className={cn("flex size-8 items-center justify-center rounded-md border", PART[p].tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t(`part_${p}`)}</span>
              <span className="block truncate text-xs text-ink-faint">{t(`part_${p}_hint`)}</span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
