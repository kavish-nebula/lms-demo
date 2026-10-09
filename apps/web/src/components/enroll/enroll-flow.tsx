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
import { ProfileStep } from "@/components/enroll/profile-step";
import { IntroStep } from "@/components/enroll/intro-step";
import { PrecheckStep } from "@/components/enroll/precheck-step";
import { CustomizeStep, type Pace } from "@/components/enroll/customize-step";
import { BuildStep } from "@/components/enroll/build-step";
import { useCourseUnits, usePlanState } from "@/components/plan/use-plan";
import { useEnrollment } from "@/lib/enrollment";
import { useHydrated } from "@/lib/local-store";
import { autoFill } from "@/lib/plan";
import { applyComfort, useProfile } from "@/lib/profile";
import { adaptationOf, type PrecheckResult, type SetupAnswers, type SupportOverride } from "@/lib/setup";
import type { ConceptVideo, Course, PrecheckItem } from "@/data/types";

export type EnrollPhase = "profile" | "intro" | "precheck" | "customize" | "build";

/**
 * Enrolling in a course: about you (asked once) -> the course preview video
 * (when the course has one) -> quick check of what you know -> customise the
 * course -> build it -> the course page. Opening it on an enrolled course goes
 * straight to customising, to edit the setup.
 */
export function EnrollFlow({
  course,
  introVideo,
  precheckItems,
  name,
  today,
  authoredModules,
  initialPhase,
}: {
  course: Course;
  introVideo?: ConceptVideo;
  precheckItems: PrecheckItem[];
  name: string;
  today: string;
  authoredModules: string[];
  initialPhase?: EnrollPhase;
}) {
  const PHASES: EnrollPhase[] = introVideo ? ["profile", "intro", "precheck", "customize", "build"] : ["profile", "precheck", "customize", "build"];
  // what comes right after "About you"
  const afterProfile: EnrollPhase = introVideo ? "intro" : "precheck";
  const t = useTranslations("enroll");
  const router = useRouter();
  const hydrated = useHydrated();
  const courseHref = `/learn/courses/${course.course_id}`;
  const { profile, save: saveProfile } = useProfile();
  const { enrollment, enrolled, save } = useEnrollment(course.course_id);
  const { plan, setPlan } = usePlanState();
  const { byCourse } = useCourseUnits(React.useMemo(() => [course], [course]));

  const [phase, setPhase] = React.useState<EnrollPhase | null>(null);
  const [returnTo, setReturnTo] = React.useState<EnrollPhase | null>(null);
  // a profile from an earlier enrolment skips "About you"; say so on the quick check
  const [reusedProfile, setReusedProfile] = React.useState(false);
  const [answers, setAnswers] = React.useState<SetupAnswers>({});
  const [needs, setNeeds] = React.useState<string[]>([]);
  const [precheck, setPrecheck] = React.useState<PrecheckResult | null>(null);
  const [override, setOverride] = React.useState<SupportOverride>("auto");
  const [pace, setPace] = React.useState<Pace>({ sessionMinutes: 30, studyDays: [1, 3, 5], addToPlan: true });

  // start from what is saved, once storage has been read
  if (hydrated && phase === null) {
    setAnswers(enrollment?.answers ?? profile?.answers ?? {});
    setNeeds(profile?.needs ?? []);
    setPrecheck(enrollment?.precheck ?? null);
    setOverride(enrollment?.supportOverride ?? "auto");
    setPace({ sessionMinutes: plan.sessionMinutes, studyDays: plan.studyDays, addToPlan: !enrolled });
    setReusedProfile(!!profile && !enrolled && !initialPhase);
    setPhase(initialPhase ?? (enrolled ? "customize" : profile ? afterProfile : "profile"));
  }

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  function commit() {
    save(answers, { precheck, supportOverride: override });
    saveProfile({ ...(profile?.answers ?? {}), ...answers }, needs);
    applyComfort(needs.includes("none") ? [] : needs);
    const prefs = { ...plan, studyDays: pace.studyDays, sessionMinutes: pace.sessionMinutes };
    const remaining = (byCourse.get(course.course_id) ?? []).filter((u) => !u.done);
    const added = pace.addToPlan && pace.studyDays.length ? autoFill(remaining, prefs, today) : [];
    setPlan({ ...prefs, sessions: [...plan.sessions, ...added] });
  }

  const adaptation = adaptationOf(answers, { precheck, override });
  const editing = enrolled && phase !== "build";

  let body: React.ReactNode = <CardSkeleton lines={6} />;
  if (phase === "profile")
    body = (
      <ProfileStep
        name={name}
        answers={answers}
        setAnswers={setAnswers}
        needs={needs}
        setNeeds={setNeeds}
        continueLabel={returnTo === "customize" ? t("backToCustomize") : introVideo ? t("toIntro") : t("toQuickCheck")}
        onDone={() => {
          saveProfile(answers, needs);
          setReusedProfile(false);
          setPhase(returnTo ?? afterProfile);
          setReturnTo(null);
        }}
      />
    );
  else if (phase === "intro" && introVideo)
    body = <IntroStep course={course} video={introVideo} onDone={() => setPhase("precheck")} />;
  else if (phase === "precheck")
    body = (
      <PrecheckStep
        items={precheckItems}
        courseTitle={course.title}
        onDone={(r) => {
          setPrecheck(r);
          setOverride("auto");
          setPhase("customize");
          setReturnTo(null);
        }}
      />
    );
  else if (phase === "customize")
    body = (
      <CustomizeStep
        course={course}
        answers={answers}
        setAnswers={setAnswers}
        needs={needs}
        setNeeds={setNeeds}
        precheck={precheck}
        override={override}
        setOverride={setOverride}
        pace={pace}
        setPace={setPace}
        editing={enrolled}
        onRetakeCheck={() => setPhase("precheck")}
        onEditProfile={() => {
          setReturnTo("customize");
          setPhase("profile");
        }}
        onSubmit={() => {
          if (enrolled) {
            commit();
            toast.success(t("toastSaved"));
            router.push(courseHref);
          } else {
            commit();
            setPhase("build");
          }
        }}
      />
    );
  else if (phase === "build")
    body = (
      <BuildStep
        course={course}
        name={name}
        adaptation={adaptation}
        pace={pace}
        authoredModules={authoredModules}
        onGo={() => {
          toast.success(t("toastEnrolled", { course: course.title }));
          router.push(`${courseHref}?ready=1`);
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
            {t("phaseOf", { n: current + 1, total: PHASES.length })} · {t(`phase_${phase ?? "profile"}`)}
          </span>
        </div>
      </header>
      {phase === afterProfile && reusedProfile ? (
        <div className="mx-auto w-full max-w-6xl page-pad pt-6">
          <p className="text-sm text-ink-muted">
            {t("usingProfile")}{" "}
            <button
              type="button"
              className="font-medium text-brand-ink underline-offset-4 hover:underline"
              onClick={() => {
                setReturnTo(afterProfile);
                setPhase("profile");
              }}
            >
              {t("editProfile")}
            </button>
          </p>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl flex-1 page-pad py-8 lg:py-12">{body}</main>
    </div>
  );
}
