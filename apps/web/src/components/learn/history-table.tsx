"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Surface } from "@/components/kit/surface";
import { EmptyState } from "@/components/kit/states";
import type { HistoryEntry } from "@/data/types";

/** Learner's own activity log, newest first. */
export function HistoryTable({ entries }: { entries: HistoryEntry[] }) {
  const t = useTranslations("history");
  const format = useFormatter();
  if (!entries.length) return <EmptyState title={t("empty")} />;

  return (
    <Surface pad="none" className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-panel-2/60 hover:bg-panel-2/60">
            <TableHead className="pl-5">{t("when")}</TableHead>
            <TableHead>{t("module")}</TableHead>
            <TableHead className="pr-5">{t("detail")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e, i) => (
            <TableRow key={i}>
              <TableCell className="pl-5 whitespace-nowrap text-ink-muted tabular-nums">
                {format.dateTime(new Date(e.at), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </TableCell>
              <TableCell>
                <div className="font-medium">{e.module_title}</div>
                <div className="text-xs text-ink-faint">{e.course_title}</div>
              </TableCell>
              <TableCell className="pr-5 text-ink-muted">{e.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Surface>
  );
}
