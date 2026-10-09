"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock3, ListChecks, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoLesson } from "@/components/player/video/video-lesson";
import type { ConceptVideo, Course } from "@/data/types";

/**
 * The course preview, between "About you" and the quick check: a narrated
 * video of about a minute that earns the learner's trust by showing them the
 * end of the course: the agent they will have built, working; what they will
 * be able to do; what it takes; and what they will walk away with. It does not
 * tour the course. Watching it is encouraged, never required.
 */
export function IntroStep({ course, video, onDone }: { course: Course; video: ConceptVideo; onDone: () => void }) {
  const t = useTranslations("enroll");
  const [watched, setWatched] = React.useState(false);
  const words = video.slides.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
  const minutes = Math.max(1, Math.round(words / 150));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <div className="text-sm font-medium text-brand-ink">{t("introKicker")}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{t("introTitle", { course: course.title })}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">{t("introBody")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: <Clock3 />, text: t("introLength", { minutes }) },
          { icon: <Rocket />, text: t("introWhat") },
          { icon: <ListChecks />, text: t("introThen") },
        ].map((r) => (
          <li key={r.text} className="flex items-start gap-2.5 rounded-lg border border-line bg-panel-2/60 p-3 text-sm">
            <span className="mt-0.5 shrink-0 text-brand-ink [&_svg]:size-4">{r.icon}</span>
            {r.text}
          </li>
        ))}
      </ul>
      <VideoLesson video={video} onComplete={() => setWatched(true)} onNext={onDone} nextLabel={t("introNext")} />
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button size="lg" variant={watched ? "brand" : "outline"} className={watched ? undefined : "bg-transparent"} onClick={onDone}>
          {watched ? t("introNext") : t("introSkip")}
          <ArrowRight data-icon="inline-end" />
        </Button>
        {!watched ? <span className="text-sm text-ink-faint">{t("introSkipNote")}</span> : null}
      </div>
    </div>
  );
}
