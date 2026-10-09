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
import { TopicContext } from "@/components/player/topic-context";
import { useModuleProgress } from "@/components/player/progress";
import { TutorDock } from "@/components/player/tutor-dock";
import { HookCinema } from "@/components/player/hook/hook-cinema";
import { ModuleMap } from "@/components/player/module-map";
import { useWatchedVideos } from "@/components/player/video/watched";
import { ExplainerStage } from "@/components/player/stages/explainer-stage";
import { WorkedStage } from "@/components/player/stages/worked-stage";
import { GuidedStage } from "@/components/player/stages/guided-stage";
import { GateStage } from "@/components/player/stages/gate-stage";
import { ReviewStage } from "@/components/player/stages/review-stage";
import { ScenarioStage } from "@/components/player/stages/scenario-stage";
import { AdaptedStrip } from "@/components/player/adapted-strip";
import { getBlock } from "@/data/client";
import { useEnrollment } from "@/lib/enrollment";
import { currentPart, flatParts, moduleOutline, type ModulePart } from "@/lib/module-outline";
import { stageFromStepId, type StageId } from "@/lib/stages";
import { orderStages } from "@/lib/topics";
import type { ModuleContent, ScenarioBlock, Topic } from "@/data/types";

export type PlayerProps = {
  module: ModuleContent;
  /** 1-based position of the module in its course */
  moduleIndex: number;
  stage: StageId;
  /** the lesson video on screen, for the concept topic (its first when absent) */
  video?: string;
  courseHref: string;
  initialDone: StageId[];
  /** the module's topics from the course outline: each stage's own title */
  topics: Topic[];
  /** where finishing the module leads: the next module, or the course finale */
  after: { href: string; title: string };
};

/**
 * The module player (S4). URL is the source of truth for the current part,
 * so back/forward and deep links work. The map beside it lays the module out
 * under side headings, from the problem to the module check, with each lesson
 * video as its own part; every part opens on a click. The capstone, the
 * final check and the wrap-up live in the course finale.
 */
export function Player({ module, moduleIndex, stage, video, courseHref, initialDone, topics, after }: PlayerProps) {
  const t = useTranslations("player");
  const to = useTranslations("outline");
  const router = useRouter();
  const { done, complete } = useModuleProgress(module.module_id, initialDone);
  const { watched, markWatched } = useWatchedVideos();
  const { enrolled, adaptation } = useEnrollment(module.course_id);
  const [railOpen, setRailOpen] = React.useState(false);
  const moduleHref = `${courseHref}/${module.module_id}`;
  const setupHref = `${courseHref}/enroll`;

  // every topic of the module, in the learner's order ("see a full example first"
  // puts the watch-it-run topic before the explanation), split into parts
  const sections = React.useMemo(() => {
    const all = topics.length ? topics.map((x) => x.stage) : module.stages_included;
    return moduleOutline(module, topics, orderStages(all, adaptation.order[0] === "example"));
  }, [module, topics, adaptation.order]);
  const parts = flatParts(sections);
  const part = currentPart(parts, stage, video);
  const at = part ? parts.indexOf(part) : -1;
  const prevPart = at > 0 ? parts[at - 1] : undefined;
  const nextPart = at >= 0 && at < parts.length - 1 ? parts[at + 1] : undefined;
  const isDone = React.useCallback(
    (p: ModulePart) => (p.video ? watched.includes(p.video.id) || done.includes("explainer") : done.includes(p.stage)),
    [watched, done],
  );
  const doneKeys = React.useMemo(() => new Set(parts.filter(isDone).map((p) => p.key)), [parts, isDone]);

  const go = React.useCallback(
    (p: ModulePart) => {
      setRailOpen(false);
      router.push(`${moduleHref}/${p.path}`);
    },
    [moduleHref, router],
  );

  const onComplete = React.useCallback(() => {
    if (part?.video) {
      markWatched(part.video.id);
      // the concept topic is done once its last unwatched video is
      const videos = parts.filter((p) => p.video);
      if (videos.every((p) => p.key === part.key || watched.includes(p.video!.id))) complete("explainer");
    } else complete(stage);
    if (nextPart) go(nextPart);
    else {
      toast.success(t("moduleComplete", { next: after.title }));
      router.push(after.href);
    }
  }, [part, parts, watched, markWatched, complete, stage, nextPart, go, router, after, t]);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById("stage-main")?.focus({ preventScroll: true });
  }, [stage, video]);

  // Focus mode: ambient background motion pauses while a lesson is open
  // (ch13: no decorative movement in learning materials).
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.focus = "";
    return () => {
      delete root.dataset.focus;
    };
  }, []);

  const title = part?.title ?? topics.find((x) => x.stage === stage)?.title ?? module.title;
  const header = { stage, title, label: to("partOf", { n: (part?.n ?? 1), total: parts.length }) };
  const nav = { onPrev: prevPart ? () => go(prevPart) : undefined, onComplete, done: part ? isDone(part) : false };
  const objectives = module.metadata.objectives;
  const nextTitle = nextPart?.title ?? after.title;

  // a missed lesson in the module check points back to its own video
  const remediationHref = (stepId: string) => {
    // "m2.explain.2.3" -> lesson "2.3"
    const lesson = stepId.split(".").slice(2).join(".");
    const v = parts.find((p) => p.video?.lesson === lesson);
    return `${moduleHref}/${v ? v.path : (stageFromStepId(stepId) ?? "explainer")}`;
  };

  // The problem hook plays full screen, with no map, tutor or banners around it.
  const hook = stage === "hook" ? getBlock(module, "hook") : undefined;
  if (hook) {
    return (
      <HookCinema
        block={hook}
        moduleId={module.module_id}
        moduleIndex={moduleIndex}
        moduleTitle={module.title}
        courseTitle={module.course_title}
        objectives={objectives}
        adaptation={adaptation}
        nextTitle={nextTitle}
        done={nav.done}
        onComplete={onComplete}
        onExit={() => router.push(courseHref)}
      />
    );
  }

  let body: React.ReactNode;
  switch (stage) {
    case "explainer":
      body = <ExplainerStage block={getBlock(module, "explainer")!} adaptation={adaptation} videoId={part?.video?.id} nextTitle={nextTitle} {...nav} />;
      break;
    case "worked":
      body = <WorkedStage block={getBlock(module, "worked")!} {...nav} />;
      break;
    case "guided":
      body = <GuidedStage block={getBlock(module, "guided")!} adaptation={adaptation} {...nav} />;
      break;
    case "lab":
      body = <ScenarioStage block={getBlock(module, "lab") as ScenarioBlock} {...nav} />;
      break;
    case "gate":
      body = (
        <GateStage
          key={module.module_id}
          block={getBlock(module, "gate")!}
          objectives={objectives}
          checkId={`gate-${module.module_id}`}
          scope="module"
          remediationHref={remediationHref}
          {...nav}
        />
      );
      break;
    case "review":
      body = <ReviewStage block={getBlock(module, "review")!} {...nav} />;
      break;
  }

  const map = (
    <ModuleMap
      sections={sections}
      moduleHref={moduleHref}
      doneKeys={doneKeys}
      currentKey={part?.key}
      label={to("label")}
      onNavigate={() => setRailOpen(false)}
    />
  );

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
            <ProgressBar value={doneKeys.size / Math.max(1, parts.length)} size="sm" aria-label={t("topicsDone", { done: doneKeys.size, total: parts.length })} />
            <span className="shrink-0 text-xs text-ink-muted tabular-nums">
              {doneKeys.size}/{parts.length}
            </span>
          </div>
          <Sheet open={railOpen} onOpenChange={setRailOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="nav:hidden">
                <ListOrdered data-icon="inline-start" />
                {t("stagesButton")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto p-4" data-map-scroll>
              <SheetTitle className="mb-3 text-base">{to("label")}</SheetTitle>
              <SheetDescription className="sr-only">{module.title}</SheetDescription>
              {map}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex flex-1 gap-8 page-pad py-6 md:py-10">
        <aside data-map-scroll className="sticky top-[calc(var(--nav-h)+24px)] hidden max-h-[calc(100dvh-var(--nav-h)-48px)] w-72 shrink-0 overflow-y-auto pr-1 nav:block">
          <div className="mb-3 px-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">{to("label")}</div>
          {map}
        </aside>
        <main id="stage-main" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none">
          <AdaptedStrip stage={stage} adaptation={adaptation} enrolled={enrolled} setupHref={setupHref} />
          <TopicContext.Provider value={header}>{body}</TopicContext.Provider>
        </main>
      </div>

      <TutorDock module={module} topics={topics} locked={false} />
    </div>
  );
}
