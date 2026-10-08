import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCourses } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { ProgramCard } from "@/components/course/program-card";
import { Stagger, StaggerItem } from "@/components/kit/stagger";

export const metadata: Metadata = { title: "Courses" };

/** S3 Catalog: one card per course, each with a draggable module carousel. */
export default async function CatalogPage() {
  const t = await getTranslations("catalog");
  const courses = await getCourses();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Stagger className="flex flex-col gap-5">
        {courses.map((c) => (
          <StaggerItem key={c.course_id}>
            <ProgramCard course={c} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
