"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BookOpenCheck, Clock3, GraduationCap, Layers3, ListChecks, Sparkles, Wand2 } from "lucide-react";
import { StatTile } from "@/components/kit/stat-tile";
import { Stagger, StaggerItem } from "@/components/kit/stagger";
import { SectionHeader } from "@/components/kit/page-header";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { NebulaMark } from "@/components/kit/logo";
import { CardSkeleton, EmptyState } from "@/components/kit/states";
import { UpNextTicker } from "@/components/plan/up-next-ticker";
import { ResumeCard } from "@/components/learn/resume-card";
import { ProgramCard } from "@/components/course/program-card";
import { ModuleArt } from "@/components/course/module-art";
import { EnrollCta } from "@/components/course/enroll-cta";
import { Button } from "@/components/ui/button";
import { useEnrollments } from "@/lib/enrollment";
import { useCoursesProgress, type CourseProgress } from "@/lib/course-progress";
import { useLearnerReady } from "@/lib/api";
import { QUESTIONS } from "@/lib/setup";
import type { Course, Learner } from "@/data/types";

/**
 * S2 Learner home. Before enrolment: a spotlight on the course and how the
 * setup shapes it. After: what's up next, the resume point, live KPIs and
 * the course card.
 */
export function HomeDashboard({ learner, courses, today }: { learner: Learner; courses: Course[]; today: string }) {
  const hydrated = useLearnerReady();
  const enrollments = useEnrollments();
  const progress = useCoursesProgress(courses);
  const enrolled = courses.filter((c) => enrollments[c.course_id]);

  if (!hydrated) {
    return (
      <div className="grid gap-4" aria-busy>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={2} />
      </div>
    );
  }

  return enrolled.length ? (
    <EnrolledHome learner={learner} courses={enrolled} progress={progress} today={today} />
  ) : (
    <WelcomeHome course={courses[0]} />
  );
}

/* ---------------------------------------------------------------- not enrolled */

function WelcomeHome({ course }: { course: Course | undefined }) {
  const t = useTranslations("home");
  const tc = useTranslations("course");
  if (!course) return <EmptyState icon={<GraduationCap />} title={t("noCoursesTitle")} description={t("noCoursesBody")} />;
  const steps = [
    { icon: <ListChecks />, title: t("welcomeStep1"), body: t("welcomeStep1Body", { count: QUESTIONS.length }) },
    { icon: <Wand2 />, title: t("welcomeStep2"), body: t("welcomeStep2Body") },
    { icon: <Layers3 />, title: t("welcomeStep3"), body: t("welcomeStep3Body") },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Surface pad="lg" spotlight className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 -z-10 size-[420px] rounded-full bg-[radial-gradient(closest-side,var(--aura-1),transparent)] opacity-60 blur-2xl"
        />
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Chip tone="accent" icon={<Sparkles />} className="w-fit">
              {t("spotlightEyebrow")}
            </Chip>
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <NebulaMark size={20} />
              {course.provider}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">{course.title}</h2>
            <p className="max-w-xl text-ink-muted">{course.tagline}</p>
            <div className="text-sm text-ink-muted">
              {course.level} · {tc("modulesCount", { count: course.modules.length })} · {tc("aboutHours", { hours: course.estimated_hours })}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <EnrollCta course={course} size="xl" />
              <Button asChild variant="link">
                <Link href={`/learn/courses/${course.course_id}`}>{tc("viewDetails")}</Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden h-56 lg:block" aria-hidden>
            {[3, 2, 1].map((n, i) => (
              <motion.div
                key={n}
                className="absolute inset-x-0 top-0 mx-auto w-52"
                initial={{ opacity: 0, y: 24, rotate: 0 }}
                animate={{ opacity: 1, y: i * 26, rotate: (i - 1) * -6, x: (i - 1) * -18 }}
                transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 160, damping: 20 }}
              >
                <ModuleArt index={n} className="aspect-[4/3] w-full bg-panel shadow-lg" />
              </motion.div>
            ))}
          </div>
        </div>
      </Surface>

      <section aria-labelledby="how-it-starts" className="flex flex-col gap-4">
        <SectionHeader title={<span id="how-it-starts">{t("howItStarts")}</span>} />
        <Stagger inView className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <StaggerItem key={s.title} className="h-full">
              <Surface pad="md" className="flex h-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand-ink [&_svg]:size-4">{s.icon}</span>
                  <span className="font-mono text-xs text-ink-faint">0{i + 1}</span>
                </div>
                <div className="font-semibold">{s.title}</div>
                <p className="text-sm text-ink-muted">{s.body}</p>
              </Surface>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- enrolled */

function EnrolledHome({
  learner,
  courses,
  progress,
  today,
}: {
  learner: Learner;
  courses: Course[];
  progress: Record<string, CourseProgress>;
  today: string;
}) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const all = courses.map((c) => progress[c.course_id]!);
  const modulesDone = all.reduce((n, p) => n + p.modulesDone, 0);
  const modulesTotal = all.reduce((n, p) => n + p.modules.length, 0);
  const topicsDone = all.reduce((n, p) => n + p.topicsDone, 0);
  const topicsTotal = all.reduce((n, p) => n + p.topicsTotal, 0);
  const minutes = learner.daily_progress.reduce((n, d) => n + d.minutes, 0);
  const current = courses.find((c) => progress[c.course_id]!.resume) ?? courses[0]!;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <UpNextTicker courses={courses} reviews={learner.due_reviews} assignments={[]} today={today} />

      <ResumeCard course={current} progress={progress[current.course_id]!} />

      <Stagger className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StaggerItem>
          <StatTile icon={<GraduationCap />} value={courses.length} label={t("kpiEnrolled")} />
        </StaggerItem>
        <StaggerItem>
          <StatTile icon={<BookOpenCheck />} value={modulesDone} hint={t("ofTotal", { total: modulesTotal })} label={t("kpiCompleted")} />
        </StaggerItem>
        <StaggerItem>
          <StatTile icon={<Layers3 />} value={topicsDone} hint={t("ofTopics", { total: topicsTotal })} label={t("kpiTopics")} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            icon={<Clock3 />}
            value={minutes}
            label={t("kpiMinutes")}
            sparkline={minutes ? learner.daily_progress.map((d) => d.minutes) : undefined}
          />
        </StaggerItem>
      </Stagger>

      <section aria-labelledby="your-courses" className="flex flex-col gap-4">
        <SectionHeader
          title={<span id="your-courses">{t("yourCourses")}</span>}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/learn/courses">{tc("viewAll")}</Link>
            </Button>
          }
        />
        {courses.map((c) => (
          <ProgramCard key={c.course_id} course={c} />
        ))}
      </section>
    </div>
  );
}
