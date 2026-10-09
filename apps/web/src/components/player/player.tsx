"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ProgressBar } from "@/components/kit/progress-ring";
import { TopicRail, type TopicRailItem } from "@/components/kit/stage";
import { TopicContext } from "@/components/player/topic-context";
import { useModuleProgress } from "@/components/player/progress";
import { TutorDock } from "@/components/player/tutor-dock";
import { HookStage } from "@/components/player/stages/hook-stage";
import { ExplainerStage } from "@/components/player/stages/explainer-stage";
import { WorkedStage } from "@/components/player/stages/worked-stage";
import { GuidedStage } from "@/components/player/stages/guided-stage";
import { ReviewStage } from "@/components/player/stages/review-stage";
import { AdaptedStrip } from "@/components/player/adapted-strip";
import { getBlock } from "@/data/client";
import { useEnrollment } from "@/lib/enrollment";
import { orderStages } from "@/lib/topics";
import { planTopicOrder } from "@/lib/learner-plan";
import { SignalProvider } from "@/lib/signals";
import type { ModuleContent, Topic } from "@/data/types";
import type { StageId } from "@/lib/stages";

export type PlayerProps = {
  module: ModuleContent;
  /** 1-based position of the module in its course */
  moduleIndex: number;
  stage: StageId;
  courseHref: string;
  initialDone: StageId[];
  /** the module's topics from the course outline: each stage's own title */
  topics: Topic[];
  /** where finishing the module leads: the next module, or the course finale */
  after: { href: string; title: string };
};

/**
 * The module player (S4). URL is the source of truth for the current topic,
 * so back/forward and deep links work. The rail lists the module's own topics
 * by title; the capstone, final check and wrap-up live in the course finale.
 */
export function Player({ module, moduleIndex, stage, courseHref, initialDone, topics, after }: PlayerProps) {
  const t = useTranslations("player");
  const router = useRouter();
  const { done, complete } = useModuleProgress(module.course_id, module.module_id, initialDone);
  const { enrolled, adaptation } = useEnrollment(module.course_id);
  const [railOpen, setRailOpen] = React.useState(false);
  const moduleHref = `${courseHref}/${module.module_id}`;
  const setupHref = `${courseHref}/enroll`;
  // every topic of the module, in the order the learner's plan sets (without a
  // plan, "see a full example first" puts the watch-it-run topic before the
  // explanation); only authored ones play
  const order = React.useMemo(() => {
    const all = topics.length ? topics.map((x) => x.stage) : module.stages_included;
    return planTopicOrder(adaptation.plan, module.module_id, all) ?? orderStages(all, adaptation.order[0] === "example");
  }, [topics, module.stages_included, module.module_id, adaptation.plan, adaptation.order]);
  const playable = order.filter((s) => module.stages_included.includes(s));
  const titleOf = (s: StageId) => topics.find((x) => x.stage === s)?.title ?? module.title;
  const pos = order.indexOf(stage);
  const at = playable.indexOf(stage);
  const prev = at > 0 ? playable[at - 1] : undefined;
  const next = at >= 0 && at < playable.length - 1 ? playable[at + 1] : undefined;

  const go = React.useCallback(
    (s: StageId) => {
      setRailOpen(false);
      router.push(`${moduleHref}/${s}`);
    },
    [moduleHref, router],
  );

  const onComplete = React.useCallback(() => {
    complete(stage);
    if (next) go(next);
    else {
      toast.success(t("moduleComplete", { next: after.title }));
      router.push(after.href);
    }
  }, [complete, stage, next, go, router, after, t]);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById("stage-main")?.focus({ preventScroll: true });
  }, [stage]);

  // Focus mode: ambient background motion pauses while a lesson is open
  // (ch13: no decorative movement in learning materials).
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.focus = "";
    return () => {
      delete root.dataset.focus;
    };
  }, []);

  const explainer = getBlock(module, "explainer");
  const lessons = explainer?.videos?.length
    ? explainer.videos.map((v) => `${v.lesson} ${v.title}`).join(" · ")
    : explainer?.segments.map((x) => `${x.lesson} ${x.title}`).join(" · ");
  const railItems: TopicRailItem[] = order.map((s) => {
    const b = module.blocks.find((x) => x.stage === s);
    const ready = module.stages_included.includes(s);
    return {
      id: s,
      stage: s,
      label: titleOf(s),
      sublabel: !ready ? t("topicComingSoon") : s === "explainer" ? lessons : undefined,
      state: !ready ? "absent" : s === stage ? "current" : done.includes(s) ? "done" : "todo",
      minutes: b?.duration_min,
    };
  });
  const header = { stage, title: titleOf(stage), label: t("topicOf", { n: pos + 1, total: order.length }) };

  const nav = { onPrev: prev ? () => go(prev) : undefined, onComplete, done: done.includes(stage) };
  const objectives = module.metadata.objectives;
  const doneCount = order.filter((s) => done.includes(s)).length;

  let body: React.ReactNode;
  switch (stage) {
    case "hook":
      body = (
        <HookStage block={getBlock(module, "hook")!} objectives={objectives} moduleIndex={moduleIndex} adaptation={adaptation} {...nav} />
      );
      break;
    case "explainer":
      body = <ExplainerStage block={getBlock(module, "explainer")!} adaptation={adaptation} {...nav} />;
      break;
    case "worked":
      body = <WorkedStage block={getBlock(module, "worked")!} {...nav} />;
      break;
    case "guided":
      body = <GuidedStage block={getBlock(module, "guided")!} adaptation={adaptation} {...nav} />;
      break;
    case "review":
      body = <ReviewStage block={getBlock(module, "review")!} {...nav} />;
      break;
  }

  const rail = <TopicRail items={railItems} label={t("stageRail")} onSelect={(id) => go(id as StageId)} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex h-(--nav-h) items-center gap-3 page-pad">
          <Button asChild variant="ghost" size="icon" aria-label={t("backToCourse")}>
            <Link href={courseHref}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-ink-muted">{module.course_title}</div>
            <div className="truncate font-semibold">{module.title}</div>
          </div>
          <div className="hidden w-48 items-center gap-3 sm:flex">
            <ProgressBar
              value={doneCount / order.length}
              size="sm"
              aria-label={t("topicsDone", { done: doneCount, total: order.length })}
            />
            <span className="shrink-0 text-xs text-ink-muted tabular-nums">
              {doneCount}/{order.length}
            </span>
          </div>
          <Sheet open={railOpen} onOpenChange={setRailOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="nav:hidden">
                <ListOrdered data-icon="inline-start" />
                {t("stagesButton")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="mb-3 text-base">{t("stageRail")}</SheetTitle>
              <SheetDescription className="sr-only">{module.title}</SheetDescription>
              {rail}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex flex-1 gap-8 page-pad py-6 md:py-10">
        <aside className="sticky top-[calc(var(--nav-h)+24px)] hidden h-fit w-64 shrink-0 nav:block">
          <div className="mb-3 px-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("stageRail")}</div>
          {rail}
        </aside>
        <main id="stage-main" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none">
          <AdaptedStrip stage={stage} moduleId={module.module_id} adaptation={adaptation} enrolled={enrolled} setupHref={setupHref} />
          <SignalProvider courseId={module.course_id} enabled={enrolled}>
            <TopicContext.Provider value={header}>{body}</TopicContext.Provider>
          </SignalProvider>
        </main>
      </div>

      <TutorDock module={module} topics={topics} locked={false} />
    </div>
  );
}
