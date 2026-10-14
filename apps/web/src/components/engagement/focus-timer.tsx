"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Button } from "@/components/ui/button";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import { useEngagement } from "./provider";
import { StudyLogDialog } from "./study-log";

type Focus = { minutes: number; remaining: number; deadline: number | null; started: boolean };
const initial: Focus = { minutes: 20, remaining: 1200, deadline: null, started: false };

/** A planning aid, never evidence that the learner actually studied. */
export function FocusTimer() {
  const t = useTranslations("engagement");
  const p = useEngagement();
  const key = "lms-engagement:focus";
  const timer = useLocalJson<Focus>(key, initial);
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    if (!timer.deadline) return;
    const update = () => setNow(Date.now());
    update(); const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [timer.deadline]);
  const remaining = timer.deadline && now ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : timer.remaining;
  const complete = timer.started && remaining === 0;
  React.useEffect(() => {
    if (complete && timer.deadline) writeLocal(key, JSON.stringify({ ...timer, deadline: null, remaining: 0 }));
  }, [complete, timer]);
  if (!p?.data) return null;
  function save(value: Focus) { writeLocal(key, JSON.stringify(value)); }
  function toggle() {
    if (timer.deadline) save({ ...timer, deadline: null, remaining: Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000)) });
    else save({ ...timer, started: true, deadline: Date.now() + timer.remaining * 1000 });
  }
  return <Surface className="flex flex-col gap-3">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Timer className="size-5" aria-hidden />{t("focusTitle")}</h2>
    <p className="text-sm text-ink-muted">{t("focusHelp")}</p>
    <label className="flex flex-wrap items-center gap-3 text-sm">{t("focusLength")}<select className="min-h-11 rounded-lg border border-line bg-panel px-3" value={timer.minutes} disabled={timer.started} onChange={(e) => { const minutes = Number(e.target.value); save({ minutes, remaining: minutes * 60, deadline: null, started: false }); }}>{[10,20,25,45].map((minutes) => <option key={minutes} value={minutes}>{t("focusMinutes", { minutes })}</option>)}</select></label>
    <p className="font-mono text-3xl tabular-nums" aria-label={t("focusRemaining", { minutes: Math.floor(remaining / 60), seconds: remaining % 60 })}>{String(Math.floor(remaining / 60)).padStart(2,"0")}:{String(remaining % 60).padStart(2,"0")}</p>
    <p role="status" className="text-sm text-ink-muted">{complete ? t("focusFinished") : timer.deadline ? t("focusRunning") : timer.started ? t("focusPaused") : t("focusReady")}</p>
    <div className="flex flex-wrap gap-2">{!complete ? <Button className="min-h-11" onClick={toggle}>{timer.deadline ? t("focusPause") : timer.started ? t("focusResume") : t("focusStart")}</Button> : <StudyLogDialog courses={p.courses} initialMinutes={timer.minutes} triggerLabel={t("focusReview")} />}{timer.started ? <Button className="min-h-11" variant="outline" onClick={() => save({ ...initial, minutes: timer.minutes, remaining: timer.minutes * 60 })}>{t("focusReset")}</Button> : null}</div>
  </Surface>;
}
