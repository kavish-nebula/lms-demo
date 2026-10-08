"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Check, Clock, Star } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { ProgressBar } from "@/components/kit/progress-ring";
import { NebulaMark } from "@/components/kit/logo";
import { Carousel, CarouselSlide } from "@/components/kit/carousel";
import { Button } from "@/components/ui/button";
import { FinaleArt, ModuleArt } from "@/components/course/module-art";
import { EnrollCta } from "@/components/course/enroll-cta";
import { useEnrollment } from "@/lib/enrollment";
import { useCourseProgress } from "@/lib/course-progress";
import type { Course } from "@/data/types";

/**
 * Catalog card (Coursera program card): provider, title, skills, rating,
 * meta and actions on the left; a draggable carousel of its modules on the
 * right. "View details" opens the full course page.
 */
export function ProgramCard({ course }: { course: Course }) {
  const t = useTranslations("course");
  const tc = useTranslations("common");
  const { enrolled } = useEnrollment(course.course_id);
  const progress = useCourseProgress(course);
  const href = `/learn/courses/${course.course_id}`;
  const total = course.modules.length;

  return (
    <Surface pad="lg" spotlight className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-panel-2">
            <NebulaMark size={20} />
          </span>
          {course.provider}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          <Link href={href} className="underline-offset-4 outline-none hover:underline focus-visible:underline">
            {course.title}
          </Link>
        </h2>
        <p className="line-clamp-2 text-sm text-ink-muted">
          <span className="font-semibold text-ink">{t("skillsGain")}:</span> {course.skills.join(", ")}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <Star className="size-4 text-ink-faint" aria-hidden />
          <span className="text-ink-muted">{t("noRatingsYet")}</span>
        </div>
        <div className="text-sm text-ink-muted">
          {course.level} · {t("modulesCount", { count: total })} · {t("aboutHours", { hours: course.estimated_hours })}
        </div>

        {enrolled ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{t("enrolledChip")}</span>
              <span className="tabular-nums">{Math.round(progress.ratio * 100)}%</span>
            </div>
            <ProgressBar value={progress.ratio} size="sm" aria-label={t("progressLabel")} />
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <EnrollCta course={course} size="lg" showEdit={false} />
          <Button asChild variant="link" className="px-2">
            <Link href={href}>{t("viewDetails")}</Link>
          </Button>
        </div>
      </div>

      <Carousel label={t("modulesCarousel", { course: course.title })} prevLabel={tc("previous")} nextLabel={tc("next")}>
        {progress.modules.map((m) => {
          const state = enrolled ? m.liveState : "available";
          return (
            <CarouselSlide key={m.module_id} label={t("moduleOf", { n: m.index, total })} className="w-[220px] sm:w-[240px]">
              <Link
                href={`${href}#module-${m.module_id}`}
                draggable={false}
                className="group flex h-full flex-col gap-3 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <ModuleArt index={m.index} className="aspect-[4/3] w-full transition-transform duration-(--dur-2) group-hover:-translate-y-1" />
                <div className="flex flex-col gap-1 px-0.5">
                  <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{m.title}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    {t("moduleOf", { n: m.index, total })}
                    <span aria-hidden>·</span>
                    <Clock className="size-3" aria-hidden />
                    {tc("minutes", { count: m.minutes })}
                  </span>
                  {enrolled ? (
                    <span className={cn("inline-flex items-center gap-1 text-xs", state === "done" ? "text-ok" : "text-brand-ink")}>
                      {state === "done" ? <Check className="size-3" aria-hidden /> : null}
                      {t(`state_${state}`)}
                    </span>
                  ) : m.index === 1 ? (
                    <Chip size="sm" tone="accent" className="mt-0.5">
                      {t("startsHere")}
                    </Chip>
                  ) : null}
                </div>
              </Link>
            </CarouselSlide>
          );
        })}
        <CarouselSlide label={course.finale.title} className="w-[220px] sm:w-[240px]">
          <Link
            href={`${href}#finale`}
            draggable={false}
            className="group flex h-full flex-col gap-3 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <FinaleArt steps={course.finale.steps} className="aspect-[4/3] w-full transition-transform duration-(--dur-2) group-hover:-translate-y-1" />
            <div className="flex flex-col gap-1 px-0.5">
              <span className="line-clamp-2 text-sm font-semibold group-hover:underline">{course.finale.title}</span>
              <span className="text-xs text-ink-muted">{course.finale.steps.map((s) => s.kicker).join(" · ")}</span>
              {enrolled ? (
                <span className={cn("inline-flex items-center gap-1 text-xs", progress.complete ? "text-ok" : "text-brand-ink")}>
                  {progress.complete ? <Check className="size-3" aria-hidden /> : null}
                  {progress.complete ? t("finale_done") : t("finale_ready")}
                </span>
              ) : null}
            </div>
          </Link>
        </CarouselSlide>
      </Carousel>
    </Surface>
  );
}
