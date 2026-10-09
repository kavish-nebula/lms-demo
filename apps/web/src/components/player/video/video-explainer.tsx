"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Globe2, Lightbulb } from "lucide-react";
import { Surface } from "@/components/kit/surface";
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
  const world = adaptation.domain ? WORLD[video.lesson] : undefined;

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

      {world && adaptation.domain ? (
        <Callout tone="worked" label={t("inYourWorld", { field: adaptation.domain.label })} icon={<Globe2 />}>
          {world(adaptation.domain)}
        </Callout>
      ) : null}

      {video.notes.length ? (
        <Surface pad="md" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-brand-ink" aria-hidden />
            {t("keyIdeas", { lesson: video.lesson })}
          </h2>
          <ul className="flex flex-col gap-2">
            {video.notes.map((n) => (
              <li key={n} className="flex gap-2.5 text-sm leading-relaxed">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {n}
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </StageShell>
  );
}
