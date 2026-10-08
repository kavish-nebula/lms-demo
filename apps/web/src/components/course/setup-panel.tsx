"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { BookOpenText, CalendarDays, Globe2, LifeBuoy, ListOrdered, RotateCcw, Settings2, Sparkles, UserRound } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Button } from "@/components/ui/button";
import { usePlanState } from "@/components/plan/use-plan";
import { useEnrollment } from "@/lib/enrollment";
import { QUESTIONS } from "@/lib/setup";
import type { Course } from "@/data/types";

/**
 * The course page once enrolled: how this course is set up for the learner,
 * with a way to change it. Arriving from "Go to the course" (?ready=1) it
 * opens as "Your course is ready".
 */
export function SetupPanel({ course, ready }: { course: Course; ready: boolean }) {
  const t = useTranslations("enroll");
  const reduce = useReducedMotion();
  const { enrollment, enrolled, adaptation: a } = useEnrollment(course.course_id);
  const { plan } = usePlanState();
  if (!enrolled || !enrollment) return null;

  const first = QUESTIONS.find((q) => q.id === "firstStep")!.options.find((o) => o.v === (enrollment.answers.firstStep ?? "idea"))!.label;
  const items = [
    a.roleLabel ? { icon: <UserRound />, text: t("sumRole", { role: a.roleLabel }) } : null,
    a.domain ? { icon: <Globe2 />, text: t("sumField", { field: a.domain.label }) } : null,
    { icon: <ListOrdered />, text: t("sumOrder", { first }) },
    { icon: <LifeBuoy />, text: t(`sumSupport_${a.supportSource}`, { level: t(`support_${a.support}`) }) },
    { icon: <BookOpenText />, text: a.analogyOpen ? t("sumAnalogyOpen") : t("sumAnalogyClosed") },
    plan.studyDays.length ? { icon: <CalendarDays />, text: t("sumPace", { minutes: plan.sessionMinutes, days: plan.studyDays.length }) } : null,
  ].filter((x): x is { icon: React.ReactElement; text: string } => !!x);
  const base = `/learn/courses/${course.course_id}/enroll`;

  return (
    <motion.div
      initial={reduce || !ready ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Surface pad="lg" tone={ready ? "accent" : "default"} spotlight className={cn("relative overflow-hidden", ready && "border-brand-line")}>
        {ready ? (
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(closest-side,var(--aura-1),transparent)] blur-2xl" />
        ) : null}
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="size-5 text-brand-ink" aria-hidden />
                {ready ? t("panelReadyTitle") : t("panelTitle")}
              </h2>
              <p className="text-sm text-ink-muted">{ready ? t("panelReadyBody") : t("panelBody")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="bg-transparent">
                <Link href={`${base}?step=precheck`}>
                  <RotateCcw data-icon="inline-start" />
                  {enrollment.precheck && !enrollment.precheck.skipped ? t("cRetakeCheck") : t("cTakeCheck")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="bg-transparent">
                <Link href={base}>
                  <Settings2 data-icon="inline-start" />
                  {t("customizeCta")}
                </Link>
              </Button>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it, i) => (
              <motion.li
                key={it.text}
                initial={reduce || !ready ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-start gap-2.5 rounded-lg border border-line bg-panel/70 p-3 text-sm"
              >
                <span className="mt-0.5 shrink-0 text-brand-ink [&_svg]:size-4">{it.icon}</span>
                {it.text}
              </motion.li>
            ))}
          </ul>
        </div>
      </Surface>
    </motion.div>
  );
}
