"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, FlaskConical, NotebookPen, Pause, Play, RotateCcw, Sparkles, Target, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated, useLocalJson, writeLocal } from "@/lib/local-store";
import type { Support } from "@/lib/setup";
import type { StageId } from "@/lib/stages";
import { openPipNotes } from "./course-companion";

type FocusSession = { duration: number; remaining: number; runningSince?: number };
const DEFAULT_SESSION: FocusSession = { duration: 15 * 60, remaining: 15 * 60 };
const SESSION_LENGTHS = [10, 15, 25] as const;

const STAGE_MISSIONS: Partial<Record<StageId, string>> = {
  explainer: "Build the idea",
  worked: "Trace the example",
  guided: "Practise with support",
  lab: "Make a decision",
  gate: "Prove your mastery",
  review: "Strengthen your recall",
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LearningFocusDock({
  courseId,
  moduleTitle,
  stage,
  currentTitle,
  nextTitle,
  part,
  total,
  completed,
  reward,
  support,
  experimentAvailable,
}: {
  courseId: string;
  moduleTitle: string;
  stage: StageId;
  currentTitle: string;
  nextTitle: string;
  part: number;
  total: number;
  completed: number;
  reward: number;
  support: Support;
  experimentAvailable: boolean;
}) {
  const key = `lms-focus:v1:${courseId}`;
  const stored = useLocalJson<FocusSession>(key, DEFAULT_SESSION);
  const hydrated = useHydrated();
  const [now, setNow] = React.useState(0);
  const session = stored.duration > 0 && stored.remaining >= 0 ? stored : DEFAULT_SESSION;
  const running = hydrated && !!session.runningSince;
  const elapsed = running && now ? Math.floor((now - session.runningSince!) / 1000) : 0;
  const remaining = Math.max(0, session.remaining - elapsed);
  const finished = !running && session.remaining === 0;
  const focusProgress = Math.min(1, Math.max(0, 1 - remaining / session.duration));
  const courseProgress = Math.min(1, completed / Math.max(1, total));

  React.useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  React.useEffect(() => {
    if (!running || remaining > 0) return;
    writeLocal(key, JSON.stringify({ duration: session.duration, remaining: 0 } satisfies FocusSession));
  }, [key, remaining, running, session.duration]);

  const save = (next: FocusSession) => writeLocal(key, JSON.stringify(next));
  const chooseLength = (minutes: number) => save({ duration: minutes * 60, remaining: minutes * 60 });
  const toggle = () => running
    ? save({ duration: session.duration, remaining })
    : save({ duration: session.duration, remaining: remaining || session.duration, runningSince: Date.now() });
  const reset = () => save({ duration: session.duration, remaining: session.duration });
  const supportLabel = support === "extra" ? "Extra guidance" : support === "light" ? "Independent mode" : "Balanced guidance";

  return (
    <aside className="learning-focus-dock" aria-label="Learning focus tools">
      <section className="focus-dock-card focus-session-card">
        <div className="focus-dock-heading">
          <span className="focus-dock-icon"><Timer /></span>
          <div><span>Focus sprint</span><small>Stay with one clear task</small></div>
        </div>
        <div className="focus-time" aria-live="polite">{formatTime(remaining)}</div>
        <div className="focus-meter" role="progressbar" aria-label="Focus sprint progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(focusProgress * 100)}>
          <span style={{ width: `${focusProgress * 100}%` }} />
        </div>
        {finished && <p className="focus-finished"><CheckCircle2 />Sprint complete. Take a short reset.</p>}
        <div className="focus-lengths" aria-label="Focus sprint length">
          {SESSION_LENGTHS.map((minutes) => <button key={minutes} type="button" disabled={running} aria-pressed={session.duration === minutes * 60} onClick={() => chooseLength(minutes)}>{minutes}m</button>)}
        </div>
        <div className="focus-session-actions">
          <Button size="sm" variant="brand" onClick={toggle}>{running ? <Pause /> : <Play />}{running ? "Pause" : finished ? "Start again" : "Start focus"}</Button>
          <Button size="icon-sm" variant="ghost" onClick={reset} aria-label="Reset focus sprint"><RotateCcw /></Button>
        </div>
      </section>

      <section className="focus-dock-card">
        <div className="focus-dock-heading">
          <span className="focus-dock-icon"><Target /></span>
          <div><span>Current mission</span><small>{moduleTitle}</small></div>
        </div>
        <p className="focus-mission-kicker">{STAGE_MISSIONS[stage] ?? "Keep moving"}</p>
        <h2>{currentTitle}</h2>
        <div className="focus-reward"><Zap />+{reward} XP on completion</div>
        <div className="focus-course-progress">
          <div><span>Part {part} of {total}</span><strong>{Math.round(courseProgress * 100)}%</strong></div>
          <div className="focus-meter" role="progressbar" aria-label="Module progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(courseProgress * 100)}><span style={{ width: `${courseProgress * 100}%` }} /></div>
        </div>
        <div className="focus-next"><span>Next</span><p>{nextTitle}</p><ArrowRight /></div>
      </section>

      {(stage !== "gate" || experimentAvailable) && <section className="focus-dock-card">
        <div className="focus-dock-heading">
          <span className="focus-dock-icon"><Sparkles /></span>
          <div><span>Learning tools</span><small>{supportLabel}</small></div>
        </div>
        <div className="focus-tool-grid">
          {stage !== "gate" && <button type="button" onClick={openPipNotes}><NotebookPen /><span><strong>Notebook</strong><small>Capture an insight</small></span></button>}
          {experimentAvailable && <button type="button" onClick={() => window.dispatchEvent(new Event("learning:experiment"))}><FlaskConical /><span><strong>Try the lab</strong><small>Change and observe</small></span></button>}
        </div>
      </section>}
    </aside>
  );
}
