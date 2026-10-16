"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/kit/logo";
import { CardSkeleton } from "@/components/kit/states";
import { InterviewChat } from "@/components/onboarding/interview-chat";
import { CustomizeStep, type Pace } from "@/components/enroll/customize-step";
import { BuildStep, type BuildServer } from "@/components/enroll/build-step";
import { useCourseUnits, usePlanState } from "@/components/plan/use-plan";
import { useLearnerReady } from "@/lib/api";
import { useEnrollment } from "@/lib/enrollment";
import { autoFill } from "@/lib/plan";
import { applyComfort, useProfile } from "@/lib/profile";
import { adaptationOf, coursePart, normalizeAnswers, profilePart, type SetupAnswers, type SupportOverride } from "@/lib/setup";
import type { Course } from "@/data/types";

export type EnrollPhase = "fit" | "customize" | "build";

/** "About you" lives right after signing in; editing it from here comes back to this step. */
export const welcomeHref = (back: string) => `/learn/welcome?return=${encodeURIComponent(back)}`;

/**
 * Enrolling in a course: Pip's four or five questions about this course ->
 * customise the course -> build it -> the course page. The learner's profile was set in Pip's
 * welcome chat after signing in (ProfileGate sends anyone without one there
 * first), so enrolling starts from it and asks only what is specific to this
 * course (what they want from it, what they already know of it). Those answers
 * are stored with the enrolment, never in the profile, so a platform with many
 * courses never needs one profile to fit them all. Opening it on
 * an enrolled course goes straight to customising, to edit the setup. There
 * is no quick check: help per lesson starts from the profile answers and
 * follows the learner's answers inside lessons. An enrollment that already
 * has a quick-check result keeps it.
 */
export function EnrollFlow({
  course,
  name,
  today,
  authoredModules,
  initialPhase,
}: {
  course: Course;
  name: string;
  today: string;
  authoredModules: string[];
  initialPhase?: EnrollPhase;
}) {
  const PHASES: EnrollPhase[] = ["fit", "customize", "build"];
  const first: EnrollPhase = PHASES[0]!;
  const t = useTranslations("enroll");
  const router = useRouter();
  const learnerReady = useLearnerReady();
  const courseHref = `/learn/courses/${course.course_id}`;
  const { profile, ready: profileReady, save: saveProfile } = useProfile();
  const { enrollment, enrolled, save, adaptation: saved } = useEnrollment(course.course_id);
  const hydrated = learnerReady && profileReady;
  const { plan, setPlan } = usePlanState();
  const { byCourse } = useCourseUnits(React.useMemo(() => [course], [course]));

  const [phase, setPhase] = React.useState<EnrollPhase | null>(null);
  const [answers, setAnswers] = React.useState<SetupAnswers>({});
  const [override, setOverride] = React.useState<SupportOverride>("auto");
  const [pace, setPace] = React.useState<Pace>({ sessionMinutes: 30, studyDays: [1, 3, 5], addToPlan: true });
  const [saving, setSaving] = React.useState<{ state: "idle" | "saving" | "saved" } | { state: "error"; message: string }>({ state: "idle" });
  const [planningSince, setPlanningSince] = React.useState(0);
  // an older enrollment may carry a quick-check result: it is kept, never asked for again
  const precheck = enrollment?.precheck ?? null;
  const needs = profile?.needs ?? [];

  // start from what is saved, once storage has been read
  if (hydrated && phase === null) {
    // the profile as saved now, with this course's own answers from the enrolment
    setAnswers({ ...profilePart(profile?.answers ?? {}), ...coursePart(enrollment?.answers ?? {}) });
    setOverride(enrollment?.supportOverride ?? "auto");
    setPace({ sessionMinutes: plan.sessionMinutes, studyDays: plan.studyDays, addToPlan: !enrolled });
    setPhase(initialPhase && PHASES.includes(initialPhase) ? initialPhase : enrolled ? "customize" : first);
  }

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  /** Saves the setup on the server (which plans the course), the profile, and this browser's study plan. */
  async function commit() {
    setSaving({ state: "saving" });
    try {
      // answers from a branch the learner left are dropped here as on the server, so both hold the same profile
      await save(normalizeAnswers(answers, profile?.derived), { supportOverride: override, pace: pace.studyDays.length ? { sessionMinutes: pace.sessionMinutes, studyDays: pace.studyDays } : null });
      // course answers belong to this enrolment only; the profile keeps the person-level ones
      await saveProfile(normalizeAnswers({ ...(profile?.answers ?? {}), ...profilePart(answers) }, profile?.derived), needs);
    } catch (e) {
      setSaving({ state: "error", message: e instanceof Error ? e.message : String(e) });
      return false;
    }
    applyComfort(needs.includes("none") ? [] : needs);
    const prefs = { ...plan, studyDays: pace.studyDays, sessionMinutes: pace.sessionMinutes };
    const remaining = (byCourse.get(course.course_id) ?? []).filter((u) => !u.done);
    const added = pace.addToPlan && pace.studyDays.length ? autoFill(remaining, prefs, today) : [];
    setPlan({ ...prefs, sessions: [...plan.sessions, ...added] });
    setPlanningSince(Date.now());
    setSaving({ state: "saved" });
    return true;
  }

  const server: BuildServer =
    saving.state === "error"
      ? { status: "error", message: saving.message }
      : saving.state !== "saved"
        ? { status: "saving" }
        : enrollment?.pending
          ? { status: "planning", since: planningSince }
          : { status: "ready", source: enrollment?.plan?.source ?? "baseline", ai: !!enrollment?.ai, failed: enrollment?.lastError ?? null };

  const adaptation = adaptationOf(answers, { precheck, override });
  const editing = enrolled && phase !== "build";

  let body: React.ReactNode = <CardSkeleton lines={6} />;
  if (phase === "fit")
    body = (
      <InterviewChat
        key={course.course_id}
        name={name}
        course={{ id: course.course_id, title: course.title }}
        initial={{ answers: coursePart(answers), needs, derived: profile?.derived ?? null }}
        continueLabel={t("fitContinue")}
        onDone={(s) => {
          setAnswers((a) => ({ ...profilePart(a), ...coursePart(s.answers) }));
          setPhase("customize");
        }}
      />
    );
  else if (phase === "customize")
    body = (
      <CustomizeStep
        course={course}
        answers={answers}
        setAnswers={setAnswers}
        editing={enrolled}
        onEditProfile={() => router.push(welcomeHref(`${courseHref}/enroll?step=customize`))}
        onSubmit={async () => {
          if (enrolled) {
            if (await commit()) {
              toast.success(t("toastSaved"));
              router.push(courseHref);
            } else toast.error(t("saveFailed"));
          } else {
            setPhase("build");
            void commit();
          }
        }}
      />
    );
  else if (phase === "build")
    body = (
      <BuildStep
        course={course}
        name={name}
        adaptation={saving.state === "saved" && enrollment ? saved : adaptation}
        pace={pace}
        authoredModules={authoredModules}
        server={server}
        onRetry={() => void commit()}
        onGo={() => {
          toast.success(t("toastEnrolled", { course: course.title }));
          router.push(courseHref);
        }}
      />
    );

  const current = phase ? PHASES.indexOf(phase) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass glass-sm sticky top-0 z-30 border-x-0 border-t-0 shadow-none">
        <div className="flex h-(--nav-h) items-center gap-4 page-pad">
          <Button asChild variant="ghost" size="icon" aria-label={t("backToCourse")}>
            <Link href={courseHref}>
              <ChevronLeft />
            </Link>
          </Button>
          <Logo wordmark={false} className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-ink-muted">{editing ? t("editingSetup") : t("settingUp")}</div>
            <div className="truncate font-semibold">{course.title}</div>
          </div>
          <ol className="hidden items-center gap-1 md:flex" aria-label={t("progressLabel")}>
            {PHASES.map((p, i) => {
              const done = i < current;
              const on = i === current;
              return (
                <li key={p} className="flex items-center gap-1">
                  {i > 0 ? <span aria-hidden className={cn("h-px w-5", done || on ? "bg-brand" : "bg-line")} /> : null}
                  <span
                    aria-current={on ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium",
                      on ? "bg-brand-soft text-brand-ink" : done ? "text-ink" : "text-ink-faint",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[10px]",
                        done ? "bg-ok text-on-ok" : on ? "bg-brand text-on-brand" : "border border-line",
                      )}
                    >
                      {done ? <Check className="size-2.5" aria-hidden /> : i + 1}
                    </span>
                    {t(`phase_${p}`)}
                  </span>
                </li>
              );
            })}
          </ol>
          <span className="text-xs text-ink-muted md:hidden">
            {t("phaseOf", { n: current + 1, total: PHASES.length })} · {t(`phase_${phase ?? first}`)}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 page-pad py-8 lg:py-12">{body}</main>
    </div>
  );
}
