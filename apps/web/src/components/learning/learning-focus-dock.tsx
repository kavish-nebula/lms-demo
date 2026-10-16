"use client";

import * as React from "react";
import { CheckCircle2, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated, useLocalJson, writeLocal } from "@/lib/local-store";

type FocusSession = { duration: number; remaining: number; runningSince?: number };
const DEFAULT_SESSION: FocusSession = { duration: 15 * 60, remaining: 15 * 60 };
const SESSION_LENGTHS = [10, 15, 25] as const;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Beside the lesson on wide screens: a voluntary focus sprint (the mission and tools cards were removed). */
export function LearningFocusDock({ courseId }: { courseId: string }) {
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

  React.useEffect(() => {
    if (!running) return;
    const first = window.setTimeout(() => setNow(Date.now()),0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
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

    </aside>
  );
}
