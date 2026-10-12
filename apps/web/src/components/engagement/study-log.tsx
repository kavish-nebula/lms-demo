"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEngagement, type LogInput } from "./provider";
import { shiftDay } from "@/lib/engagement";
import type { Course } from "@/data/types";

export function StudyLogDialog({ courses, edit, draft, initialMinutes = 20, triggerLabel, autoOpen = false, onClose }: { courses: Course[]; edit?: LogInput; draft?: boolean; initialMinutes?: number; triggerLabel?: string; autoOpen?: boolean; onClose?: () => void }) {
  const t = useTranslations("engagement"); const platform = useEngagement();
  const [open,setOpen] = React.useState(autoOpen); const [value,setValue] = React.useState<LogInput | null>(() => autoOpen && platform?.data ? { id: crypto.randomUUID(),date: platform.data.today,courseId: null,minutes: initialMinutes,reflection: "" } : null);
  const [saving,setSaving] = React.useState(false); const [error,setError] = React.useState("");
  if (!platform?.data) return null;
  const today = platform.data.today;
  function close() { setOpen(false); onClose?.(); }
  function begin() { setValue(edit ?? { id: crypto.randomUUID(),date: today,courseId: null,minutes: initialMinutes,reflection: "" }); setError(""); setOpen(true); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!value || !platform) return; setSaving(true); setError("");
    // Native date inputs may commit on blur; read the submitted form value.
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const submitted = { ...value,date: String(form.get("date") ?? value.date) };
    try {
      if (edit && !draft) await platform.request(`/api/v1/me/study-logs/${edit.id}`,"PATCH",{ date: submitted.date,courseId: submitted.courseId,minutes: submitted.minutes,reflection: submitted.reflection });
      else await platform.log(submitted);
      close();
    } catch (e) { setError(e instanceof Error ? e.message : t("retryFailed")); } finally { setSaving(false); }
  }
  return <>
    {!autoOpen ? <Button className="min-h-11" variant={edit ? "outline" : "brand"} onClick={begin}>{triggerLabel ?? (edit ? t("edit") : t("logStudy"))}</Button> : null}
    <Dialog open={open} onOpenChange={(next) => { if (!saving) { if (!next) close(); else setOpen(true); } }}><DialogContent>
      <DialogHeader><DialogTitle>{edit ? t("editLog") : t("logStudy")}</DialogTitle><DialogDescription>{t("selfReported")}</DialogDescription></DialogHeader>
      {value ? <form onSubmit={submit} className="flex flex-col gap-4">
        <div><Label htmlFor={`log-date-${value.id}`}>{t("date")}</Label><Input className="mt-2 min-h-11" id={`log-date-${value.id}`} name="date" type="date" required min={shiftDay(today,-7)} max={today} value={value.date} onChange={(e) => setValue({ ...value,date: e.target.value })} /></div>
        <div><Label htmlFor={`log-course-${value.id}`}>{t("course")}</Label><select className="mt-2 min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-ink focus-visible:outline-2 focus-visible:outline-brand" id={`log-course-${value.id}`} value={value.courseId ?? ""} onChange={(e) => setValue({ ...value,courseId: e.target.value || null })}><option value="">{t("independent")}</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}</select></div>
        <div><Label htmlFor={`log-minutes-${value.id}`}>{t("minutes")}</Label><Input className="mt-2 min-h-11" id={`log-minutes-${value.id}`} type="number" inputMode="numeric" min={1} max={240} required value={value.minutes || ""} onChange={(e) => setValue({ ...value,minutes: Number(e.target.value) })} /></div>
        <div><Label htmlFor={`log-reflection-${value.id}`}>{t("reflection")}</Label><Textarea id={`log-reflection-${value.id}`} className="mt-2" maxLength={500} value={value.reflection} onChange={(e) => setValue({ ...value,reflection: e.target.value })} /></div>
        <p className="text-sm text-ink-muted">{t("dateRange")}</p>
        {error ? <p role="alert" className="text-err">{error}</p> : null}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={close}>{t("cancel")}</Button><Button className="min-h-11" disabled={saving} type="submit">{saving ? t("saving") : t("save")}</Button></div>
      </form> : null}
    </DialogContent></Dialog>
  </>;
}
