import type { Metadata } from "next";
import { ScheduledReviews } from "@/components/learning/scheduled-reviews";
import { getTranslations } from "next-intl/server";
import { FIXTURE_TODAY, getLearner, getCourses } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { Surface } from "@/components/kit/surface";
import { DueReviewList } from "@/components/learn/due-review-list";

export const metadata: Metadata = { title: "Reviews" };

/** Spaced reviews due now and later (ARCHITECTURE.pdf section 11). */
export default async function ReviewsPage() {
  const t = await getTranslations("reviews");
  const learner = await getLearner();
  const courses = await getCourses();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ScheduledReviews courses={courses} />
      {learner.due_reviews.length > 0 ? <Surface pad="md" className="max-w-3xl">
        <DueReviewList items={learner.due_reviews} today={FIXTURE_TODAY} />
      </Surface> : <p className="text-sm text-ink-muted">Finish a module quiz to schedule reviews.</p>}
      <p className="max-w-3xl text-sm text-ink-faint">{t("why")}</p>
    </div>
  );
}
