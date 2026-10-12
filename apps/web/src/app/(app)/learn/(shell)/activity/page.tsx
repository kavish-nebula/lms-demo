import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCourses } from "@/data";
import { engagementEnabled } from "@/server/engagement";
import { ActivityPage } from "@/components/engagement/activity";
import { PageHeader } from "@/components/kit/page-header";
export const metadata = { title: "Activity" };
export default async function Page() {
  await connection(); if (!engagementEnabled()) notFound();
  const t = await getTranslations("engagement");
  return <div className="flex flex-col gap-6"><PageHeader title={t("activity")} description={t("activityDescription")} /><ActivityPage courses={await getCourses()} /></div>;
}
