"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarClock, ClipboardList, HeartPulse } from "lucide-react";
import { TickerTape, type TickerItem } from "@/components/kit/ticker-tape";
import { STAGE_META } from "@/lib/stages";
import { keyDate, useCourseUnits, usePlanState } from "@/components/plan/use-plan";
import type { Assignment, Course, DueReview } from "@/data/types";

/**
 * "Up next" ticker tape: planned sessions, health checks and assignment due
 * dates, soonest first. Shared by the dashboard and the Plan page.
 */
export function UpNextTicker({
  courses,
  reviews,
  assignments,
  today,
  className,
}: {
  courses: Course[];
  reviews: DueReview[];
  assignments: Assignment[];
  today: string;
  className?: string;
}) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { plan } = usePlanState();
  const { all } = useCourseUnits(courses);
  const when = (key: string) =>
    key === today ? t("today") : format.dateTime(keyDate(key), { weekday: "short", day: "numeric", month: "short" });

  type Row = { key: string; date: string; content: React.ReactNode };
  const rows: Row[] = [];

  for (const s of plan.sessions) {
    const u = all.get(s.unitId);
    if (!u || u.done || s.date < today) continue;
    const Icon = STAGE_META[u.stage].icon;
    rows.push({
      key: s.id,
      date: s.date,
      content: (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">{when(s.date)}</span>
          <Icon className={`size-3.5 ${STAGE_META[u.stage].ink}`} aria-hidden />
          <span className="font-medium">{u.label}</span>
          <span className="text-ink-muted">· {u.moduleTitle}</span>
          <span className="font-mono text-xs text-ink-faint">{tc("minutes", { count: u.minutes })}</span>
        </span>
      ),
    });
  }
  for (const r of reviews) {
    const date = r.due < today ? today : r.due;
    rows.push({
      key: r.review_item_id,
      date,
      content: (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">{when(date)}</span>
          <HeartPulse className="size-3.5 text-warn" aria-hidden />
          <span className="font-medium">{t("checkLabel")}</span>
          <span className="text-ink-muted">· {r.module_title}</span>
        </span>
      ),
    });
  }
  for (const a of assignments) {
    if (a.due < today) continue;
    rows.push({
      key: a.id,
      date: a.due,
      content: (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">{when(a.due)}</span>
          <ClipboardList className="size-3.5 text-info" aria-hidden />
          <span className="font-medium">{t("assignmentDue")}</span>
          <span className="text-ink-muted">· {a.title}</span>
        </span>
      ),
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  const items: TickerItem[] = rows.slice(0, 12).map((r) => ({ id: r.key, content: r.content }));
  if (!plan.sessions.some((s) => s.date >= today)) {
    items.unshift({
      id: "nothing-planned",
      content: (
        <Link href="/learn/plan" className="font-medium text-brand-ink underline-offset-4 hover:underline">
          {t("nothingPlanned")}
        </Link>
      ),
    });
  }

  return (
    <TickerTape
      className={className}
      label={t("upNextLabel")}
      pauseLabel={tc("tickerPause")}
      playLabel={tc("tickerPlay")}
      lead={
        <span className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-brand-deep px-3 text-xs font-semibold text-on-brand">
          <CalendarClock className="size-3.5" aria-hidden />
          {t("upNext")}
        </span>
      }
      items={items}
    />
  );
}
