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
import { AdaptivePreparation } from "@/components/enroll/adaptive-preparation";
import { prefetchAdaptiveSession } from "@/lib/adaptive-onboarding-client";
import { LiveProfileStep } from "@/components/enroll/live-profile-step";
import { AgentBlueprint } from "@/components/agent/agent-blueprint";
import { AgentChip } from "@/components/agent/agent-chip";
import { useAgent } from "@/components/agent/use-agent";
import { useAgentVoice } from "@/components/agent/agent-voice";
import { phaseLine } from "@/lib/guide-lines";
import { CustomizeStep, type Pace } from "@/components/enroll/customize-step";
import { BuildStep, type BuildServer } from "@/components/enroll/build-step";
import { useCourseUnits, usePlanState } from "@/components/plan/use-plan";
import { useLearnerReady } from "@/lib/api";
import { useEnrollment } from "@/lib/enrollment";
import { autoFill } from "@/lib/plan";
import { applyComfort, useProfile } from "@/lib/profile";
import { adaptationOf, type PrecheckResult, type SetupAnswers, type SupportOverride } from "@/lib/setup";
import type { Course } from "@/data/types";

export type EnrollPhase = "profile" | "intro" | "precheck" | "customize" | "build";

/**
 * Enrolling in a course: about you (asked once) -> the course preview video
 * (when the course has one) -> quick check of what you know -> customise the
 * course -> build it -> the course page. Opening it on an enrolled course goes
 * straight to customising, to edit the setup.
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
  const PHASES: EnrollPhase[] = ["profile", "intro", "precheck", "customize", "build"];
  // what comes right after "About you"
  const afterProfile: EnrollPhase = "intro";
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
  // a profile from an earlier enrolment skips "About you"; say so on the quick check
  const [reusedProfile, setReusedProfile] = React.useState(false);
  const [answers, setAnswers] = React.useState<SetupAnswers>({});
  const [needs, setNeeds] = React.useState<string[]>([]);
  const [precheck, setPrecheck] = React.useState<PrecheckResult | null>(null);
  const [override, setOverride] = React.useState<SupportOverride>("auto");
  const [pace, setPace] = React.useState<Pace>({ sessionMinutes: 30, studyDays: [1, 3, 5], addToPlan: true });
  const [saving, setSaving] = React.useState<{ state: "idle" | "saving" | "saved" } | { state: "error"; message: string }>({ state: "idle" });
  const [planningSince, setPlanningSince] = React.useState(0);

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

  /** Saves the setup on the server (which plans the course), the profile, and this browser's study plan. */
  async function commit() {
    setSaving({ state: "saving" });
    try {
      await save(answers, { precheck, supportOverride: override, pace: pace.studyDays.length ? { sessionMinutes: pace.sessionMinutes, studyDays: pace.studyDays } : null });
      await saveProfile({ ...(profile?.answers ?? {}), ...answers }, needs);
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

  /** The Mission or the chat finished: how they decided sets "what helps first" and explanation style. */
  function afterActivity(r: PrecheckResult) {
    const learning = r.activity?.learning;
    if (learning) setAnswers((a) => ({ ...a, firstStep: learning.firstStep, style: learning.style }));
    setPrecheck(r);
    setOverride("auto");
    setPhase("customize");
  }

  // the learner's agent takes shape as they set up: job from About you, skills from the Mission, roadmap from the plan
  const live = React.useMemo(() => ({ answers, precheck, phase }), [answers, precheck, phase]);
  const { agent } = useAgent(course, live);
  const renameAgent = (name: string) => setAnswers((a) => ({ ...a, agentName: name }));
  const agentBeside = phase === "profile";
  const { say, stop } = useAgentVoice();
  React.useEffect(() => {
    // Profiling and prerequisites own their playback sequence.
    stop();
    if (phase === "customize") say(phaseLine(phase), { once: `${course.course_id}.enroll.${phase}` });
  }, [phase, say, stop, course.course_id]);

  // While the model writes, show a neutral assembly view, not inferred help levels.
  const adaptation = adaptationOf({});
  const editing = enrolled && phase !== "build";

  let body: React.ReactNode = <CardSkeleton lines={6} />;
  if (phase === "profile")
    body = (
      <LiveProfileStep
        courseId={course.course_id}
        name={name}
        answers={answers}
        setAnswers={setAnswers}
        needs={needs}
        setNeeds={setNeeds}
        continueLabel={t("toIntro")}
        onDone={async (completedAnswers) => {
          await saveProfile(completedAnswers, needs);
          setAnswers(completedAnswers);
          // Save and generate from the same complete snapshot, including the final answer.
          prefetchAdaptiveSession(course.course_id, completedAnswers);
          setPrecheck(null);
          setReusedProfile(false);
          setPhase(afterProfile);
        }}
      />
    );
  else if (phase === "intro")
    body = <AdaptivePreparation course={course} answers={answers} mode="video" onPreviewDone={() => setPhase("precheck")} />;
  else if (phase === "precheck")
    body = <AdaptivePreparation course={course} answers={answers} mode="activity" onDone={afterActivity} />;
  else if (phase === "customize")
    body = (
      <CustomizeStep
        course={course}
        answers={answers}
        setAnswers={setAnswers}
        editing={enrolled}
        onEditProfile={() => {
          setPhase("profile");
        }}
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
          {phase ? <AgentChip agent={agent} onRename={renameAgent} className={cn("shrink-0", agentBeside && "lg:hidden")} /> : null}
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
                setPhase("profile");
              }}
            >
              {t("editProfile")}
            </button>
          </p>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl flex-1 page-pad py-8 lg:py-12">
        {agentBeside ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
            <div className="min-w-0">{body}</div>
            <aside className="sticky top-[calc(var(--nav-h)+24px)] hidden lg:block">
              <AgentBlueprint agent={agent} onRename={renameAgent} compact />
            </aside>
          </div>
        ) : (
          body
        )}
      </main>
    </div>
  );
}
