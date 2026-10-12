"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/kit/surface";
import { CardSkeleton } from "@/components/kit/states";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlanCalendar } from "@/components/plan/plan-calendar";
import { usePlanState } from "@/components/plan/use-plan";
import { courseUnits, autoFill, dayItems, SESSION_LENGTHS, WEEK_ORDER, type PlanState, type PlanUnit } from "@/lib/plan";
import { useEnrollments } from "@/lib/enrollment";
import { useLearnerReady } from "@/lib/api";
import { planTopicOrder } from "@/lib/learner-plan";
import { orderStages } from "@/lib/topics";
import { adaptationOf } from "@/lib/setup";
import { useLocalPrefix } from "@/lib/local-store";
import { FINALE_PREFIX, type FinaleState } from "@/lib/finale";
import { useEngagement } from "./provider";
import { StudyLogDialog } from "./study-log";
import type { Course } from "@/data/types";
import type { StageId } from "@/lib/stages";

/** Shell-only scheduling adapter; it never rewrites course delivery or enrollment. */
export function PlatformPlan({ courses, durations }: { courses: Course[]; durations: Record<string,number> }) {
  const t = useTranslations("engagement"); const tp = useTranslations("plan"); const p = useEngagement();
  const enrollments = useEnrollments(); const ready = useLearnerReady(); const { plan,setPlan } = usePlanState(); const router = useRouter(); const params = useSearchParams();
  const finales = useLocalPrefix<FinaleState>(FINALE_PREFIX);
  const rescheduleInput = React.useRef<HTMLInputElement>(null);
  const view = params.get("view") === "calendar" ? "calendar" : "agenda";
  const [courseId,setCourseId] = React.useState(""); const [picked,setPicked] = React.useState(""); const [date,setDate] = React.useState(""); const [selected,setSelected] = React.useState(""); const [details,setDetails] = React.useState<string | null>(null); const [moveDate,setMoveDate] = React.useState(""); const [error,setError] = React.useState("");
  const latest = React.useRef(plan); React.useEffect(() => { latest.current = plan; },[plan]);
  const enrolled = courses.filter((c) => enrollments[c.course_id]); const today = p?.data?.today ?? "";
  const units = React.useMemo(() => courses.filter((c) => enrollments[c.course_id]).flatMap((c) => {
    const e = enrollments[c.course_id]!; const progress = e.progress as Record<string,StageId[]>;
    const base = courseUnits(c,progress,finales[`${FINALE_PREFIX}${c.course_id}`]?.done ?? []);
    const ordered = c.modules.flatMap((m) => {
      const stages = planTopicOrder(e.plan?.plan ?? null,m.module_id,m.stages) ?? orderStages(m.stages,adaptationOf(e.answers).order[0]==="example");
      return stages.flatMap((stage) => base.filter((u) => u.moduleId===m.module_id && u.stage===stage));
    });
    return [...ordered,...base.filter((u) => u.moduleId==="finale")].map((u) => ({ ...u,minutes: durations[`${c.course_id}:${u.moduleId}:${u.stage}`] ?? u.minutes,done: u.moduleId==="finale" ? u.done : (progress[u.moduleId] ?? []).includes(u.stage) }));
  }),[courses,enrollments,durations,finales]);
  const all = React.useMemo(() => new Map(units.map((u) => [u.id,u])),[units]);
  const activeCourse = courseId || enrolled[0]?.course_id; const remaining = units.filter((u) => u.courseId===activeCourse && !u.done);
  const unit = remaining.find((u) => u.id===picked) ?? remaining[0]; const day = date || today;
  const sessions = plan.sessions.filter((s) => all.has(s.unitId) && !all.get(s.unitId)!.done).sort((a,b) => a.date.localeCompare(b.date));
  const days = React.useMemo(() => dayItems({ sessions: plan.sessions,units: all,reviews: [],history: [],today }),[plan.sessions,all,today]);
  function update(next: PlanState) { latest.current = next; setPlan(next); p?.track("planner_action"); }
  function viewChange(next: string) { const query = new URLSearchParams(params); query.set("view",next); router.replace(`/learn/plan?${query}`,{ scroll: false }); }
  function add(targetDate: string,u: PlanUnit) {
    if (targetDate < today || !targetDate) return;
    if (plan.sessions.some((s) => s.unitId===u.id && s.date===targetDate)) { setError(t("sessionDuplicate")); return; }
    setError(""); update({ ...plan,sessions: [...plan.sessions,{ id: crypto.randomUUID(),date: targetDate,unitId: u.id }] });
  }
  function remove(id: string) {
    const old = plan.sessions.find((s) => s.id===id); if (!old) return;
    update({ ...plan,sessions: plan.sessions.filter((s) => s.id!==id) }); setDetails(null);
    toast.success(t("removed"),{ action: { label: t("undo"),onClick: () => { const current = latest.current; if (!current.sessions.some((s) => s.id===id || (s.date===old.date && s.unitId===old.unitId))) update({ ...current,sessions: [...current.sessions,old] }); } } });
  }
  function move(id: string,nextDate: string) {
    const old = plan.sessions.find((s) => s.id===id); if (!old || nextDate < today) return;
    if (plan.sessions.some((s) => s.id!==id && s.unitId===old.unitId && s.date===nextDate)) { setError(t("sessionDuplicate")); return; }
    update({ ...plan,sessions: plan.sessions.map((s) => s.id===id ? { ...s,date: nextDate } : s) }); setDetails(null); setError("");
    toast.success(t("saved"),{ action: { label: t("undo"),onClick: () => { const current = latest.current; if (!current.sessions.some((s) => s.id!==id && s.unitId===old.unitId && s.date===old.date)) update({ ...current,sessions: current.sessions.map((s) => s.id===id ? old : s) }); } } });
  }
  const detail = plan.sessions.find((s) => s.id===details); const detailUnit = detail ? all.get(detail.unitId) : undefined;
  if (p?.error && !p.data) return <Surface><p role="alert">{t("loadError")}</p><Button className="mt-3 min-h-11" onClick={p.refresh}>{t("retry")}</Button></Surface>;
  if (!ready || !today) return <CardSkeleton lines={5} />;
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-muted">{t("planningEstimate")}</p><StudyLogDialog courses={courses} /></div>
    {!enrolled.length ? <Surface><p>{tp("notEnrolledBody")}</p><Button asChild className="mt-3 min-h-11"><Link href="/learn/courses">{tp("browseCourses")}</Link></Button></Surface> : <>
      <Surface><form onSubmit={(e) => { e.preventDefault(); if (unit) add(String(new FormData(e.currentTarget).get("date") ?? day),unit); }} className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="platform-plan-course">{t("course")}</Label><select id="platform-plan-course" value={activeCourse} onChange={(e) => { setCourseId(e.target.value); setPicked(""); }} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink focus-visible:outline-2 focus-visible:outline-brand">{enrolled.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}</select></div>
        <div><Label htmlFor="platform-plan-day">{t("date")}</Label><Input className="mt-2 min-h-11" id="platform-plan-day" name="date" type="date" required min={today} value={day} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="sm:col-span-2"><Label htmlFor="platform-plan-unit">{tp("session")}</Label><select disabled={!remaining.length} id="platform-plan-unit" value={unit?.id ?? ""} onChange={(e) => setPicked(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink focus-visible:outline-2 focus-visible:outline-brand">{remaining.map((u) => <option key={u.id} value={u.id}>{u.moduleTitle} · {u.label} · {u.minutes} min</option>)}</select></div><Button className="min-h-11" type="submit" disabled={!unit}>{tp("planSession")}</Button>
      </form>
      <fieldset className="mt-5"><legend className="mb-2 font-medium">{tp("studyDays")}</legend><div className="flex flex-wrap gap-2">{WEEK_ORDER.map((d) => <Button key={d} className="min-h-11" variant={plan.studyDays.includes(d) ? "brand" : "outline"} aria-pressed={plan.studyDays.includes(d)} onClick={() => update({ ...plan,studyDays: plan.studyDays.includes(d) ? plan.studyDays.filter((x) => x!==d) : [...plan.studyDays,d] })}>{new Intl.DateTimeFormat(undefined,{ weekday: "short",timeZone: "UTC" }).format(new Date(Date.UTC(2026,9,4+d)))}</Button>)}</div></fieldset>
      <div className="mt-4"><Label htmlFor="platform-session-length">{tp("sessionLength")}</Label><select id="platform-session-length" value={plan.sessionMinutes} onChange={(e) => update({ ...plan,sessionMinutes: Number(e.target.value) })} className="ml-3 min-h-11 rounded-lg border border-line bg-panel px-3 text-ink">{SESSION_LENGTHS.map((n) => <option key={n} value={n}>{n} min</option>)}</select><Button className="ml-3 mt-2 min-h-11" variant="outline" disabled={!plan.studyDays.length} onClick={() => { const extra = autoFill(units.filter((u) => !u.done),plan,today); update({ ...plan,sessions: [...plan.sessions,...extra] }); }}>{tp("planForMe")}</Button></div>
      </Surface>
      <div role="group" aria-label={t("plan")} className="flex gap-2">{(["agenda","calendar"] as const).map((v) => <Button key={v} className="min-h-11" aria-pressed={view===v} variant={view===v ? "brand" : "outline"} onClick={() => viewChange(v)}>{t(v)}</Button>)}</div>
      {error ? <p role="alert" className="text-err">{error}</p> : null}
      {view==="calendar" ? <Surface><PlanCalendar today={today} selected={selected || today} onSelect={setSelected} days={days} nextUp={unit} suggestion={unit} onPlanHere={(d) => { if (unit) add(d,unit); }} onRemove={remove} onSessionDetails={(id) => { const item = plan.sessions.find((s) => s.id===id); if (item) { setDetails(id); setMoveDate(item.date < today ? today : item.date); setError(""); } }} playerHref={(u) => u.href} /></Surface> : <Surface><h2 className="mb-3 text-lg font-semibold">{t("agenda")}</h2>{!sessions.length ? <p>{t("noAgenda")}</p> : <ul className="divide-y divide-line">{sessions.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-sm text-ink-muted">{s.date} · {s.date < today ? t("catchUp") : s.date===today ? t("today") : t("upcoming")}</p><p className="font-medium">{all.get(s.unitId)!.label}</p><p className="text-sm text-ink-muted">{all.get(s.unitId)!.minutes} min</p></div><Button className="min-h-11" variant="outline" onClick={() => { setDetails(s.id); setMoveDate(s.date < today ? today : s.date); setError(""); }}>{t("sessionDetails")}</Button>{s.date<today ? <Button className="min-h-11" onClick={() => move(s.id,today)}>{t("moveToday")}</Button> : null}</li>)}</ul>}</Surface>}
    </>}
    <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetails(null); }}><DialogContent><DialogHeader><DialogTitle>{t("sessionDetails")}</DialogTitle><DialogDescription>{detailUnit?.label}</DialogDescription></DialogHeader><p>{detail?.date} · {detailUnit?.minutes} min</p><Label htmlFor="reschedule-date">{t("reschedule")}</Label><Input className="min-h-11" id="reschedule-date" ref={rescheduleInput} type="date" min={today} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} /><div className="flex flex-wrap gap-3"><Button className="min-h-11" disabled={!moveDate || moveDate<today} onClick={() => { if (detail) move(detail.id,rescheduleInput.current?.value ?? moveDate); }}>{t("reschedule")}</Button><Button className="min-h-11" variant="outline" onClick={() => { if (detail) remove(detail.id); }}>{t("remove")}</Button>{detailUnit ? <Button className="min-h-11" asChild variant="ghost"><Link href={detailUnit.href}>{t("openLesson")}</Link></Button> : null}</div>{error ? <p role="alert" className="text-err">{error}</p> : null}</DialogContent></Dialog>
  </div>;
}
