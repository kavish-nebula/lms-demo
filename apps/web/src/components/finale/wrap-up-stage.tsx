"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Award, Boxes, CalendarRange, Clock3, GraduationCap, Hammer, LayoutDashboard, PartyPopper, RotateCcw, ShieldCheck } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { StatTile } from "@/components/kit/stat-tile";
import { DEMO_OPEN } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { StageShell } from "@/components/player/stage-shell";
import { ReflectionPrompt } from "@/components/player/stages/reflection-stage";
import { CredentialCard } from "@/components/learn/credential-card";
import { topicOf } from "@/lib/topics";
import type { CourseProgress } from "@/lib/course-progress";
import type { FinaleState } from "@/lib/finale";
import type { Course, Credential, FinaleContent } from "@/data/types";

/** The course credential, issued locally once the wrap-up is finished. */
export function courseCredential(course: Course, completedAt: string): Credential {
  return {
    credential_id: `${course.course_id}-${completedAt.slice(0, 10)}`,
    kind: "course",
    title: course.title,
    course_title: course.provider,
    issued_at: completedAt.slice(0, 10),
    verify_url: `/verify/${course.course_id}`,
  };
}

/**
 * The course wrap-up, once, after the final check: what you built, real
 * figures from your progress, three reflection prompts, your credential and
 * what comes next. Hours of manual work, when a course has them, are its own estimates.
 */
export function WrapUpStage({
  course,
  finale,
  progress,
  state,
  preview,
  onPrev,
  onComplete,
}: {
  course: Course;
  finale: FinaleContent;
  progress: CourseProgress;
  state: FinaleState;
  preview: boolean;
  onPrev?: () => void;
  onComplete: () => void;
}) {
  const t = useTranslations("finale");
  const tp = useTranslations("player");
  const reduce = useReducedMotion();
  const block = finale.wrap_up;
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const reflected = block.prompts.every((p) => (counts[p.id] ?? 0) >= block.min_sentences);
  const complete = !!state.completedAt;
  const capstoneDone = state.done.includes("capstone");

  const built = [
    ...progress.modules
      .filter((m) => m.stages.includes("guided") && m.done.includes("guided"))
      .map((m) => ({ id: m.module_id, title: topicOf(m, "guided")?.topic.title ?? m.title, sub: m.title })),
    ...(capstoneDone ? [{ id: "capstone", title: finale.capstone.project_name, sub: finale.capstone.title }] : []),
  ];
  // hours of manual work only apply to courses that estimate them
  const hasHours = finale.capstone.hours_saved != null || course.modules.some((m) => m.hours_saved != null);
  const hours =
    progress.modules.filter((m) => m.liveState === "done").reduce((n, m) => n + (m.hours_saved ?? 0), 0) +
    (capstoneDone ? (finale.capstone.hours_saved ?? 0) : 0);
  const percent = state.score != null && state.total ? Math.round((state.score / state.total) * 100) : null;

  const headline = complete ? t("completeTitle") : state.passed ? t("lastStepTitle") : t("oneThingLeft");
  const sub = complete ? t("completeBody", { course: course.title }) : state.passed ? t("lastStepBody") : t("oneThingLeftBody");

  return (
    <StageShell stage="reflection" title={headline} minutes={block.duration_min} hideFooter done={complete}>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Surface pad="lg" tone={complete ? "accent" : "default"} spotlight className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full [&_svg]:size-7",
              complete ? "bg-ok-soft text-ok" : "bg-panel-2 text-ink-faint",
            )}
          >
            {complete ? <PartyPopper aria-hidden /> : <GraduationCap aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-tight">{headline}</p>
            <p className="mt-1 text-ink-muted">{sub}</p>
          </div>
        </Surface>
      </motion.div>

      <div className={cn("grid grid-cols-2 gap-3 md:gap-4", hasHours ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        <StatTile
          icon={<ShieldCheck />}
          value={percent ?? "—"}
          suffix={percent != null ? "%" : undefined}
          label={t("statFinal")}
          hint={state.passed ? t("statPassed") : undefined}
        />
        <StatTile
          icon={<Boxes />}
          value={progress.modulesDone}
          label={t("statModules")}
          hint={t("ofModules", { total: progress.modules.length })}
        />
        <StatTile icon={<Hammer />} value={built.length} label={t("statBuilt")} />
        {hasHours ? <StatTile icon={<Clock3 />} value={hours} suffix=" h" label={t("statHours")} hint={t("estimateShort")} /> : null}
      </div>

      <Surface pad="md" className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("whatYouBuilt")}</h2>
        {built.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {built.map((b) => (
              <li key={b.id} className="flex items-start gap-3 rounded-lg border border-line bg-panel-2/50 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-stage-project-line bg-stage-project-soft text-stage-project [&_svg]:size-4">
                  <Hammer aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{b.title}</span>
                  <span className="block text-sm text-ink-faint">{b.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">{t("nothingBuiltYet")}</p>
        )}
      </Surface>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("reflectTitle")}</h2>
        <p className="-mt-2 text-ink-muted">{t("reflectIntro")}</p>
        {block.prompts.map((p, i) => (
          <ReflectionPrompt
            key={p.id}
            id={`${course.course_id}:finale:${p.id}`}
            index={i}
            label={tp(`reflect_${p.kind}`)}
            text={p.text}
            min={block.min_sentences}
            disabled={preview}
            onCount={(n) => setCounts((c) => (c[p.id] === n ? c : { ...c, [p.id]: n }))}
          />
        ))}
      </div>

      {complete ? (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Award className="size-5 text-brand-ink" aria-hidden />
            {t("yourCredential")}
          </h2>
          <div className="max-w-md">
            <CredentialCard credential={courseCredential(course, state.completedAt!)} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-card border border-dashed border-line p-4 text-sm text-ink-muted">
          <Award className="size-5 shrink-0 text-ink-faint" aria-hidden />
          {t("credentialPending")}
        </div>
      )}

      <Surface pad="md" className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("whatsNext")}</h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            { href: "/learn/reviews", icon: <RotateCcw />, title: t("nextReviews"), body: t("nextReviewsBody") },
            { href: "/learn/plan", icon: <CalendarRange />, title: t("nextPlan"), body: t("nextPlanBody") },
            { href: `/learn/courses/${course.course_id}#modules`, icon: <Boxes />, title: t("nextRevisit"), body: t("nextRevisitBody") },
          ].map((x) => (
            <li key={x.href}>
              <Link
                href={x.href}
                className="flex h-full flex-col gap-1 rounded-lg border border-line p-3 outline-none hover:border-brand-line focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-brand-ink">
                  {x.icon}
                  {x.title}
                </span>
                <span className="text-sm text-ink-muted">{x.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Surface>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {onPrev ? (
          <Button variant="ghost" onClick={onPrev}>
            {t("back")}
          </Button>
        ) : (
          <span />
        )}
        {complete ? (
          <Button asChild size="lg" variant="brand">
            <Link href="/learn">
              <LayoutDashboard data-icon="inline-start" />
              {t("toDashboard")}
            </Link>
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            {!reflected ? (
              <span className="hidden text-sm text-ink-faint sm:inline">{tp("minSentencesEach", { count: block.min_sentences })}</span>
            ) : null}
            {/* the demo lets anyone finish; in the real course it waits for a passed final check and the reflection */}
            <Button size="lg" variant="brand" disabled={!DEMO_OPEN && (preview || !state.passed || !reflected)} onClick={onComplete}>
              <GraduationCap data-icon="inline-start" />
              {t("finishCourse")}
            </Button>
          </div>
        )}
      </div>
    </StageShell>
  );
}
