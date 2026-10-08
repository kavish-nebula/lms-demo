import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCourses, getLearner } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { CredentialsList } from "@/components/learn/credentials-list";

export const metadata: Metadata = { title: "Credentials" };

export default async function CredentialsPage() {
  const t = await getTranslations("credentials");
  const [learner, courses] = await Promise.all([getLearner(), getCourses()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CredentialsList issued={learner.credentials} courses={courses} />
    </div>
  );
}
