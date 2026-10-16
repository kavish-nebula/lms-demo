"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { planLesson } from "@/lib/learner-plan";
import { Globe2, Lightbulb } from "lucide-react";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { VideoLesson } from "@/components/player/video/video-lesson";
import { useWatchedVideos } from "@/components/player/video/watched";
import { videoMinutes } from "@/lib/module-outline";
import { WORLD } from "@/lib/world";
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
  // the planner's example for this learner (their field and role), else the field's template
  const planned = planLesson(adaptation.plan, video.lesson)?.inYourWorld;
  const template = adaptation.domain ? WORLD[video.lesson] : undefined;
  const world = planned?.body
    ? { label: planned.title || t("inYourWorld", { field: adaptation.domain?.label ?? t("yourWork") }), body: planned.body }
    : template && adaptation.domain
      ? { label: t("inYourWorld", { field: adaptation.domain.label }), body: template(adaptation.domain) }
      : null;

  return (
    <StageShell
      stage="explainer"
      title={`${video.lesson} ${video.title}`}
      minutes={videoMinutes(video)}
      bloom={block.bloom}
      completeLabel={nextTitle ? to("nextPart", { title: nextTitle }) : undefined}
      separateCards
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

      <div className="concept-text-cards" aria-label="Lesson reading cards">
        {adaptation.support === "extra" && <Callout className="concept-text-card" tone="worked" label="A little guidance before you begin" icon={<Lightbulb />}>
          <p className="text-sm">{video.notes[0]} Pause whenever you need to, or ask Pip about this slide. Your place is saved.</p>
        </Callout>}

        {world ? (
          <Callout className="concept-text-card" tone="worked" label={world.label} icon={<Globe2 />}>
            {world.body}
          </Callout>
        ) : null}

        {video.notes.length ? (
          <details key={`${video.id}:${adaptation.support}`} open={adaptation.support !== "light"} className="concept-text-card">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <Lightbulb className="size-4 text-brand-ink" aria-hidden />
              {t("keyIdeas", { lesson: video.lesson })}
            </summary>
            <ul className="mt-4 flex flex-col gap-2">
              {video.notes.map((n) => (
                <li key={n} className="flex gap-2.5 text-sm leading-relaxed">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                  {n}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </StageShell>
  );
}
