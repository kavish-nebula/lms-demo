"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  ListOrdered,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Segmented } from "@/components/kit/segmented";
import { Button } from "@/components/ui/button";
import { LessonOrderPreview } from "@/components/enroll/lesson-order-preview";
import {
  adaptationOf,
  questionById,
  type SetupAnswers,
} from "@/lib/setup";
import type { Course } from "@/data/types";

export type Pace = { sessionMinutes: number; studyDays: number[]; addToPlan: boolean };

const firstStepQ = questionById("firstStep");

/**
 * Customise the course: every change the profile made,
 * shown as a control the learner can adjust, with a live sample beside it.
 * Nothing is saved until "Build my course" (or "Save changes" when editing).
 */
export function CustomizeStep({
  course,
  answers,
  setAnswers,
  editing,
  onEditProfile,
  onSubmit,
}: {
  course: Course;
  answers: SetupAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<SetupAnswers>>;
  editing: boolean;
  onEditProfile: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("enroll");
  const a = adaptationOf(answers);
  const set = (patch: Partial<SetupAnswers>) => setAnswers((x) => ({ ...x, ...patch }));
  const orderLabel = firstStepQ.options.find((o) => o.v === (answers.firstStep ?? "idea"))!.label;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("customizeKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{t("customizeTitle", { course: course.title })}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t("customizeBody")}</p>
        </div>

        {/* lesson order */}
        <Section icon={<ListOrdered />} title={t("cLessonOrder")} body={t("cLessonOrderBody")}>
          <Segmented
            className="flex-wrap rounded-2xl!"
            aria-label={t("cLessonOrder")}
            value={answers.firstStep ?? "idea"}
            onValueChange={(v) => set({ firstStep: v })}
            options={firstStepQ.options.map((o) => ({ value: o.v, label: o.label }))}
          />
          <LessonOrderPreview order={a.order} />
        </Section>

      </div>

      {/* ---------------- live summary ---------------- */}
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+32px)] lg:h-fit" aria-label={t("yourCourse")}>
        <Surface pad="lg" spotlight className="grid-texture flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" aria-hidden />
            <h2 className="font-semibold">{t("yourCourse")}</h2>
          </div>
          <p className="text-sm font-medium">{course.title}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <AnimatePresence initial={false} mode="popLayout">
              {[
                { k: "order", show: true, text: t("sumOrder", { first: orderLabel }) },
              ]
                .filter((r) => r.show)
                .map((r) => (
                  <motion.li
                    key={r.k}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="flex gap-2"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    {r.text}
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
          <Button size="lg" variant="brand" onClick={onSubmit}>
            <Wand2 data-icon="inline-start" />
            {editing ? t("saveChanges") : t("buildCourse")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEditProfile}>
            {t("editProfileAnswers")}
          </Button>
        </Surface>
      </aside>
    </div>
  );
}
function Section({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <Surface pad="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-ink-muted">{body}</p>
        </div>
      </div>
      {children}
    </Surface>
  );
}
