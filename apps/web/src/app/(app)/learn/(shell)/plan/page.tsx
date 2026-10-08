import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FIXTURE_TODAY, getCourses, getLearner } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { PlanGate } from "@/components/plan/plan-gate";

export const metadata: Metadata = { title: "Learning plan" };

/** Learning plan: schedule sessions on chosen days, see them on a calendar. */
export default async function PlanPage() {
  const t = await getTranslations("plan");
  const [learner, courses] = await Promise.all([getLearner(), getCourses()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />
      <PlanGate
        courses={courses}
        reviews={learner.due_reviews}
        history={learner.history}
        assignments={learner.assignments}
        today={FIXTURE_TODAY}
      />
    </div>
  );
}
