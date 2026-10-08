"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PartyPopper, Play } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { TopicChip } from "@/components/kit/stage";
import { ProgressRing } from "@/components/kit/progress-ring";
import { Button } from "@/components/ui/button";
import type { CourseProgress } from "@/lib/course-progress";
import type { Course } from "@/data/types";

/**
 * "Continue where you left off" panel, from what the player stored: the next
 * topic by its own title, or the next finale step once every module is done.
 * Accent-soft surface so it reads first.
 */
export function ResumeCard({ course, progress }: { course: Course; progress: CourseProgress }) {
  const t = useTranslations("home");
  const resume = progress.resume;

  if (!resume) {
    const complete = progress.complete;
    return (
      <Surface tone="accent" pad="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-ok-soft text-ok">
          <PartyPopper className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-brand-ink">{complete ? t("courseComplete") : t("modulesComplete")}</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{course.title}</h2>
        </div>
        <Button asChild size="lg" variant="outline" className="bg-transparent">
          <Link href={complete ? `/learn/courses/${course.course_id}/finale/wrap-up` : `/learn/courses/${course.course_id}#modules`}>
            {complete ? t("viewResults") : t("revisitCourse")}
          </Link>
        </Button>
      </Surface>
    );
  }

  const started = progress.topicsDone > 0;
  const where = resume.kind === "module" ? t("moduleOfCourse", { n: resume.moduleIndex, course: course.title }) : `${resume.group} · ${course.title}`;

  return (
    <Surface tone="accent" pad="lg" spotlight className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <ProgressRing
        value={(resume.n - 1) / resume.total}
        size={84}
        stroke={7}
        label={`${resume.n}/${resume.total}`}
        aria-label={t("topicOf", { n: resume.n, total: resume.total })}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-brand-ink">{started ? t("resume") : t("readyToStart")}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-balance">{resume.title}</h2>
        <div className="mt-0.5 text-sm text-ink-muted">{where}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-muted">
          <TopicChip stage={resume.stage}>{t("topicOf", { n: resume.n, total: resume.total })}</TopicChip>
          <span aria-hidden>·</span>
          <span>{t("minutesLeftTopic", { count: resume.minutesLeft })}</span>
        </div>
      </div>
      <Button asChild size="xl" variant="brand" className="sm:self-center">
        <Link href={resume.href}>
          <Play data-icon="inline-start" />
          {started ? t("resumeCta") : t("startCta")}
        </Link>
      </Button>
    </Surface>
  );
}
