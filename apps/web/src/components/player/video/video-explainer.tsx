"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ChevronDown, Globe2, Lightbulb } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { VideoLesson } from "@/components/player/video/video-lesson";
import { useWatchedVideos } from "@/components/player/video/watched";
import { videoMinutes } from "@/lib/module-outline";
import { WORLD } from "@/lib/world";
import { planLesson } from "@/lib/learner-plan";
import { supportFor } from "@/lib/setup";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Adaptation } from "@/lib/setup";
import type { ExplainerBlock } from "@/data/types";
import type { StageProps } from "@/components/player/stages/types";

/**
 * One lesson of the concept topic: its narrated slide video (it pauses for
 * short checks), then the idea restated in the learner's field and the
 * lesson's key ideas. Each lesson is its own part of the module, so the
 * player's map and "Complete and continue" move from video to video.
 */
export function VideoExplainer({
  block,
  adaptation,
  videoId,
  nextTitle,
  ...nav
}: StageProps<ExplainerBlock> & { adaptation: Adaptation; videoId?: string; nextTitle?: string }) {
  const t = useTranslations("video");
  const to = useTranslations("outline");
  const videos = block.videos!;
  const video = videos.find((v) => v.id === videoId) ?? videos[0]!;
  const { watched, markWatched } = useWatchedVideos();
  // the learner's plan writes an example for every lesson; without one, the field's template (when the lesson has one)
  const fromPlan = planLesson(adaptation.plan, video.lesson);
  const template = adaptation.domain && WORLD[video.lesson] ? WORLD[video.lesson]!(adaptation.domain) : "";
  const world = fromPlan?.inYourWorld.body ? fromPlan.inYourWorld : template ? { title: "", body: template } : null;
  const light = supportFor(adaptation, video.lesson) === "light";

  return (
    <StageShell
      stage="explainer"
      title={`${video.lesson} ${video.title}`}
      minutes={videoMinutes(video)}
      bloom={block.bloom}
      completeLabel={nextTitle ? to("nextPart", { title: nextTitle }) : undefined}
      {...nav}
      done={nav.done || watched.includes(video.id)}
    >
      <VideoLesson
        key={video.id}
        video={video}
        onComplete={() => markWatched(video.id)}
        onNext={nav.onComplete}
        nextLabel={nextTitle ? to("nextPart", { title: nextTitle }) : t("finishTopic")}
      />

      {world ? (
        <Callout
          tone="worked"
          label={world.title || (adaptation.domain ? t("inYourWorld", { field: adaptation.domain.label }) : t("inYourWorldPlain"))}
          icon={<Globe2 />}
        >
          {world.body}
        </Callout>
      ) : null}

      {video.notes.length ? <KeyIdeas key={`ideas-${video.id}`} lesson={video.lesson} notes={video.notes} defaultOpen={!light} /> : null}
    </StageShell>
  );
}

/** The lesson's key ideas: open, or folded away when the plan gives this lesson a light touch. */
function KeyIdeas({ lesson, notes, defaultOpen }: { lesson: string; notes: string[]; defaultOpen: boolean }) {
  const t = useTranslations("video");
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Surface pad="md" className="flex flex-col gap-3">
        <CollapsibleTrigger className="flex items-center gap-2 rounded text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <Lightbulb className="size-4 text-brand-ink" aria-hidden />
          <span className="flex-1">{t("keyIdeas", { lesson })}</span>
          <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n} className="flex gap-2.5 text-sm leading-relaxed">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {n}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Surface>
    </Collapsible>
  );
}
