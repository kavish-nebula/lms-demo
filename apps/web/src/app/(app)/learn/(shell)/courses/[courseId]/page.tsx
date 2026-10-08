import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Award, ChevronRight, Clock, Signal, Star } from "lucide-react";
import { getCourse } from "@/data";
import { NebulaMark } from "@/components/kit/logo";
import { Surface } from "@/components/kit/surface";
import { EnrollCta, EnrollNote } from "@/components/course/enroll-cta";
import { SectionNav } from "@/components/course/section-nav";
import { SetupPanel } from "@/components/course/setup-panel";
import {
  AboutSection,
  MethodSection,
  ModulesSection,
  OutcomesSection,
  ReviewsSection,
} from "@/components/course/course-sections";

type Params = { courseId: string };
type Search = { ready?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course?.title ?? "Course" };
}

/** S3 Course details (Coursera layout): hero, stats strip, sticky section nav, sections. */
export default async function CoursePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ courseId }, { ready }] = await Promise.all([params, searchParams]);
  const course = await getCourse(courseId);
  if (!course) notFound();
  const t = await getTranslations("course");
  const tc = await getTranslations("catalog");

  const sections = [
    { id: "about", label: t("navAbout") },
    { id: "method", label: t("navMethod") },
    { id: "outcomes", label: t("navOutcomes") },
    { id: "modules", label: t("navModules") },
    { id: "reviews", label: t("navReviews") },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* ---------------- hero ---------------- */}
      <section id="course-hero" className="relative isolate flex flex-col gap-6 pt-2">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 -z-10 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,var(--aura-1),transparent)] blur-2xl"
        />
        <nav aria-label={t("breadcrumb")} className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Link href="/learn/courses" className="hover:text-ink hover:underline">
            {tc("title")}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span>{course.domain}</span>
        </nav>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-panel">
            <NebulaMark size={26} />
          </span>
          <span className="font-medium text-ink-muted">{course.provider}</span>
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">{course.title}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-muted">{course.tagline}</p>
        <div className="flex flex-wrap items-center gap-3">
          <EnrollCta course={course} size="xl" />
        </div>
        <EnrollNote course={course}>{t("setupNote")}</EnrollNote>
      </section>

      <SetupPanel course={course} ready={ready === "1"} />

      {/* ---------------- stats strip ---------------- */}
      <Surface pad="none" className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
        {[
          { icon: <Award />, title: t("statModules", { count: course.modules.length }), body: t("statModulesBody") },
          { icon: <Star />, title: t("noRatingsYet"), body: t("statRatingsBody") },
          { icon: <Signal />, title: t("statLevel", { level: course.level }), body: t("statLevelBody") },
          { icon: <Clock />, title: t("statSchedule"), body: t("statScheduleBody", { hours: course.estimated_hours }) },
        ].map((s) => (
          <div key={s.title} className="flex gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink [&_svg]:size-4">{s.icon}</span>
            <div>
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm text-ink-muted">{s.body}</div>
            </div>
          </div>
        ))}
      </Surface>

      <SectionNav sections={sections} course={course} heroId="course-hero" label={t("sectionsLabel")} />

      <div className="flex flex-col gap-16 pb-16">
        <AboutSection course={course} />
        <MethodSection course={course} />
        <OutcomesSection course={course} />
        <ModulesSection course={course} />
        <ReviewsSection course={course} />
      </div>
    </div>
  );
}
