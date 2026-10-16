"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Settings2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Surface } from "@/components/kit/surface";
import { CardSkeleton } from "@/components/kit/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveEnrollment, useEnrollments } from "@/lib/enrollment";
import { useLearnerReady } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { COMFORT_QUESTION, changeFor, comfortChange, normalizeAnswers, questionsFor, valueOf, withAnswer, type SetupAnswers, type SetupQuestion } from "@/lib/setup";
import type { Course } from "@/data/types";

/**
 * "How your courses adapt to you": the profile answers as chips that save
 * straight away, each with what it changes; and, per course, a way to bring
 * the profile into that course's setup. The questions shown
 * follow the learner's field, so changing it swaps the questions below it.
 */
export function ProfileEditor({ name, courses }: { name: string; courses: Course[] }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const learnerReady = useLearnerReady();
  const { profile, ready: profileReady, save } = useProfile();
  const hydrated = learnerReady && profileReady;
  const enrollments = useEnrollments();
  const answers: SetupAnswers = profile?.answers ?? {};
  const needs = profile?.needs ?? [];

  if (!hydrated) return <CardSkeleton lines={6} />;

  const persist = (a: typeof answers, n: string[]) => void save(a, n).catch(() => toast.error(t("saveFailed")));
  // answers from a branch that no longer applies are dropped as they are saved
  const derived = profile?.derived ?? null;
  const setAnswer = (q: SetupQuestion, v: string | string[] | null) =>
    persist(normalizeAnswers(Array.isArray(v) ? { ...answers, tools: v } : withAnswer(q, answers, v), derived), needs);
  const setNeeds = (next: string[]) => persist(answers, next);
  const enrolled = courses.filter((c) => enrollments[c.course_id]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Surface pad="lg" className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div>
            <div className="font-semibold">
              {name} <span className="text-sm font-normal text-ink-faint">· {t("fromAccount")}</span>
            </div>
            <div className="text-sm text-ink-muted">{profile ? t("answeredOn", { date: format.dateTime(new Date(profile.at), { dateStyle: "medium" }) }) : t("notAnswered")}</div>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto bg-transparent">
            <Link href="/learn/welcome?return=%2Flearn%2Fprofile">{t("redoWithPip")}</Link>
          </Button>
        </div>

        {questionsFor(answers, derived).map((q) => {
          const value = q.multi ? null : valueOf(q, answers);
          const picked = q.multi ? (answers.tools ?? []) : [];
          const change = changeFor(q, answers, derived);
          const freeKey = q.freeKey ?? null;
          return (
            <div key={q.id} role="group" aria-labelledby={`pq-${q.id}`} className="flex flex-col gap-2 border-t border-line pt-5">
              <h3 id={`pq-${q.id}`} className="text-sm font-semibold">
                {q.label} <span className="font-normal text-ink-muted">· {q.q}</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => {
                  const on = q.multi ? picked.includes(o.v) : value === o.v;
                  const toggle = () =>
                    q.multi
                      ? setAnswer(q, o.v === "none" ? (on ? [] : ["none"]) : on ? picked.filter((x) => x !== o.v) : [...picked.filter((x) => x !== "none"), o.v])
                      : setAnswer(q, on ? null : o.v);
                  return (
                    <button
                      key={o.v}
                      type="button"
                      aria-pressed={on}
                      onClick={toggle}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                        on ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-muted hover:border-brand-line hover:text-ink",
                      )}
                    >
                      {on ? <Check className="size-3.5" aria-hidden /> : null}
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {value === "other" && freeKey ? (
                <Input
                  aria-label={q.options.find((o) => o.free)?.free}
                  placeholder={q.options.find((o) => o.free)?.free}
                  maxLength={40}
                  defaultValue={answers[freeKey] ?? ""}
                  onBlur={(e) => persist({ ...answers, [freeKey]: e.target.value }, needs)}
                  className="h-9 max-w-xs"
                />
              ) : null}
              {q.note ? <p className="text-sm text-ink-muted">{q.note}</p> : null}
              <p className={cn("text-sm", change.skipped ? "text-ink-faint" : "text-ink-muted")}>{change.text}</p>
            </div>
          );
        })}

        <div role="group" aria-labelledby="pq-needs" className="flex flex-col gap-2 border-t border-line pt-5">
          <h3 id="pq-needs" className="text-sm font-semibold">
            {COMFORT_QUESTION.label} <span className="font-normal text-ink-muted">· {COMFORT_QUESTION.q}</span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {COMFORT_QUESTION.options.map((o) => {
              const on = needs.includes(o.v);
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setNeeds(o.v === "none" ? (on ? [] : ["none"]) : on ? needs.filter((x) => x !== o.v) : [...needs.filter((x) => x !== "none"), o.v])
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                    on ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-muted hover:border-brand-line hover:text-ink",
                  )}
                >
                  {on ? <Check className="size-3.5" aria-hidden /> : null}
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className={cn("text-sm", comfortChange(needs).skipped ? "text-ink-faint" : "text-ink-muted")}>{comfortChange(needs).text}</p>
        </div>
      </Surface>

      <aside className="flex flex-col gap-4">
        <Surface pad="md" className="flex flex-col gap-3">
          <h2 className="font-semibold">{t("yourCourses")}</h2>
          {enrolled.length ? (
            <ul className="flex flex-col gap-4">
              {enrolled.map((c) => {
                const e = enrollments[c.course_id]!;
                return (
                  <li key={c.course_id} className="flex flex-col gap-2">
                    <div className="font-medium">{c.title}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="bg-transparent">
                        <Link href={`/learn/courses/${c.course_id}/enroll`}>
                          <Settings2 data-icon="inline-start" />
                          {t("customise")}
                        </Link>
                      </Button>
                    </div>
                    {profile ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-fit text-brand-ink"
                        onClick={() =>
                          saveEnrollment(c.course_id, e, normalizeAnswers({ ...e.answers, ...profile.answers }, derived)).then(
                            () => toast.success(t("applied", { course: c.title })),
                            () => toast.error(t("applyFailed")),
                          )
                        }
                      >
                        {t("applyToCourse")}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">
              {t("noCourses")}{" "}
              <Link href="/learn/courses" className="font-medium text-brand-ink hover:underline">
                {t("browse")}
              </Link>
            </p>
          )}
        </Surface>
        <p className="px-1 text-sm text-ink-faint">{t("note")}</p>
      </aside>
    </div>
  );
}
