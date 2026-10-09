"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { Check, RotateCcw, Settings2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { CardSkeleton } from "@/components/kit/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveEnrollment, useEnrollments } from "@/lib/enrollment";
import { useLearnerReady } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { COMFORT_QUESTION, QUESTIONS, changeFor, comfortChange, type SetupAnswers } from "@/lib/setup";
import type { Course } from "@/data/types";

/**
 * "How your courses adapt to you": the seven profile answers as chips that
 * save straight away, each with what it changes; and, per course, the quick
 * check and a way to bring the profile into that course's setup.
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
  const setAnswer = (id: string, v: string | null) => persist({ ...answers, [id]: v }, needs);
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
        </div>

        {QUESTIONS.map((q) => {
          const value = answers[q.id] ?? null;
          const change = changeFor(q, answers);
          const freeKey = q.id === "domain" ? "domainOther" : q.id === "role" ? "roleOther" : null;
          return (
            <div key={q.id} role="group" aria-labelledby={`pq-${q.id}`} className="flex flex-col gap-2 border-t border-line pt-5">
              <h3 id={`pq-${q.id}`} className="text-sm font-semibold">
                {q.label} <span className="font-normal text-ink-muted">· {q.q}</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => {
                  const on = value === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAnswer(q.id, on ? null : o.v)}
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
                const check = e.precheck;
                return (
                  <li key={c.course_id} className="flex flex-col gap-2">
                    <div className="font-medium">{c.title}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip size="sm" tone={check && !check.skipped ? "ok" : "neutral"}>
                        {check && !check.skipped
                          ? check.isNew
                            ? t("checkNew")
                            : t("checkDone", { date: format.dateTime(new Date(check.at), { dateStyle: "medium" }) })
                          : t("checkNone")}
                      </Chip>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="bg-transparent">
                        <Link href={`/learn/courses/${c.course_id}/enroll`}>
                          <Settings2 data-icon="inline-start" />
                          {t("customise")}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/learn/courses/${c.course_id}/enroll?step=precheck`}>
                          <RotateCcw data-icon="inline-start" />
                          {check && !check.skipped ? t("retake") : t("take")}
                        </Link>
                      </Button>
                    </div>
                    {profile ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-fit text-brand-ink"
                        onClick={() =>
                          saveEnrollment(c.course_id, e, { ...e.answers, ...profile.answers }).then(
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
