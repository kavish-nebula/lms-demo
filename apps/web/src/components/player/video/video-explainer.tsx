"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Check, ChevronDown, Globe2, Lightbulb, PlayCircle } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { VideoLesson } from "@/components/player/video/video-lesson";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import { WORLD } from "@/lib/world";
import { planLesson } from "@/lib/learner-plan";
import { supportFor } from "@/lib/setup";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Adaptation } from "@/lib/setup";
import type { ExplainerBlock } from "@/data/types";
import type { StageProps } from "@/components/player/stages/types";

const KEY = "lms-videos-watched";
const NONE: string[] = [];

/**
 * The concept topic taught by narrated slide videos, one per lesson. Pick a
 * lesson, watch it (it pauses for short checks), and the next one is lined
 * up. Below the video: the idea restated in the learner's field, and the
 * lesson's key ideas. The topic is complete once every video is watched.
 */
export function VideoExplainer({ block, adaptation, ...nav }: StageProps<ExplainerBlock> & { adaptation: Adaptation }) {
  const t = useTranslations("video");
  const videos = block.videos!;
  const watched = useLocalJson<string[]>(KEY, NONE);
  const firstOpen = videos.findIndex((v) => !watched.includes(v.id));
  const [current, setCurrent] = React.useState(firstOpen < 0 ? 0 : firstOpen);
  const video = videos[current]!;
  const allWatched = videos.every((v) => watched.includes(v.id));
  const nextIndex = videos.findIndex((v, i) => i > current && !watched.includes(v.id));
  const fromPlan = planLesson(adaptation.plan, video.lesson);
  const template = adaptation.domain && WORLD[video.lesson] ? WORLD[video.lesson]!(adaptation.domain) : "";
  const world = fromPlan?.inYourWorld.body ? fromPlan.inYourWorld : template ? { title: "", body: template } : null;
  const light = supportFor(adaptation, video.lesson) === "light";

  const markWatched = React.useCallback(
    (id: string) => {
      const now = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
      if (!now.includes(id)) writeLocal(KEY, JSON.stringify([...now, id]));
    },
    [],
  );

  return (
    <StageShell
      stage="explainer"
      title={video.title}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={allWatched || nav.done}
      completeHint={t("watchAll", { count: videos.length })}
      {...nav}
    >
      <div role="tablist" aria-label={t("lessons")} className="grid gap-2 sm:grid-cols-3">
        {videos.map((v, i) => {
          const on = i === current;
          const done = watched.includes(v.id);
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setCurrent(i)}
              className={cn(
                "relative flex items-start gap-2.5 rounded-card border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                on ? "border-transparent" : "border-line hover:border-brand-line",
              )}
            >
              {on ? (
                <motion.span
                  layoutId="video-tab"
                  className="absolute inset-0 rounded-card border border-brand-line bg-brand-soft"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span
                className={cn(
                  "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5",
                  done ? "bg-ok text-on-ok" : "bg-panel-2 text-ink-muted",
                )}
              >
                {done ? <Check aria-hidden /> : <PlayCircle aria-hidden />}
              </span>
              <span className="relative min-w-0">
                <span className="block font-mono text-xs text-ink-faint">{v.lesson}</span>
                <span className={cn("block text-sm leading-snug font-medium", on && "text-brand-ink")}>{v.title}</span>
                <span className="block text-xs text-ink-faint">{t("slidesN", { count: v.slides.length })}</span>
              </span>
            </button>
          );
        })}
      </div>

      <VideoLesson
        key={video.id}
        video={video}
        onComplete={() => markWatched(video.id)}
        onNext={nextIndex >= 0 ? () => setCurrent(nextIndex) : nav.onComplete}
        nextLabel={nextIndex >= 0 ? t("nextVideo", { title: videos[nextIndex]!.title }) : t("finishTopic")}
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
