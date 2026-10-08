"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { EmptyState } from "@/components/kit/states";
import type { Assignment } from "@/data/types";

/** Work assigned by an instructor or org admin, nearest due date first. */
export function AssignmentList({ items, today }: { items: Assignment[]; today: string }) {
  const t = useTranslations("home");
  const format = useFormatter();
  if (!items.length) return <EmptyState icon={<ClipboardList />} title={t("noAssignments")} />;

  const sorted = [...items].sort((a, b) => a.due.localeCompare(b.due));
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((a) => {
        const days = Math.round(
          (new Date(a.due + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86_400_000,
        );
        return (
          <li key={a.id} className="rounded-lg border border-line bg-panel-2/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm font-medium">{a.title}</div>
              <Chip size="sm" tone={days <= 3 ? "warn" : "neutral"} className="shrink-0">
                {format.dateTime(new Date(a.due + "T12:00:00Z"), { month: "short", day: "numeric" })}
              </Chip>
            </div>
            <div className="mt-1 text-xs text-ink-muted">
              {a.course_title} · {t("assignedBy", { name: a.assigned_by })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
