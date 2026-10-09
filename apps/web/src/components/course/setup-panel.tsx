"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import useSWR from "swr";
import { useFormatter } from "next-intl";
import { BookOpenText, CalendarDays, ChevronDown, Globe2, History, LifeBuoy, ListOrdered, Loader2, RotateCcw, Settings2, Sparkles, UserRound } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePlanState } from "@/components/plan/use-plan";
import { api, plansKey } from "@/lib/api";
import { useEnrollment } from "@/lib/enrollment";
import { QUESTIONS } from "@/lib/setup";
import type { PlanVersion } from "@/lib/learner-plan";
import type { Course } from "@/data/types";

/**
 * The course page once enrolled: how this course is set up for the learner,
 * with a way to change it. With a plan it leads with the plan's summary, what
 * it is based on, where to spend time, and how the plan has changed. Arriving
 * from "Go to the course" (?ready=1) it opens as "Your course is ready".
 */
export function SetupPanel({ course, ready }: { course: Course; ready: boolean }) {
  const t = useTranslations("enroll");
  const reduce = useReducedMotion();
  const { enrollment, enrolled, adaptation: a } = useEnrollment(course.course_id);
  const { plan } = usePlanState();
  if (!enrolled || !enrollment) return null;
  const lp = a.plan;
  const emphasis = (lp?.modules ?? []).filter((m) => m.emphasis !== "standard");

  const first = QUESTIONS.find((q) => q.id === "firstStep")!.options.find((o) => o.v === (enrollment.answers.firstStep ?? "idea"))!.label;
  const items = [
    a.roleLabel ? { icon: <UserRound />, text: t("sumRole", { role: a.roleLabel }) } : null,
    a.domain ? { icon: <Globe2 />, text: t("sumField", { field: a.domain.label }) } : null,
    { icon: <ListOrdered />, text: t("sumOrder", { first }) },
    { icon: <LifeBuoy />, text: t(`sumSupport_${a.supportSource}`, { level: t(`support_${a.support}`) }) },
    { icon: <BookOpenText />, text: a.analogyOpen ? t("sumAnalogyOpen") : t("sumAnalogyClosed") },
    lp
      ? { icon: <CalendarDays />, text: lp.pacing.note }
      : plan.studyDays.length
        ? { icon: <CalendarDays />, text: t("sumPace", { minutes: plan.sessionMinutes, days: plan.studyDays.length }) }
        : null,
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Chip size="sm" tone={a.planSource === "ai" ? "accent" : "neutral"}>
                  {a.planSource === "ai" ? t("plannedByAi") : t("standardSetup")}
                </Chip>
                {enrollment.pending ? (
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                    {t("panelRevising")}
                  </span>
                ) : null}
              </div>
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
          {lp ? <p className="leading-relaxed">{lp.summary}</p> : null}
          {lp && (lp.learner.strengths.length || lp.learner.gaps.length) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {lp.learner.strengths.length ? (
                <div className="rounded-lg border border-ok-line bg-ok-soft/50 p-3 text-sm">
                  <div className="mb-1 text-xs font-semibold text-ok">{t("panelStrengths")}</div>
                  {lp.learner.strengths.join(" · ")}
                </div>
              ) : null}
              {lp.learner.gaps.length ? (
                <div className="rounded-lg border border-warn-line bg-warn-soft/50 p-3 text-sm">
                  <div className="mb-1 text-xs font-semibold text-warn">{t("panelGaps")}</div>
                  {lp.learner.gaps.join(" · ")}
                </div>
              ) : null}
            </div>
          ) : null}
          {emphasis.length ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("panelEmphasis")}</div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {emphasis.map((m) => {
                  const i = course.modules.findIndex((x) => x.module_id === m.moduleId);
                  return (
                    <li key={m.moduleId} className="flex flex-wrap gap-x-2">
                      <span className="font-medium">{t("moduleShort", { n: i + 1 })}</span>
                      <span className="font-medium text-brand-ink">{t(m.emphasis === "deep" ? "emphasis_deep" : "emphasis_skim")}</span>
                      <span className="text-ink-muted">{m.why}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
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
          {enrollment.lastError ? <p className="text-xs text-ink-faint">{t("standardSetupFailed", { reason: enrollment.lastError })}</p> : null}
          <PlanHistory courseId={course.course_id} />
        </div>
      </Surface>
    </motion.div>
  );
}

/** Every version of the plan, newest first, with what changed and why. Loaded when opened. */
function PlanHistory({ courseId }: { courseId: string }) {
  const t = useTranslations("enroll");
  const format = useFormatter();
  const [open, setOpen] = React.useState(false);
  const { data } = useSWR<{ plans: PlanVersion[] }>(open ? plansKey(courseId) : null, (u: string) => api<{ plans: PlanVersion[] }>(u));
  const plans = (data?.plans ?? []).filter((p) => p.status !== "generating");
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-line">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none hover:bg-panel-2/50 focus-visible:ring-2 focus-visible:ring-ring/60">
        <History className="size-4 text-brand-ink" aria-hidden />
        <span className="flex-1">{t("historyTitle")}</span>
        <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-3 px-3 pb-3">
          {!data ? <li className="text-sm text-ink-faint">{t("historyLoading")}</li> : null}
          {plans.map((p) => (
            <li key={p.version} className="flex flex-col gap-1 border-t border-line pt-3 text-sm first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{t("historyVersion", { n: p.version })}</span>
                <Chip size="sm" tone={p.source === "ai" ? "accent" : "neutral"}>
                  {t(p.source === "ai" ? "source_ai" : "source_baseline")}
                </Chip>
                <span className="text-xs text-ink-faint">
                  {t(`trigger_${p.trigger}`)} · {format.dateTime(new Date(p.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              {p.status === "failed" ? (
                <p className="text-xs text-ink-faint">{t("historyFailed", { reason: p.error ?? "" })}</p>
              ) : p.changes.length ? (
                <ul className="flex flex-col gap-1 text-ink-muted">
                  {p.changes.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium text-ink">{c.target}</span>: {c.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-faint">{p.trigger === "enrol" ? t("historyFirst") : t("historyNoChanges")}</p>
              )}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
