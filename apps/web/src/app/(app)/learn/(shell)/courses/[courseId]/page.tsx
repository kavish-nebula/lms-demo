import { CourseJourney } from "@/components/learning/course-journey";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Award, Clock, Signal, Star } from "lucide-react";
import { getCourse, getModule } from "@/data";
import { moduleOutline } from "@/lib/module-outline";
import { Surface } from "@/components/kit/surface";
import { SectionNav } from "@/components/course/section-nav";
import { SetupPanel } from "@/components/course/setup-panel";
import {
  AboutSection,
  ModulesSection,
  OutcomesSection,
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
  // each module laid out under its side headings, part by part, for the outline below
  const outlines = Object.fromEntries(
    await Promise.all(
      course.modules.map(async (m) => {
        const mod = await getModule(courseId, m.module_id);
        return [m.module_id, mod ? moduleOutline(mod, m.topics, m.stages) : []] as const;
      }),
    ),
  );

  const sections = [
    { id: "about", label: t("navAbout") },
    { id: "outcomes", label: t("navOutcomes") },
    { id: "modules", label: t("navModules") },
  ];

  return (
    <div className="flex flex-col gap-10">
      <CourseJourney course={course} />

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
        <OutcomesSection course={course} />
        <ModulesSection course={course} outlines={outlines} />
      </div>
    </div>
  );
}
