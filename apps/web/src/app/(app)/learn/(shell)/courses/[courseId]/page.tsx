import { CourseJourney } from "@/components/learning/course-journey";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCourse, getModule } from "@/data";
import { moduleOutline } from "@/lib/module-outline";
import { SectionNav } from "@/components/course/section-nav";
import {
  AboutSection,
  ModulesSection,
  OutcomesSection,
} from "@/components/course/course-sections";

type Params = { courseId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { courseId } = await params;
  const course = await getCourse(courseId);
  return { title: course?.title ?? "Course" };
}

/** S3 Course details (Coursera layout): hero, sticky section nav, sections. */
export default async function CoursePage({ params }: { params: Promise<Params> }) {
  const { courseId } = await params;
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

      <SectionNav sections={sections} course={course} heroId="course-hero" label={t("sectionsLabel")} />

      <div className="flex flex-col gap-16 pb-16">
        <AboutSection course={course} />
        <OutcomesSection course={course} />
        <ModulesSection course={course} outlines={outlines} />
      </div>
    </div>
  );
}
