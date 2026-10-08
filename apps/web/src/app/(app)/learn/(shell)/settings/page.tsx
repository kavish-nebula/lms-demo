import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCourses } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { SettingsForm } from "@/components/learn/settings-form";
import { CourseSetupSettings } from "@/components/learn/course-setup-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const courses = await getCourses();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CourseSetupSettings courses={courses} />
      <SettingsForm
        languages={[
          { code: "en", label: "English", available: true },
          { code: "de", label: "Deutsch", available: false },
          { code: "es", label: "Español", available: false },
        ]}
      />
    </div>
  );
}
