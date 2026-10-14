"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/kit/surface";
import { CardSkeleton } from "@/components/kit/states";
import { COSMETICS, shiftDay } from "@/lib/engagement";
import { useEngagement } from "./provider";
import { StudyLogDialog } from "./study-log";
import { RewardIcon } from "./reward-icon";
import type { Course } from "@/data/types";

export function WeeklyPanel({ courses }: { courses: Course[] }) {
  const t = useTranslations("engagement"); const platform = useEngagement();
  const [target,setTarget] = React.useState(3); const [editing,setEditing] = React.useState(false); const [busy,setBusy] = React.useState(false); const [error,setError] = React.useState("");
  if (!platform) return null;
  if (platform.error && !platform.data) return <Surface><p role="alert">{t("loadError")}</p><Button onClick={platform.refresh}>{t("retry")}</Button></Surface>;
  if (!platform.data) return <CardSkeleton lines={3} />;
  const d = platform.data; const next = COSMETICS.find((c) => !d.state.unlocked.includes(c.id));
  const cosmetic = d.state.showRewards ? d.state.cosmetic : "default";
  const frame = cosmetic === "orbit" ? "border-brand-line" : cosmetic === "constellation" ? "border-info shadow-md" : cosmetic === "nebula" ? "border-ok-line shadow-lg" : "";
  async function save(e: React.FormEvent) { e.preventDefault(); if (!platform) return; setBusy(true); setError(""); try { await platform.request("/api/v1/me/engagement/preferences","PATCH",{ weeklyTarget: target }); setEditing(false); } catch (e) { setError(e instanceof Error ? e.message : t("retryFailed")); } finally { setBusy(false); } }
  return <section aria-label={t("progressLabel")}>
    <Surface pad="lg" className={`flex flex-col gap-5 ${frame}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div>{cosmetic!=="default" ? <RewardIcon cosmetic={cosmetic} /> : null}<h2 className="text-xl font-semibold">{t("weeklyGoal")}</h2><p className="mt-1 text-ink-muted">{t("goalProgress",{ done: d.weeklyDays,target: d.target })}</p></div><StudyLogDialog courses={courses} /></div>
      <div className="grid grid-cols-7 gap-1.5" role="list" aria-label={t("weeklyGoal")}>
        {Array.from({ length: 7 },(_,i) => shiftDay(d.week,i)).map((date) => {
          const active = d.activeDays.includes(date); const grace = d.state.grace.includes(date);
          return <div key={date} role="listitem" aria-label={`${date}: ${t(active ? "activeDay" : grace ? "graceDay" : "inactiveDay")}`} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border ${active ? "border-brand-line bg-brand-soft text-brand-ink" : "border-line bg-panel-2 text-ink-muted"}`}>
            <span className="text-xs">{new Intl.DateTimeFormat(undefined,{ weekday: "short",timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span>
            {active ? <Check className="size-5" aria-hidden /> : <span aria-hidden className="text-lg">{grace ? "☆" : "·"}</span>}
            <span className="text-xs">{date.slice(-2)}</span>
          </div>;
        })}
      </div>
      <div className="flex flex-wrap justify-between gap-4"><span className="text-ink-muted">{t("loggedMinutes")}: <strong className="text-ink">{d.loggedMinutes}</strong></span>{d.state.showRewards ? <><span>{t("points")}: <strong>{d.points}</strong></span><span>{t("streak")}: <strong>{t("days",{ count: d.streak.current })}</strong></span></> : null}</div>
      {d.state.showRewards ? <div className="flex items-center gap-3 border-t border-line pt-4"><Star className="size-5 text-brand-ink" aria-hidden /><div><p className="font-medium">{next ? `${t("nextReward")}: ${t(next.id)}` : t("allUnlocked")}</p>{next ? <p className="text-sm text-ink-muted">{t("rewardProgress",{ remaining: Math.max(0,next.points - d.points) })}</p> : null}</div></div> : null}
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="min-h-11" onClick={() => { setTarget(d.nextTarget); setEditing(!editing); }}>{t("goalSetup")}</Button><Button asChild variant="ghost" className="min-h-11"><Link href="/learn/activity">{t("viewActivity")}</Link></Button></div>
      {editing ? <form onSubmit={save} className="flex flex-wrap items-end gap-3"><div><Label htmlFor="weekly-target">{t("weeklyTarget")}</Label><Input id="weekly-target" className="mt-2 min-h-11 w-24" type="number" required min={1} max={7} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></div><Button type="submit" className="min-h-11" disabled={busy}>{busy ? t("saving") : t("saveGoal")}</Button><p className="basis-full text-sm text-ink-muted">{t("nextWeek")} {t("scheduledGoal",{ target: d.nextTarget })}</p></form> : null}
      {error ? <p role="alert" className="text-err">{error}</p> : null}
    </Surface>
    {platform.pending.length ? <div className="mt-3 flex flex-col gap-3 rounded-lg border border-warn-line bg-warn-soft p-4" aria-live="polite">{platform.pending.map((p) => <div key={p.log.id} className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1 break-words">{p.error ? t("unsyncedError",{ message: p.error }) : t("pending")} · {p.log.date} · {p.log.minutes} min</span><StudyLogDialog courses={courses} edit={p.log} draft /><Button variant="outline" className="min-h-11" onClick={() => { void platform.retry(); }}>{t("retry")}</Button><Button variant="ghost" className="min-h-11" onClick={() => platform.discard(p.log.id)}>{t("discard")}</Button></div>)}</div> : null}
  </section>;
}
