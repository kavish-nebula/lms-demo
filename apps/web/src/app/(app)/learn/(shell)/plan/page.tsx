import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FIXTURE_TODAY, getCourses, getLearner, getModule } from "@/data";
import { Suspense } from "react";
import { engagementEnabled } from "@/server/engagement";
import { PlatformPlan } from "@/components/engagement/platform-plan";
import { PageHeader } from "@/components/kit/page-header";
import { PlanGate } from "@/components/plan/plan-gate";

export const metadata: Metadata = { title: "Learning plan" };

/** Learning plan: schedule sessions on chosen days, see them on a calendar. */
export default async function PlanPage() {
  const t = await getTranslations("plan");
  const [learner, courses] = await Promise.all([getLearner(), getCourses()]);
  const enabled = engagementEnabled();
  const durations: Record<string,number> = {};
  if (enabled) for (const course of courses) for (const courseModule of course.modules) {
    const content = await getModule(course.course_id,courseModule.module_id);
    for (const block of content?.blocks ?? []) durations[`${course.course_id}:${courseModule.module_id}:${block.stage}`] = block.duration_min;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />
      {enabled ? <Suspense><PlatformPlan courses={courses} durations={durations} /></Suspense> : <PlanGate
        courses={courses}
        reviews={learner.due_reviews}
        history={learner.history}
        assignments={learner.assignments}
        today={FIXTURE_TODAY}
      />}
    </div>
  );
}
