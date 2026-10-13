"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Flag, FlaskConical, LockKeyhole, MessageCircle, Route, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { enrolled, adaptation } = useEnrollment(course.course_id);
  const { state } = useLearning(course.course_id);
  const { watched } = useWatchedVideos();
  const hydrated = useHydrated();
  const [preview, setPreview] = React.useState(false);
  const base = `/learn/courses/${course.course_id}`;
  const resume = state.resume?.href.startsWith(`${base}/`) ? state.resume : progress.resume;
  const reviewed = state.reviews.filter((r) => r.completedAt).length;
  const due = hydrated ? state.reviews.filter((r) => !r.completedAt && new Date(r.due) <= new Date()) : [];
  const practice = new Set(state.attempts.filter((a) => a.correct).map((a) => a.moduleId)).size;
  const reflected = Object.values(state.reflections).filter((x) => x.trim().length > 10).length;
  const game = deriveGameProgress(course, progress, state, watched, due.length, new Date(), enrolled);
  const mission = enrolled ? game.quest : { eyebrow: "FIRST MISSION", title: "Create your learner profile", detail: "Tell us your goal, preview the course and take the starting check.", href: `${base}/enroll`, xp: 25, dailyDone: false };
  const stairSteps = progress.modules.map((module, index) => ({ module, index })).reverse();
  return <>
    <section id="course-hero" className="journey-hero">
      <div>
        <Link href="/learn/courses" className="journey-kicker"><Route className="size-4" />Your learning adventure</Link>
        <h1>{course.title}</h1>
        <p className="max-w-lg text-sm leading-relaxed text-ink-muted">Join the team at Orbit Outdoor. Explore real problems, try your ideas, and build Scout into a dependable support agent.</p>
        <GameStatus game={game} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="brand" size="lg"><Link href={enrolled ? resume?.href ?? `${base}/m1/hook` : `${base}/enroll`}>{enrolled ? "Continue my journey" : "Make this course mine"}<ArrowRight /></Link></Button>
          <Button size="lg" variant="outline" onClick={() => setPreview(true)}><FlaskConical />Try an experiment</Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted"><span>{course.modules.length} connected chapters</span><span>One final mini-project</span><span>Your pace. Your path.</span></div>
        {enrolled && <div className="mt-6 max-w-md"><div className="mb-2 flex justify-between text-xs text-ink-muted"><span>Your course progress</span><span>{progress.topicsDone} / {progress.topicsTotal} phases</span></div><ProgressBar value={progress.ratio} size="sm" /></div>}
      </div>
      <div className="journey-world">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-widest text-ink-muted"><span>ORBIT OUTDOOR · SUPPORT DESK</span><span className="flex items-center gap-1.5"><span className="pip-status-dot" />YOUR MISSION</span></div>
        <div className="journey-message">“Can Scout help our customers without making things up?”<span className="mt-2 block text-xs text-ink-muted">Maya · Founder</span></div>
        <div className="journey-answer"><PipMascot className="h-24 w-20" happy /><div><strong className="text-sm">Let’s build the answer together.</strong><p className="mt-2 text-ink-muted">I’m Pip, your course companion. Ask me about an idea, a tricky step, or what to try next.</p><button onClick={() => askPip()} className="mt-2 text-xs font-semibold text-brand-ink">Say hello to Pip <ArrowRight className="inline size-3" /></button></div></div>
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
    <div className="grid gap-4 md:grid-cols-2">
      <section className="journey-section"><p className="journey-kicker"><Sparkles className="size-4" />Small wins that matter</p><h2 className="mt-2 font-semibold">Build. Explain. Remember.</h2><div className="mt-4 grid grid-cols-3 gap-3">{[{ n: practice, label: "Chapters practised", icon: FlaskConical }, { n: reflected, label: "Reflections saved", icon: BookOpen }, { n: reviewed, label: "Reviews recalled", icon: Check }].map((x) => <div key={x.label} className="rounded-xl bg-panel-2 p-3"><x.icon className="mb-2 size-4 text-brand-ink" /><strong className="block text-2xl">{x.n}</strong><span className="text-[11px] text-ink-muted">{x.label}</span></div>)}</div><p className="mt-3 text-xs text-ink-muted">Practise, revise, and ask for help. Each is part of learning.</p></section>
      <section className="journey-section"><p className="journey-kicker"><ShieldCheck className="size-4" />Made for your next step</p><h2 className="mt-2 font-semibold">{due.length ? `${due.length} review${due.length === 1 ? "" : "s"} ready for you` : enrolled ? "A starting plan that can grow with you" : "Your experience starts with you"}</h2><p className="mt-3 text-sm leading-relaxed text-ink-muted">{due.length ? "A short return visit helps you put an earlier idea to work again." : enrolled ? `${adaptation.support === "extra" ? "Extra guidance" : adaptation.support === "light" ? "A lighter touch" : "Balanced guidance"} to start. Your practice and choices adjust support as you go.` : "Tell us your goal, watch the preview, and try a low-pressure knowledge check. We’ll shape your starting support."}</p><Button asChild variant="outline" size="sm" className="mt-4"><Link href={due[0] ? `${base}/${due[0].moduleId}/review` : `${base}/enroll`}>{due.length ? "Start a review" : enrolled ? "View my plan" : "Set up my journey"}<ArrowRight /></Link></Button><Button size="sm" variant="ghost" className="mt-4" onClick={() => askPip()}><MessageCircle />Ask Pip</Button></section>
    </div>
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogTitle>Try a little of what you’ll learn</DialogTitle><DialogDescription>Change Scout’s behaviour and see the consequences. Your course progress stays where it is.</DialogDescription><ExperimentLab courseId={course.course_id} moduleId="m1" /></DialogContent></Dialog>
  </>;
}
