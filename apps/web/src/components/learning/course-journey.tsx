"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Flag, FlaskConical, LockKeyhole, MessageCircle, Route, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentBlueprint } from "@/components/agent/agent-blueprint";
import { useAgent } from "@/components/agent/use-agent";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/kit/progress-ring";
import { moduleFlowStages, useCourseProgress } from "@/lib/course-progress";
import { useEnrollment } from "@/lib/enrollment";
import { useLearning } from "@/lib/learning-state";
import { useHydrated } from "@/lib/local-store";
import { useWatchedVideos } from "@/components/player/video/watched";
import { deriveGameProgress } from "@/lib/gamification";
import type { Course } from "@/data/types";
import { PipMascot } from "./pip-mascot";
import { ExperimentLab } from "./experiment-lab";
import { askPip } from "./course-companion";
import { BadgeCabinet, CapabilityRack, DailyMission, GameStatus, MasteryStars } from "./game-ui";

export function CourseJourney({ course }: { course: Course }) {
  const progress = useCourseProgress(course);
  const { enrolled } = useEnrollment(course.course_id);
  const { state } = useLearning(course.course_id);
  const { watched } = useWatchedVideos();
  const hydrated = useHydrated();
  const [preview, setPreview] = React.useState(false);
  const { agent, rename } = useAgent(course);
  const base = `/learn/courses/${course.course_id}`;
  const resume = state.resume?.href.startsWith(`${base}/`) ? state.resume : progress.resume;
  const due = hydrated ? state.reviews.filter((r) => !r.completedAt && new Date(r.due) <= new Date()) : [];
  const game = deriveGameProgress(course, progress, state, watched, due.length, new Date(), enrolled);
  const mission = enrolled ? game.quest : { eyebrow: "FIRST MISSION", title: "Create your learner profile", detail: "Share your goal and take the starting check.", href: `${base}/enroll`, xp: 25, dailyDone: false };
  const stairSteps = progress.modules.map((module, index) => ({ module, index })).reverse();
  return <>
    <section id="course-hero" className="journey-hero">
      <div>
        <Link href="/learn/courses" className="journey-kicker"><Route className="size-4" />Your learning adventure</Link>
        <h1>{course.title}</h1>
        <p className="max-w-lg text-sm leading-relaxed text-ink-muted">Join Orbit Outdoor and build Scout into a reliable support agent.</p>
        <GameStatus game={game} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="brand" size="lg"><Link href={enrolled ? resume?.href ?? `${base}/m1/hook` : `${base}/enroll`}>{enrolled ? "Continue" : "Start course"}<ArrowRight /></Link></Button>
          <Button size="lg" variant="outline" onClick={() => setPreview(true)}><FlaskConical />Try an experiment</Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted"><span>{course.modules.length} chapters</span><span>One mini-project</span><span>Your pace</span></div>
        {enrolled && <div className="mt-6 max-w-md"><div className="mb-2 flex justify-between text-xs text-ink-muted"><span>Progress</span><span>{progress.topicsDone} / {progress.topicsTotal} phases</span></div><ProgressBar value={progress.ratio} size="sm" /></div>}
      </div>
      <div className="journey-world">
        {hydrated ? null : <div className="flex items-center justify-between text-[10px] font-semibold tracking-widest text-ink-muted"><span>ORBIT OUTDOOR · SUPPORT DESK</span><span className="flex items-center gap-1.5"><span className="pip-status-dot" />YOUR MISSION</span></div>}
        {/* the learner's own agent, built as they go (components/agent); the story card is the server's first paint */}
        {hydrated ? (
          <AgentBlueprint agent={agent} onRename={(name) => void rename(name)} className="mt-3 border-0 bg-transparent p-0" />
        ) : (
          <>
            <div className="journey-message">“Can Scout help our customers without making things up?”<span className="mt-2 block text-xs text-ink-muted">Maya · Founder</span></div>
            <div className="journey-answer"><PipMascot className="h-24 w-20" happy /><div><strong className="text-sm">Let’s build it together.</strong><p className="mt-2 text-ink-muted">I’m Pip. Ask me about any idea or step.</p><button onClick={() => askPip()} className="mt-2 text-xs font-semibold text-brand-ink">Ask Pip <ArrowRight className="inline size-3" /></button></div></div>
          </>
        )}
        <CapabilityRack mastery={game.mastery} />
      </div>
    </section>
    <DailyMission quest={mission} />
    <section id="learning-steps" className="journey-section learning-steps-section">
      <div className="steps-heading"><div><p className="journey-kicker"><Route className="size-4" />Your climb</p><h2>Climb to Launch</h2></div><span>{progress.modules.filter((module) => module.liveState === "done").length}/{progress.modules.length} steps cleared</span></div>
      <div className="learning-staircase">
        <div className="launch-beacon" aria-hidden><span /><span /><span /></div>
        <div className="launch-summit"><Flag className="size-5" /><span><small>FINAL MISSION</small><strong>Launch Scout</strong></span><span className="daily-reward"><Zap />+150 XP</span><Link href={`${base}/finale/capstone`}>Open <ArrowRight className="size-3" /></Link></div>
        <div className="stair-stack">{stairSteps.map(({ module: m, index: i }) => {
        const flow = moduleFlowStages(m.stages);
        const isCurrent = progress.resume?.moduleIndex === i + 1;
        const stepProgress = m.liveState === "done" ? 1 : m.done.filter((stage) => flow.includes(stage)).length / Math.max(1, flow.length);
        const stateLabel = m.liveState === "done" ? "Cleared" : m.liveState === "in_progress" ? "Continue" : m.liveState === "locked" ? "Locked" : "Start";
        const stepStyle = { "--step-width": `${54 + (5 - i) * 8}%`, "--step-power": `${stepProgress * 100}%` } as React.CSSProperties;
        const step = <>
          {isCurrent && <div className="step-pip"><PipMascot className="h-16 w-14" happy /><span>You are here</span></div>}
          <span className="step-number">{m.liveState === "done" ? <Check /> : m.liveState === "locked" ? <LockKeyhole /> : i + 1}</span>
          <span className="step-copy"><small>STEP {String(i + 1).padStart(2, "0")}</small><strong>{m.title}</strong><span><i aria-hidden>{game.mastery[i]?.icon}</i>{game.mastery[i]?.upgrade}</span></span>
          <MasteryStars mastery={game.mastery[i]!} label={m.title} />
          <span className="step-status"><small>{stateLabel}</small>{m.liveState === "locked" ? <LockKeyhole /> : <ArrowRight />}</span>
          <span className="step-power" />
        </>;
        return m.liveState === "locked" ? <div key={m.module_id} className="stair-step" style={stepStyle} data-state="locked" aria-disabled="true">{step}</div> : <Link key={m.module_id} href={`${base}/${m.module_id}/${m.next ?? "hook"}`} className="stair-step" style={stepStyle} data-current={isCurrent} data-state={m.liveState}>{step}</Link>;
      })}</div>
        <div className="stair-ground"><span>START</span><strong>One step at a time.</strong></div>
      </div>
    </section>
    <BadgeCabinet badges={game.badges} />
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogTitle>Try what you’ll learn</DialogTitle><DialogDescription>Change Scout and see what happens. Progress isn’t affected.</DialogDescription><ExperimentLab courseId={course.course_id} moduleId="m1" /></DialogContent></Dialog>
  </>;
}
