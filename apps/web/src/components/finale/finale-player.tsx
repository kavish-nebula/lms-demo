"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ListOrdered, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ProgressBar } from "@/components/kit/progress-ring";
import { CardSkeleton } from "@/components/kit/states";
import { TopicRail, type TopicRailItem } from "@/components/kit/stage";
import { TopicContext } from "@/components/player/topic-context";
import { GateStage } from "@/components/player/stages/gate-stage";
import { CapstoneStage } from "@/components/finale/capstone-stage";
import { WrapUpStage } from "@/components/finale/wrap-up-stage";
import { useCourseProgress } from "@/lib/course-progress";
import { useEnrollment } from "@/lib/enrollment";
import { useFinale } from "@/lib/finale";
import { useLearnerReady } from "@/lib/api";
import { queueSignal } from "@/lib/signals";
import type { Course, FinaleContent, FinaleStepId } from "@/data/types";

/**
 * The course finale player: capstone, final check and wrap-up, once, after
 * every module is finished. Same layout as the module player. A locked step
 * opens as a preview so the finale can be seen before it is reached.
 */
export function FinalePlayer({
  course,
  finale,
  step,
  authoredModules,
  hasProject = false,
}: {
  course: Course;
  finale: FinaleContent;
  step: FinaleStepId;
  /** modules with lesson content, so "revisit" links can open the lesson itself */
  authoredModules: string[];
  /** the mini project is built in the browser, in its workspace */
  hasProject?: boolean;
}) {
  const t = useTranslations("finale");
  const tp = useTranslations("player");
  const router = useRouter();
  const hydrated = useLearnerReady();
  const progress = useCourseProgress(course);
  const { state, markDone, recordFinal } = useFinale(course.course_id);
  const { adaptation, enrolled } = useEnrollment(course.course_id);
  const [railOpen, setRailOpen] = React.useState(false);
  const courseHref = `/learn/courses/${course.course_id}`;

  const steps = progress.finale;
  const i = steps.findIndex((f) => f.step.id === step);
  const current = steps[i]!;
  const prev = steps[i - 1];
  const next = steps[i + 1];
  const preview = current.locked;

  const go = React.useCallback(
    (id: string) => {
      setRailOpen(false);
      router.push(`${courseHref}/finale/${id}`);
    },
    [courseHref, router],
  );

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById("stage-main")?.focus({ preventScroll: true });
  }, [step]);

  // Focus mode: ambient motion pauses while the finale is open
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.focus = "";
    return () => {
      delete root.dataset.focus;
    };
  }, []);

  const remediationHref = (stepId: string) => {
    const moduleId = stepId.split(".")[0] ?? "";
    return authoredModules.includes(moduleId) ? `${courseHref}/${moduleId}/explainer` : `${courseHref}#module-${moduleId}`;
  };

  const railItems: TopicRailItem[] = steps.map((f) => ({
    id: f.step.id,
    stage: f.step.stage,
    label: f.step.kicker,
    sublabel: f.step.title,
    state: f.step.id === step ? "current" : f.done ? "done" : f.locked ? "locked" : "todo",
    minutes: f.step.minutes,
  }));
  const rail = <TopicRail items={railItems} label={t("railLabel")} onSelect={go} />;
  const doneCount = steps.filter((f) => f.done).length;
  const header = {
    stage: current.step.stage,
    title: current.step.title,
    label: `${current.step.kicker} · ${t("stepOf", { n: i + 1, total: steps.length })}`,
  };

  let body: React.ReactNode;
  if (!hydrated) body = <CardSkeleton lines={6} />;
  else if (step === "capstone")
    body = (
      <CapstoneStage
        block={finale.capstone}
        preview={preview}
        roleKey={adaptation.roleKey}
        roleLabel={adaptation.roleLabel}
        planBrief={adaptation.plan?.capstoneBrief ?? null}
        workspace={hasProject ? { href: `/learn/courses/${course.course_id}/finale/capstone/workspace`, courseId: course.course_id, enrolled } : null}
        done={current.done}
        onComplete={() => {
          if (!current.done) markDone("capstone", { capstoneAt: new Date().toISOString() });
          if (next) go(next.step.id);
        }}
      />
    );
  else if (step === "final-check")
    body = (
      <GateStage
        block={finale.final}
        objectives={finale.objectives}
        checkId="final"
        remediationHref={remediationHref}
        preview={preview}
        onGraded={(r) => {
          recordFinal(r.score, r.total, r.passed);
          if (enrolled)
            queueSignal(course.course_id, {
              kind: "final_check",
              // each missed area names its lesson, or its module number when the check covers a whole module
              payload: {
                score: r.score,
                total: r.total,
                passed: r.passed,
                missedLessons: r.failedObjectives.map((id) => finale.objectives.find((o) => o.id === id)?.lesson ?? id.replace(/^obj-/, "")),
              },
            });
        }}
        onPrev={prev ? () => go(prev.step.id) : undefined}
        onComplete={() => next && go(next.step.id)}
        done={current.done}
      />
    );
  else
    body = (
      <WrapUpStage
        course={course}
        finale={finale}
        progress={progress}
        state={state}
        preview={preview}
        onPrev={prev ? () => go(prev.step.id) : undefined}
        onComplete={() => {
          markDone("wrap-up", { completedAt: new Date().toISOString() });
          toast.success(t("toastComplete", { course: course.title }));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex h-(--nav-h) items-center gap-3 page-pad">
          <Button asChild variant="ghost" size="icon" aria-label={tp("backToCourse")}>
            <Link href={`${courseHref}#finale`}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-ink-muted">{course.title}</div>
            <div className="truncate font-semibold">{course.finale.title}</div>
          </div>
          <div className="hidden w-48 items-center gap-3 sm:flex">
            <ProgressBar value={doneCount / steps.length} size="sm" aria-label={t("stepsDone", { done: doneCount, total: steps.length })} />
            <span className="shrink-0 text-xs text-ink-muted tabular-nums">
              {doneCount}/{steps.length}
            </span>
          </div>
          <Sheet open={railOpen} onOpenChange={setRailOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="nav:hidden">
                <ListOrdered data-icon="inline-start" />
                {tp("stagesButton")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="mb-3 text-base">{t("railLabel")}</SheetTitle>
              <SheetDescription className="sr-only">{course.finale.summary}</SheetDescription>
              {rail}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex flex-1 gap-8 page-pad py-6 md:py-10">
        <aside className="sticky top-[calc(var(--nav-h)+24px)] hidden h-fit w-64 shrink-0 nav:block">
          <div className="mb-3 px-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("railLabel")}</div>
          {rail}
        </aside>
        <main id="stage-main" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none">
          {hydrated && preview ? (
            <div
              role="status"
              className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-card border border-warn-line bg-warn-soft px-4 py-3 text-sm"
            >
              <Lock className="size-4 shrink-0 text-warn" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{t("previewTitle")}</span>{" "}
                {progress.allModulesDone
                  ? t("lockedAfter", { step: prev?.step.kicker ?? "" })
                  : t("lockedModules", { done: progress.modulesDone, total: progress.modules.length })}
              </span>
              {!progress.allModulesDone ? (
                <Button asChild size="sm" variant="outline" className="bg-transparent">
                  <Link href={`${courseHref}#modules`}>{t("seeModules")}</Link>
                </Button>
              ) : prev ? (
                <Button size="sm" variant="outline" className="bg-transparent" onClick={() => go(prev.step.id)}>
                  {t("goTo", { step: prev.step.kicker })}
                </Button>
              ) : null}
            </div>
          ) : null}
          <TopicContext.Provider value={header}>{body}</TopicContext.Provider>
        </main>
      </div>
    </div>
  );
}
