import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FIXTURE_TODAY, getCourses, getLearner } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { HomeDashboard } from "@/components/learn/home-dashboard";
import { UserAvatar } from "@/components/shell/user-badge";

export const metadata: Metadata = { title: "Dashboard" };

/** S2 Learner home. Enrolment and progress live in the browser, so the body is a client component. */
export default async function LearnerHomePage() {
  const t = await getTranslations("home");
  const [learner, courses] = await Promise.all([getLearner(), getCourses()]);
  const firstName = learner.user.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <UserAvatar user={{ name: learner.user.name, email: learner.user.email }} className="size-11" />
            {t("welcome", { name: firstName })}
          </span>
        }
        description={t("subtitle")}
      />
      <HomeDashboard learner={learner} courses={courses} today={FIXTURE_TODAY} />
    </div>
  );
}
