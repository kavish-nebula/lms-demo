"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Clock, Loader2, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/kit/chip";
import { Surface } from "@/components/kit/surface";
import { FinaleArt, ModuleArt } from "@/components/course/module-art";
import { STAGE_META } from "@/lib/stages";
import { moduleTopics } from "@/lib/topics";
import type { Adaptation } from "@/lib/setup";
import type { Course } from "@/data/types";
import type { Pace } from "@/components/enroll/customize-step";

const STEP_MS = 650;
/** After this long, offer to carry on with the standard setup while the plan finishes. */
const SLOW_MS = 60_000;

/** Where the server is with this learner's course. */
export type BuildServer =
  | { status: "saving" }
  | { status: "planning"; since: number }
  | { status: "ready"; source: "ai" | "baseline"; ai: boolean; failed: string | null }
  | { status: "error"; message: string };

/**
 * "Building your course": the modules assemble one by one, each with its
 * topics, then the finale. Meanwhile the server saves the setup and the AI
 * planner plans the course; the ready panel waits for that plan (with a way to carry
 * on with the standard setup if it is slow) and shows its summary.
 */
export function BuildStep({
  course,
  name,
  adaptation,
  pace,
  authoredModules,
  server,
  onRetry,
  onGo,
}: {
  course: Course;
  name: string;
  adaptation: Adaptation;
  pace: Pace;
  authoredModules: string[];
  server: BuildServer;
  onRetry: () => void;
  onGo: () => void;
}) {
  const t = useTranslations("enroll");
  const tc = useTranslations("common");
  const reduce = useReducedMotion();
  const cards = course.modules.length + 1;
  const [animDone, setAnimDone] = React.useState(!!reduce);
  const [gaveUp, setGaveUp] = React.useState(false);
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    if (animDone) return;
    const id = setTimeout(() => setAnimDone(true), 500 + cards * STEP_MS);
    return () => clearTimeout(id);
  }, [animDone, cards]);

  const planningSince = server.status === "planning" ? server.since : null;
  React.useEffect(() => {
    if (planningSince === null) return;
    const id = setTimeout(() => setSlow(true), Math.max(0, planningSince + SLOW_MS - Date.now()));
    return () => clearTimeout(id);
  }, [planningSince]);

  const waiting = server.status === "saving" || (server.status === "planning" && !gaveUp);
  const ready = animDone && !waiting && server.status !== "error";
  const plan = adaptation.plan;

  const who = adaptation.roleLabel && adaptation.domain
    ? t("readyForBoth", { role: adaptation.roleLabel, field: adaptation.domain.label })
    : adaptation.roleLabel
      ? t("readyForRole", { role: adaptation.roleLabel })
      : adaptation.domain
        ? t("readyForField", { field: adaptation.domain.label })
        : t("readyForYou");
  const delay = (i: number) => (reduce ? 0 : 0.3 + (i * STEP_MS) / 1000);

  const sourceNote =
    server.status === "planning"
      ? t("planLater")
      : server.status === "ready" && server.source === "baseline"
        ? server.failed
          ? t("standardSetupFailed", { reason: server.failed })
          : server.ai
            ? null
            : t("standardSetupNoAi")
        : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div aria-live="polite">
        <div className="text-sm font-medium text-brand-ink">{ready ? t("readyKicker") : animDone && waiting ? t("planningKicker") : t("buildingKicker")}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {ready ? t("readyTitle", { name }) : animDone && waiting ? t("planningTitle") : t("buildingTitle")}
        </h1>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {server.status === "error" ? (
          <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Surface pad="lg" className="flex flex-col gap-3 border-err-line">
              <p className="flex items-center gap-2 font-semibold text-err">
                <TriangleAlert className="size-5" aria-hidden />
                {t("saveFailed")}
              </p>
              <p className="text-sm text-ink-muted">{server.message}</p>
              <Button variant="outline" className="w-fit" onClick={onRetry}>
                <RotateCcw data-icon="inline-start" />
                {t("retry")}
              </Button>
            </Surface>
          </motion.div>
        ) : animDone && waiting ? (
          <motion.div key="planning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Surface pad="lg" className="flex flex-col gap-3 border-brand-line">
              <p className="flex items-center gap-2 font-semibold">
                <Loader2 className="size-5 animate-spin text-brand-ink motion-reduce:animate-none" aria-hidden />
                {t("planningBody")}
              </p>
              {slow ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                  {t("planningSlow")}
                  <Button variant="outline" size="sm" onClick={() => setGaveUp(true)}>
                    {t("continueStandard")}
                  </Button>
                </div>
              ) : null}
            </Surface>
          </motion.div>
        ) : ready ? (
          <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <Surface pad="lg" className="relative overflow-hidden border-brand-line">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,var(--accent-soft),transparent_60%)]" />
              <div className="relative flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-2 text-lg font-semibold">
                    <Sparkles className="size-5 text-brand-ink" aria-hidden />
                    {who}
                  </p>
                  <Chip size="sm" tone={adaptation.planSource === "ai" ? "accent" : "neutral"}>
                    {adaptation.planSource === "ai" ? t("plannedByAi") : t("standardSetup")}
                  </Chip>
                </div>
                {plan ? <p className="leading-relaxed">{plan.summary}</p> : null}
                <ul className="grid gap-1.5 text-sm text-ink-muted sm:grid-cols-2">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    {t(`readyOrder_${adaptation.order[0]}`)}
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    {t(`readySupport_${adaptation.supportSource}`, { level: t(`support_${adaptation.support}`) })}
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    {adaptation.analogyOpen ? t("sumAnalogyOpen") : t("sumAnalogyClosed")}
                  </li>
                  {plan ? (
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                      {plan.pacing.note}
                    </li>
                  ) : pace.studyDays.length ? (
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                      {t("sumPace", { minutes: pace.sessionMinutes, days: pace.studyDays.length })}
                    </li>
                  ) : null}
                </ul>
                {sourceNote ? <p className="text-xs text-ink-faint">{sourceNote}</p> : null}
                <Button size="xl" variant="brand" className="mt-2 w-fit" onClick={onGo}>
                  {t("goToCourse")}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </Surface>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ol className="relative flex flex-col gap-3">
        <motion.span
          aria-hidden
          className="absolute top-6 bottom-6 left-[2.35rem] w-px origin-top bg-[linear-gradient(var(--accent),var(--stage-gate))]"
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: (cards * STEP_MS) / 1000, ease: "linear", delay: 0.3 }}
        />
        {course.modules.map((m, i) => {
          const topics = moduleTopics(m);
          const done = m.authored ?? (authoredModules.includes(m.module_id) ? m.stages : []);
          const authored = m.stages.every((s) => done.includes(s));
          const partly = !authored && done.length > 0;
          const emphasis = plan?.modules.find((x) => x.moduleId === m.module_id)?.emphasis;
          return (
            <motion.li
              key={m.module_id}
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: delay(i), duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn("relative flex items-center gap-4 rounded-card border bg-panel p-3", authored || partly ? "border-line" : "border-dashed border-line")}
            >
              <ModuleArt index={i + 1} size="sm" className="h-14 w-[4.5rem] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  {t("moduleShort", { n: i + 1 })}
                  {ready && emphasis && emphasis !== "standard" ? <span className="font-medium text-brand-ink">{t(`emphasis_${emphasis}`)}</span> : null}
                </div>
                <div className="truncate font-semibold">{m.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {topics.map((tp, j) => (
                    <motion.span
                      key={tp.stage}
                      title={tp.title}
                      initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: delay(i) + 0.25 + j * 0.08, type: "spring", stiffness: 420, damping: 22 }}
                      className={cn("size-2.5 rounded-full", STAGE_META[tp.stage].solid)}
                    />
                  ))}
                  <span className="ml-1 text-xs text-ink-faint">{t("topicsN", { count: topics.length })}</span>
                </div>
              </div>
              <span className="hidden shrink-0 text-right text-xs sm:block">
                <span className="flex items-center justify-end gap-1 text-ink-faint">
                  <Clock className="size-3" aria-hidden />
                  {tc("minutes", { count: m.minutes })}
                </span>
                <span className={cn("mt-0.5 block font-medium", authored || partly ? "text-ok" : "text-ink-faint")}>
                  {authored ? t("moduleReady") : partly ? t("moduleVideosReady") : t("moduleComingSoon")}
                </span>
              </span>
            </motion.li>
          );
        })}
        <motion.li
          initial={reduce ? false : { opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: delay(course.modules.length), duration: 0.4 }}
          className="relative flex items-center gap-4 rounded-card border border-line bg-panel p-3"
        >
          <FinaleArt steps={course.finale.steps} className="h-14 w-[4.5rem] shrink-0 [&>span]:size-7 [&>span>svg]:size-3.5" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-faint">{course.finale.title}</div>
            <div className="truncate font-semibold">{course.finale.steps.map((s) => s.kicker).join(" · ")}</div>
          </div>
        </motion.li>
      </ol>

      {!animDone ? (
        <Button variant="ghost" className="w-fit" onClick={() => setAnimDone(true)}>
          {t("skipAnimation")}
        </Button>
      ) : null}
    </div>
  );
}
