import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLearner } from "@/data";
import { PageHeader } from "@/components/kit/page-header";
import { HistoryTable } from "@/components/learn/history-table";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const t = await getTranslations("history");
  const learner = await getLearner();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <HistoryTable entries={learner.history} />
    </div>
  );
}
