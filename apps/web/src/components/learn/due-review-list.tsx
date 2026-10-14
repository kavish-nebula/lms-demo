"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/kit/states";
import type { DueReview } from "@/data/types";

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Spaced-review items due now and soon (ARCHITECTURE.pdf section 11). */
export function DueReviewList({
  items,
  today,
  limit,
  className,
}: {
  items: DueReview[];
  today: string;
  limit?: number;
  className?: string;
}) {
  const t = useTranslations("home");
  const format = useFormatter();
  const tomorrow = addDays(today, 1);
  const shown = limit ? items.slice(0, limit) : items;

  if (!shown.length) {
    return <EmptyState icon={<RotateCcw />} title={t("noReviews")} description={t("noReviewsHint")} />;
  }

  return (
    <ul className={cn("flex flex-col divide-y divide-line", className)}>
      {shown.map((r) => {
        const due = r.due <= today ? t("dueToday") : r.due === tomorrow ? t("dueTomorrow") : t("dueOn", {
          date: format.dateTime(new Date(r.due + "T12:00:00Z"), { month: "short", day: "numeric" }),
        });
        const now = r.due <= today;
        return (
          <li key={r.review_item_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
                now ? "border-stage-review-line bg-stage-review-soft text-stage-review" : "border-line bg-panel-2 text-ink-faint",
              )}
            >
              <RotateCcw aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.module_title}</div>
              <div className="truncate text-xs text-ink-muted">
                {t("reviewMeta", { count: r.questions, course: r.course_title })}
              </div>
            </div>
            {now ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/learn/reviews">{t("startReview")}</Link>
              </Button>
            ) : (
              <Chip size="sm">{due}</Chip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
