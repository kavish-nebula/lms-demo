"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Button } from "@/components/ui/button";
import { useEnrollments } from "@/lib/enrollment";
import { useHydrated } from "@/lib/local-store";
import { QUESTIONS, answerLabel } from "@/lib/setup";
import type { Course } from "@/data/types";

/** Settings: the setup answers per enrolled course, each with a link back into the wizard. */
export function CourseSetupSettings({ courses }: { courses: Course[] }) {
  const t = useTranslations("settings");
  const hydrated = useHydrated();
  const enrollments = useEnrollments();
  const enrolled = courses.filter((c) => enrollments[c.course_id]);

  return (
    <Surface pad="lg" className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t("courseSetup")}</h2>
        <p className="text-sm text-ink-muted">{t("courseSetupHelp")}</p>
      </div>
      {!hydrated ? null : enrolled.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {enrolled.map((c) => {
            const answers = enrollments[c.course_id]!.answers;
            const summary = QUESTIONS.map((q) => answerLabel(q, answers)).filter(Boolean).join(" · ");
            return (
              <li key={c.course_id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-medium">{c.title}</div>
                  <div className="truncate text-sm text-ink-muted">{summary || t("courseSetupDefault")}</div>
                </div>
                <Button asChild variant="outline" size="sm" className="bg-transparent">
                  <Link href={`/learn/courses/${c.course_id}/enroll`}>
                    <Settings2 data-icon="inline-start" />
                    {t("courseSetupEdit")}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          {t("courseSetupNone")}{" "}
          <Link href="/learn/courses" className="font-medium text-brand-ink underline-offset-4 hover:underline">
            {t("courseSetupBrowse")}
          </Link>
        </p>
      )}
    </Surface>
  );
}
