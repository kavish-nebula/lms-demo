"use client";

import * as React from "react";
import { useCompanionStep, useLearningContext } from "@/components/learning/course-companion";
import { recordLearning } from "@/lib/learning-state";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { ArrowLeft, ArrowRight, Award, Backpack, Bot, Cable, Check, ChevronDown, CirclePlay, Copy, Crosshair, Download, Eye, Flag, Flame, Laptop, LifeBuoy, RadioTower, RotateCcw, ShieldCheck, Sparkles, Star, Wrench, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StageShell } from "@/components/player/stage-shell";
import { Simulator } from "./guide-sim";
import { SolvedCaseStage } from "./solved-case-stage";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import type { Adaptation } from "@/lib/setup";
import type { GuideStep, GuidedBlock, GuidedMission, HookMessage } from "@/data/types";
import type { StageProps } from "./types";

/** Reward completing the practice, including using help and correcting mistakes. */
const STEP_XP = 150;
const CLEAN_BONUS = 0;

/** What the browser keeps: whether the mission was accepted, and each step finished, in order, with or without help. */
type Save = { accepted: boolean; log: { id: string; clean: boolean }[]; helped: string[] };
const EMPTY: Save = { accepted: false, log: [], helped: [] };
const NONE: string[] = [];

type PracticePhase = {
  id: "understand" | "configure" | "connect" | "test" | "repair" | "launch";
  label: string;
  title: string;
  body: string;
  outcome: string;
  icon: LucideIcon;
};

/** The learning story stays stable while the technical steps inside it can vary by module. */
const PRACTICE_PHASES: PracticePhase[] = [
  {
    id: "understand",
    label: "Understand",
    title: "Read the signal",
    body: "See the failure and find the real problem.",
    outcome: "A clear problem to solve",
    icon: Crosshair,
  },
  {
    id: "configure",
    label: "Configure",
    title: "Pitch base camp",
    body: "Set up a clean workspace for Scout.",
    outcome: "Workspace online",
    icon: Wrench,
  },
  {
    id: "connect",
    label: "Connect",
    title: "Open a safe line",
    body: "Connect what Scout needs and keep keys safe.",
    outcome: "Secure connection",
    icon: Cable,
  },
  {
    id: "test",
    label: "Test",
    title: "Send the first signal",
    body: "Run a small test and check what works.",
    outcome: "First response received",
    icon: CirclePlay,
  },
  {
    id: "repair",
    label: "Repair",
    title: "Turn replies into progress",
    body: "Change one thing and run again until it works.",
    outcome: "Conversation restored",
    icon: ShieldCheck,
  },
  {
    id: "launch",
    label: "Launch",
    title: "Face the real request",
    body: "Try Scout on the real problem and see its limits.",
    outcome: "Field test complete",
    icon: RadioTower,
  },
];

/** Divide any module's practice steps across the five hands-on phases after Understand. */
function phaseIndexForStep(index: number, total: number) {
  const boundaries = [0.375, 0.625, 0.75, 0.875].map((ratio) => Math.max(1, Math.round(total * ratio)));
  if (index < boundaries[0]!) return 1;
  if (index < boundaries[1]!) return 2;
  if (index < boundaries[2]!) return 3;
  if (index < boundaries[3]!) return 4;
  return 5;
}

function firstStepInPhase(phase: number, total: number) {
  if (phase <= 0) return 0;
  const found = Array.from({ length: total }, (_, index) => index).find((index) => phaseIndexForStep(index, total) === phase);
  return found ?? Math.max(0, total - 1);
}

/** A mission for blocks written before missions existed: the situation as the brief, the intro as the goal. */
function missionOf(block: GuidedBlock): GuidedMission {
  return (
    block.mission ?? {
      codename: block.title,
      badge: "Builder",
      mentor: { who: "Priya — developer", av: "P" },
      brief: [{ who: "Priya — developer", av: "P", at: "", text: block.situation }],
      goal: block.intro,
      debrief: [],
    }
  );
}

/**
 * Guided practice as a mission. The team briefs the learner on a real problem
 * at Orbit; a mentor hands over one step at a time, as a message; the learner
 * ticks the actions off, then says whether they see what they should. "Not
 * quite" brings the mentor's help; completing a step earns the same XP
 * with or without help and gets a teammate's reaction. The steps are
 * waypoints on a trail to the summit, where the badge, the stars and the team
 * are waiting. Every waypoint can be opened at any time.
 */
export function GuidedStage({ block, adaptation, ...nav }: StageProps<GuidedBlock> & { adaptation: Adaptation }) {
  if (block.solved_case) return <SolvedCaseStage block={block} {...nav} />;
  return <MissionGuidedStage block={block} adaptation={adaptation} {...nav} />;
}

function MissionGuidedStage({ block, adaptation, ...nav }: StageProps<GuidedBlock> & { adaptation: Adaptation }) {
  const t = useTranslations("guide");
  const reduce = useReducedMotionConfig() ?? false;
  const mission = missionOf(block);
  const learningContext = useLearningContext();
  const key = `lms-mission:${block.step_id}`;
  const saved = useLocalJson<Save>(key, EMPTY);
  // steps finished in the earlier checklist version count as done
  const legacy = useLocalJson<string[]>(`lms-guide:${block.step_id}`, NONE);
  const log = React.useMemo(() => {
    const extra = legacy.filter((id) => !saved.log.some((e) => e.id === id)).map((id) => ({ id, clean: true }));
    return [...saved.log, ...extra];
  }, [saved.log, legacy]);
  const done = React.useMemo(() => new Set(log.map((e) => e.id)),[log]);
  const steps = block.steps;
  const allDone = steps.every((s) => done.has(s.id));
  const accepted = saved.accepted || log.length > 0;
  const firstOpen = steps.findIndex((s) => !done.has(s.id));
  const [view, setView] = React.useState<number | "brief" | "summit">(() => (!accepted ? "brief" : firstOpen < 0 ? "summit" : firstOpen));

  const xp = log.length * STEP_XP;
  const maxXp = steps.length * (STEP_XP + CLEAN_BONUS);
  const streak = log.length;
  const helps = log.filter((e) => !e.clean).length;
  const stars = Math.min(3, Math.floor((done.size / steps.length) * 3));
  const activeStep = typeof view === "number" ? steps[view] : undefined;
  const activePhase = view === "brief" ? 0 : view === "summit" ? 5 : phaseIndexForStep(view, steps.length);
  const completedPhases = React.useMemo(() => {
    const complete = new Set<number>();
    if (accepted) complete.add(0);
    for (let phase = 1; phase < PRACTICE_PHASES.length; phase += 1) {
      const phaseSteps = steps.filter((_, index) => phaseIndexForStep(index, steps.length) === phase);
      if (phaseSteps.length && phaseSteps.every((step) => done.has(step.id))) complete.add(phase);
    }
    return complete;
  }, [accepted, done, steps]);
  useCompanionStep({ title: activeStep?.title ?? mission.codename, phase: "guided", guidance: activeStep ? `${activeStep.body} ${activeStep.actions.join(" ")}` : mission.goal, hint: activeStep?.tip });

  const save = (next: Save) => writeLocal(key, JSON.stringify(next));
  const go = (v: typeof view) => {
    setView(v);
    // the page scrolls (the lesson card grows with its content), so bring the new step's top into view
    requestAnimationFrame(() => document.getElementById("mission-top")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }));
  };
  const accept = () => {
    save({ ...saved, accepted: true });
    go(firstOpen < 0 ? "summit" : firstOpen);
  };
  const askedHelp = (s: GuideStep) => {
    if (!saved.helped.includes(s.id)) save({ ...saved, accepted: true, helped: [...saved.helped, s.id] });
  };
  const finishStep = (s: GuideStep) => {
    if (done.has(s.id)) return;
    const clean = !saved.helped.includes(s.id);
    if (learningContext) recordLearning(learningContext.courseId, { id: `guided:${s.id}`, moduleId: learningContext.moduleId, correct: true, helped: !clean || !s.sim });
    save({ ...saved, accepted: true, log: [...log, { id: s.id, clean }] });
  };
  const replay = () => {
    save(EMPTY);
    writeLocal(`lms-guide:${block.step_id}`, "[]");
    go("brief");
  };
  const goPhase = (phase: number) => {
    if (phase === 0) return go("brief");
    if (phase === 5 && allDone) return go("summit");
    go(firstStepInPhase(phase, steps.length));
  };

  return (
    <StageShell
      stage="guided"
      title={block.title}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={allDone || nav.done}
      completeHint={t("stepsLeft", { count: steps.filter((s) => !done.has(s.id)).length })}
      {...nav}
    >
      <div id="mission-top" className="scroll-mt-24" />
      {view !== "brief" ? (
        <MissionHud
          steps={steps}
          done={done}
          xp={xp}
          maxXp={maxXp}
          streak={streak}
          activePhase={activePhase}
          completedPhases={completedPhases}
          onSelectPhase={goPhase}
        />
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={String(view)}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-6"
        >
          {view === "brief" ? (
            <Briefing block={block} mission={mission} maxXp={maxXp} onAccept={accept} />
          ) : view === "summit" ? (
            <Summit block={block} mission={mission} xp={xp} maxXp={maxXp} stars={stars} helps={helps} allDone={allDone} remaining={steps.filter((s) => !done.has(s.id)).length} onReplay={replay} onBack={() => go(Math.max(0, firstOpen))} />
          ) : (
            <Waypoint
              key={steps[view]!.id}
              step={steps[view]!}
              n={view + 1}
              total={steps.length}
              mission={mission}
              phase={PRACTICE_PHASES[activePhase]!}
              phaseNumber={activePhase + 1}
              done={done.has(steps[view]!.id)}
              helped={saved.helped.includes(steps[view]!.id)}
              tipsOpen={adaptation.support === "extra"}
              onHelp={() => askedHelp(steps[view]!)}
              onWorks={() => finishStep(steps[view]!)}
              onPrev={view > 0 ? () => go(view - 1) : () => go("brief")}
              onNext={() => {
                const next = steps.findIndex((s, i) => i > view && !done.has(s.id));
                go(next >= 0 ? next : view + 1 < steps.length && !allDone ? view + 1 : "summit");
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </StageShell>
  );
}

/* ------------------------------------------------------------------ the trail */

/** XP, streak and the trail of waypoints up to the summit flag. Every waypoint opens on a click. */
function MissionHud({
  steps,
  done,
  xp,
  maxXp,
  streak,
  activePhase,
  completedPhases,
  onSelectPhase,
}: {
  steps: GuideStep[];
  done: Set<string>;
  xp: number;
  maxXp: number;
  streak: number;
  activePhase: number;
  completedPhases: Set<number>;
  onSelectPhase: (phase: number) => void;
}) {
  const reduce = useReducedMotionConfig() ?? false;
  const doneCount = steps.filter((s) => done.has(s.id)).length;
  return (
    <Surface pad="md" className="flex flex-col gap-4 overflow-hidden border-stage-guided-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <Zap className="size-4 text-stage-guided" aria-hidden />
          <motion.span key={xp} initial={reduce ? false : { scale: 1.25 }} animate={{ scale: 1 }} className="tabular-nums">
            {xp}
          </motion.span>
          <span className="font-normal text-ink-faint">/ {maxXp} XP</span>
        </span>
        <span className={cn("flex items-center gap-1.5", streak > 1 ? "font-semibold text-warn" : "text-ink-faint")}>
          <Flame className="size-4" aria-hidden />
          {streak} checkpoints done
        </span>
        <span className="ml-auto text-ink-muted">{doneCount} of {steps.length} tasks done</span>
      </div>
      <PhaseRail current={activePhase} completed={completedPhases} onSelect={onSelectPhase} />
    </Surface>
  );
}

/** Six named chapters make the practice read as one coherent story instead of a long checklist. */
function PhaseRail({ current, completed, onSelect }: { current: number; completed: Set<number>; onSelect?: (phase: number) => void }) {
  return (
    <nav aria-label="Guided practice phases" className="overflow-x-auto pb-1">
      <ol className="grid min-w-[720px] grid-cols-6 gap-2">
        {PRACTICE_PHASES.map((phase, index) => {
          const Icon = phase.icon;
          const isCurrent = index === current;
          const isDone = completed.has(index);
          return (
            <li key={phase.id}>
              <button
                type="button"
                onClick={() => onSelect?.(index)}
                disabled={!onSelect}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "group relative flex min-h-20 w-full flex-col items-start gap-2 overflow-hidden rounded-xl border px-3 py-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/60",
                  isCurrent
                    ? "border-stage-guided-line bg-stage-guided-soft text-ink shadow-sm"
                    : isDone
                      ? "border-ok-line bg-ok-soft/50 text-ink"
                      : "border-line bg-panel text-ink-muted hover:border-stage-guided-line",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className={cn("flex size-7 items-center justify-center rounded-lg border", isCurrent ? "border-stage-guided-line bg-panel text-stage-guided" : isDone ? "border-ok-line bg-ok text-on-ok" : "border-line bg-panel-2 text-ink-faint")}>
                    {isDone ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">0{index + 1}</span>
                </span>
                <span className="text-xs font-semibold">{phase.label}</span>
                {isCurrent ? <motion.span layoutId="phase-signal" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-stage-guided" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Scout visibly gains one working system at a time as the learner moves through the mission. */
function ScoutBuild({ active, completed }: { active: number; completed: Set<number> }) {
  const reduce = useReducedMotionConfig() ?? false;
  const parts = PRACTICE_PHASES.slice(1);
  return (
    <Surface pad="md" className="relative overflow-hidden border-stage-guided-line bg-stage-guided-soft/30">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -top-16 -right-10 size-48 rounded-full border border-stage-guided-line" />
        <div className="absolute -top-6 -right-2 size-28 rounded-full border border-stage-guided-line" />
      </div>
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold tracking-[0.18em] text-stage-guided uppercase">Scout build status</span>
          <h3 className="mt-1 text-lg font-semibold">One system at a time</h3>
          <p className="mt-1 text-sm text-ink-muted">Each phase adds a part to your agent.</p>
        </div>
        <motion.div
          animate={reduce ? undefined : active > 0 ? { scale: [1, 1.05, 1] } : undefined}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-stage-guided-line bg-panel text-stage-guided shadow-sm"
        >
          <Bot className="size-7" aria-hidden />
        </motion.div>
      </div>
      <div className="relative mt-5 grid grid-cols-5 gap-2">
        {parts.map((part, offset) => {
          const index = offset + 1;
          const Icon = part.icon;
          const isDone = completed.has(index);
          const isCurrent = active === index;
          return (
            <div key={part.id} className={cn("relative rounded-xl border px-2 py-3 text-center transition-colors", isDone ? "border-ok-line bg-ok-soft" : isCurrent ? "border-stage-guided-line bg-panel" : "border-line bg-panel/50")}>
              {offset ? <span className={cn("absolute top-1/2 -left-2.5 h-px w-2.5", completed.has(index - 1) ? "bg-ok" : "bg-line")} aria-hidden /> : null}
              <span className={cn("mx-auto flex size-8 items-center justify-center rounded-lg", isDone ? "bg-ok text-on-ok" : isCurrent ? "bg-stage-guided-soft text-stage-guided" : "bg-panel-2 text-ink-faint")}>
                {isDone ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
              </span>
              <div className="mt-2 text-[11px] font-semibold leading-tight">{part.outcome}</div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

/* ------------------------------------------------------------------ briefing */

function Briefing({ block, mission, maxXp, onAccept }: { block: GuidedBlock; mission: GuidedMission; maxXp: number; onAccept: () => void }) {
  const t = useTranslations("guide");
  const reduce = useReducedMotionConfig() ?? false;
  const [packed, setPacked] = React.useState<number[]>([]);
  const completed = new Set<number>();
  return (
    <div className="flex flex-col gap-5">
      <PhaseRail current={0} completed={completed} />
      <div className="focus-split">
        <section className="focus-pane flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-stage-guided uppercase"><Sparkles className="size-3.5" aria-hidden />Phase 1 · Understand</span>
            <span className="rounded-full border border-warn-line bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">400 tickets waiting</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{mission.codename}</h2>
            <p className="mt-2 text-lg leading-relaxed text-ink-muted">{mission.goal}</p>
          </div>
          <Surface pad="md" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink-muted">{t("fromTheTeam")}</h3>
            <div className="flex flex-col gap-3">
              {mission.brief.map((m, i) => (
                <motion.div key={i} initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduce ? 0 : 0.2 + i * 0.35 }}>
                  <Bubble msg={m} />
                </motion.div>
              ))}
            </div>
          </Surface>
        </section>
        <section className="focus-pane flex flex-col gap-4">
          <ScoutBuild active={0} completed={completed} />
          <Surface pad="md" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Backpack className="size-4 text-stage-guided" aria-hidden />Before you start</h3>
              <span className="text-xs font-medium text-ink-faint">{packed.length}/{block.before.items.length} ready</span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {block.before.items.map((b, i) => {
                const on = packed.includes(i);
                return <li key={b}><button type="button" aria-pressed={on} onClick={() => setPacked((p) => (on ? p.filter((x) => x !== i) : [...p, i]))} className={cn("flex h-full w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60", on ? "border-ok-line bg-ok-soft" : "border-line bg-panel hover:-translate-y-0.5 hover:border-stage-guided-line")}><span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-ok bg-ok text-on-ok" : "border-line")}>{on ? <Check className="size-3.5" aria-hidden /> : null}</span><span><Rich text={b} /></span></button></li>;
              })}
            </ul>
            {block.before.downloads.length ? <ul className="flex flex-col gap-2">{block.before.downloads.map((d) => <li key={d.href} className="flex items-center gap-2 text-sm"><Download className="size-4 shrink-0 text-stage-guided" aria-hidden /><a href={d.href} download className="font-medium text-brand-ink underline-offset-4 hover:underline">{d.label}</a><span className="text-ink-faint">{d.note}</span></li>)}</ul> : null}
          </Surface>
          <Surface pad="md" className="flex flex-wrap items-center gap-x-5 gap-y-3 border-stage-guided-line bg-stage-guided-soft/40">
            <Reward icon={<Flag />} text="6 mission phases" /><Reward icon={<Zap />} text={t("rewardXp", { xp: maxXp })} /><Reward icon={<Award />} text={t("rewardBadge", { badge: mission.badge })} />
            <Button size="lg" variant="brand" className="w-full" onClick={onAccept}>Start building<ArrowRight data-icon="inline-end" /></Button>
          </Surface>
        </section>
      </div>
    </div>
  );
}

function Reward({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium">
      <span className="text-stage-guided [&_svg]:size-4">{icon}</span>
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ a waypoint */

function Waypoint({
  step,
  n,
  total,
  mission,
  phase,
  phaseNumber,
  done,
  helped,
  tipsOpen,
  onHelp,
  onWorks,
  onPrev,
  onNext,
}: {
  step: GuideStep;
  n: number;
  total: number;
  mission: GuidedMission;
  phase: PracticePhase;
  phaseNumber: number;
  done: boolean;
  helped: boolean;
  tipsOpen: boolean;
  onHelp: () => void;
  onWorks: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("guide");
  const reduce = useReducedMotionConfig() ?? false;
  const [ticked, setTicked] = React.useState<number[]>(() => (done ? step.actions.map((_, i) => i) : []));
  const [asked, setAsked] = React.useState(helped);
  const [slipped, setSlipped] = React.useState(false);
  const [gained, setGained] = React.useState<number | null>(null);
  const mentor = { ...mission.mentor, at: "" };
  const allTicked = ticked.length === step.actions.length;
  const PhaseIcon = phase.icon;

  const works = () => {
    if (!done) setGained(STEP_XP + (helped || asked || slipped ? 0 : CLEAN_BONUS));
    setTicked(step.actions.map((_, i) => i));
    onWorks();
  };
  const help = () => {
    setAsked(true);
    onHelp();
  };
  // Mistakes and hints inform support, but never reduce the completion reward.
  const slip = () => {
    if (slipped) return;
    setSlipped(true);
    onHelp();
  };

  const header = (
    <>
      <div className="overflow-hidden rounded-2xl border border-stage-guided-line bg-stage-guided-soft/40">
        <div className="flex items-start gap-3 border-b border-stage-guided-line px-4 py-4">
          <motion.span
            initial={reduce ? false : { scale: 0.75, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-stage-guided-line bg-panel text-stage-guided shadow-sm"
          >
            <PhaseIcon className="size-5" aria-hidden />
          </motion.span>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-stage-guided uppercase">Phase {phaseNumber} of 6 · {phase.label}</span>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{phase.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{phase.body}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-panel/70 px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stage-guided text-xs font-bold text-on-brand">{n}</span>
          <div className="min-w-0">
            <span className="text-[10px] font-medium tracking-[0.14em] text-ink-faint uppercase">Mission task {n} of {total}</span>
            <h3 className="truncate text-sm font-semibold">{step.title}</h3>
          </div>
        </div>
      </div>
      <Bubble msg={{ ...mentor, text: step.body }} />
    </>
  );
  const navRow = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" onClick={onPrev}>
        <ArrowLeft data-icon="inline-start" />
        {n === 1 ? t("backToBrief") : t("prevWaypoint")}
      </Button>
      <Button variant={done ? "brand" : "ghost"} onClick={onNext}>
        {n === total ? t("toSummit") : done ? t("nextWaypoint") : t("skipAhead")}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </div>
  );
  const guidance = (asked || tipsOpen) && !done ? (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Bubble msg={{ ...mentor, text: step.tip ?? t("genericHelp") }} tone="help" label={asked ? undefined : t("tipAhead")} />
    </motion.div>
  ) : null;

  // the hands-on version: do the step in the practice simulator
  if (step.sim)
    return (
      <div className="flex flex-col gap-4">
        <div className="focus-split">
          <section className="focus-pane flex flex-col gap-4">
            {header}
            {!done ? <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="bg-transparent" onClick={help}><LifeBuoy data-icon="inline-start" />{asked ? t("askAgain", { name: mentor.who.split(" ")[0]! }) : t("askMentor", { name: mentor.who.split(" ")[0]! })}</Button>{!asked && !slipped && !helped ? <span className="text-xs text-ink-faint">Hints never cost XP.</span> : null}</div> : null}
            {guidance}
          </section>
          <section className="focus-pane flex flex-col gap-4">
            <Simulator key={step.id} sim={step.sim} solved={done} onSolved={works} onSlip={slip} />
            {done ? <Surface pad="md" className="flex flex-col gap-3 border-ok-line"><div className="flex flex-wrap items-center gap-2 font-semibold text-ok"><Check className="size-5" aria-hidden />{t("stepWorks")}<AnimatePresence>{gained != null ? <motion.span key="xp" initial={reduce ? false : { opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="rounded-full bg-stage-guided-soft px-2.5 py-0.5 text-sm text-stage-guided">+{gained} XP{gained > STEP_XP ? ` · ${t("noHelpBonus")}` : ""}</motion.span> : null}</AnimatePresence></div><p className="flex gap-2 text-sm leading-relaxed text-ink-muted"><Eye className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /><span><span className="font-semibold text-ink">{t("onYourMachineSee")} </span><Rich text={step.check} /></span></p>{step.win ? <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.35 }}><Bubble msg={step.win} /></motion.div> : null}</Surface> : null}
            <OnYourMachine step={step} />
          </section>
        </div>
        {navRow}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="focus-split">
        <section className="focus-pane flex flex-col gap-4">{header}{guidance}</section>
        <section className="focus-pane flex flex-col gap-4">
      <Surface pad="md" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t("yourMoves")}</h3>
          <span className="text-xs text-ink-faint tabular-nums">{t("ticked", { done: ticked.length, total: step.actions.length })}</span>
        </div>
        <ol className="flex flex-col gap-2">
          {step.actions.map((a, i) => {
            const on = ticked.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTicked((p) => (on ? p.filter((x) => x !== i) : [...p, i]))}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left leading-relaxed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    on ? "border-ok-line bg-ok-soft/60" : "border-line bg-panel hover:border-stage-guided-line",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
                      on ? "border-ok bg-ok text-on-ok" : "border-stage-guided-line bg-stage-guided-soft text-stage-guided",
                    )}
                  >
                    {on ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn(on && "text-ink-muted")}>
                    <Rich text={a} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {step.values?.length ? (
          <div className="flex flex-col gap-2">
            {step.values.map((v) => (
              <CopyValue key={v.label} label={v.label} value={v.value} />
            ))}
          </div>
        ) : null}
      </Surface>

      <Surface pad="md" className={cn("flex flex-col gap-4 transition-colors", done ? "border-ok-line" : allTicked ? "border-stage-guided-line" : undefined)}>
        <div className="flex gap-2.5">
          <Eye className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold">{t("checkpoint")}</h3>
            <p className="mt-1 leading-relaxed">
              <Rich text={step.check} />
            </p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="relative flex items-center gap-2 font-semibold text-ok">
              <Check className="size-5" aria-hidden />
              {t("stepWorks")}
              <AnimatePresence>
                {gained != null ? (
                  <motion.span
                    key="xp"
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="ml-2 rounded-full bg-stage-guided-soft px-2.5 py-0.5 text-sm text-stage-guided"
                  >
                    +{gained} XP{gained > STEP_XP ? ` · ${t("noHelpBonus")}` : ""}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
            {step.win ? (
              <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.35 }}>
                <Bubble msg={step.win} />
              </motion.div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="brand" onClick={works}>
              <Check data-icon="inline-start" />
              {t("iSeeIt")}
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent" onClick={help}>
              <LifeBuoy data-icon="inline-start" />
              {asked ? t("stillStuck") : t("notQuite")}
            </Button>
            {!asked ? <span className="text-xs text-ink-faint">Hints never cost XP.</span> : null}
          </div>
        )}
      </Surface>
        </section>
      </div>
      {navRow}
    </div>
  );
}

/** The real thing: the step's instructions and values, for doing it on your own machine. */
function OnYourMachine({ step }: { step: GuideStep }) {
  const t = useTranslations("guide");
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-card border border-line">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-card px-4 py-3 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        <Laptop className="size-4 text-stage-guided" aria-hidden />
        {t("onYourMachine")}
        <span className="font-normal text-ink-faint">{t("onYourMachineHint")}</span>
        <ChevronDown className={cn("ml-auto size-4 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <ol className="flex flex-col gap-2">
            {step.actions.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-stage-guided-line bg-stage-guided-soft font-mono text-[11px] font-bold text-stage-guided">{i + 1}</span>
                <span>
                  <Rich text={a} />
                </span>
              </li>
            ))}
          </ol>
          {step.values?.map((v) => (
            <CopyValue key={v.label} label={v.label} value={v.value} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ the summit */

function Summit({
  block,
  mission,
  xp,
  maxXp,
  stars,
  helps,
  allDone,
  remaining,
  onReplay,
  onBack,
}: {
  block: GuidedBlock;
  mission: GuidedMission;
  xp: number;
  maxXp: number;
  stars: number;
  helps: number;
  allDone: boolean;
  remaining: number;
  onReplay: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("guide");
  const reduce = useReducedMotionConfig() ?? false;
  const completeMission = new Set(PRACTICE_PHASES.map((_, index) => index));
  if (!allDone)
    return (
      <Surface pad="lg" className="flex flex-col items-start gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Flag className="size-5 text-ink-faint" aria-hidden />
          {t("summitNotYet")}
        </h2>
        <p className="text-ink-muted">{t("summitRemaining", { count: remaining, badge: mission.badge })}</p>
        <Button variant="brand" onClick={onBack}>
          {t("backOnTrail")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </Surface>
    );

  return (
    <>
      <PhaseRail current={5} completed={completeMission} />
      <ScoutBuild active={5} completed={completeMission} />
      <Surface pad="lg" className="relative flex flex-col items-center gap-4 overflow-hidden border-warn-line text-center">
        {!reduce ? <Burst /> : null}
        <motion.div
          initial={reduce ? false : { scale: 0.4, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="relative flex size-24 items-center justify-center rounded-full border-4 border-warn bg-warn-soft text-warn shadow-[0_0_40px_var(--color-warn-soft)]"
        >
          <Award className="size-11" aria-hidden />
        </motion.div>
        <div className="relative">
          <div className="text-xs font-semibold tracking-[0.18em] text-warn uppercase">{t("badgeEarned")}</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{mission.badge}</h2>
          <p className="mt-1 text-ink-muted">{mission.codename}</p>
        </div>
        <div className="relative flex items-center gap-1" aria-label={t("starsOf", { stars })}>
          {[1, 2, 3].map((s) => (
            <motion.span key={s} initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: reduce ? 0 : 0.4 + s * 0.15 }}>
              <Star className={cn("size-7", s <= stars ? "fill-warn text-warn" : "text-line")} aria-hidden />
            </motion.span>
          ))}
        </div>
        <div className="relative flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold">
            <Zap className="mr-1 inline size-4 text-stage-guided" aria-hidden />
            {xp} / {maxXp} XP
          </span>
          <span className="text-ink-muted">{t("helpsUsed", { count: helps })}</span>
        </div>
      </Surface>

      {mission.debrief.length ? (
        <Surface pad="md" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink-muted">{t("teamReacts")}</h3>
          {mission.debrief.map((m, i) => (
            <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.8 + i * 0.6 }}>
              <Bubble msg={m} />
            </motion.div>
          ))}
        </Surface>
      ) : null}

      <Surface pad="md" className="flex flex-col gap-3 border-ok-line">
        <h3 className="font-semibold">{block.finish.title}</h3>
        <p className="leading-relaxed text-ink-muted">{block.finish.body}</p>
        <h4 className="mt-1 text-sm font-semibold">{t("whatYouBuilt")}</h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          {block.finish.checklist.map((c) => (
            <li key={c} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
              <Rich text={c} />
            </li>
          ))}
        </ul>
      </Surface>

      <div>
        <Button variant="ghost" onClick={onReplay}>
          <RotateCcw data-icon="inline-start" />
          {t("replayMission")}
        </Button>
      </div>
    </>
  );
}

/** A quiet burst of sparks behind the badge. */
function Burst() {
  const sparks = Array.from({ length: 14 }, (_, i) => i);
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {sparks.map((i) => {
        const angle = (i / sparks.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className={cn("absolute top-[30%] left-1/2 size-2 rounded-full", i % 3 === 0 ? "bg-warn" : i % 3 === 1 ? "bg-stage-guided" : "bg-ok")}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 160, y: Math.sin(angle) * 90, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.15 }}
          />
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ shared bits */

const TONE: Record<string, string> = { M: "bg-[#b4533f]", L: "bg-[#2a8f85]", P: "bg-[#6d5cf6]" };

/** A teammate's message, chat style. */
function Bubble({ msg, tone, label }: { msg: HookMessage | (Omit<HookMessage, "at"> & { at?: string }); tone?: "help"; label?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", TONE[msg.av] ?? "bg-brand")}>{msg.av}</span>
      <div className={cn("min-w-0 flex-1 rounded-2xl rounded-tl-sm border px-4 py-3", tone === "help" ? "border-brand-line bg-brand-soft" : "border-line bg-panel-2/60")}>
        <div className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-ink-faint">
          <span className="font-semibold text-ink-muted">{msg.who}</span>
          {label ? <span>{label}</span> : null}
        </div>
        <p className="leading-relaxed">
          <Rich text={msg.text} />
        </p>
      </div>
    </div>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const t = useTranslations("guide");
  const copy = () =>
    navigator.clipboard?.writeText(value).then(
      () => toast.success(t("copied", { label })),
      () => toast.error(t("copyFailed")),
    );
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-panel-2/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <Button variant="ghost" size="xs" onClick={copy} aria-label={t("copyLabel", { label })}>
          <Copy data-icon="inline-start" />
          {t("copy")}
        </Button>
      </div>
      <code className="font-mono text-[13px] break-all whitespace-pre-wrap text-brand-ink">{value}</code>
    </div>
  );
}

/** **bold** for buttons and fields, `code` for what to type. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith("`") && p.endsWith("`") && p.length > 1 ? (
          <code key={i} className={cn("rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.9em] text-brand-ink [box-decoration-break:clone]", p.length < 28 && "whitespace-nowrap")}>
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}
