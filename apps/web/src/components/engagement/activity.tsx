"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/kit/surface";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COSMETICS, shiftDay } from "@/lib/engagement";
import { useEngagement } from "./provider";
import { WeeklyPanel } from "./weekly-panel";
import { StudyLogDialog } from "./study-log";
import { RewardIcon } from "./reward-icon";
import type { Course } from "@/data/types";
const badges = ["first-day","first-goal","seven-days","four-goals"] as const;

export function ActivityPage({ courses }: { courses: Course[] }) {
  const t = useTranslations("engagement"); const platform = useEngagement();
  const [remove,setRemove] = React.useState<string | null>(null); const [busy,setBusy] = React.useState(false); const [error,setError] = React.useState(""); const [page,setPage] = React.useState(0);
  const d = platform?.data;
  const [ledgerPage,setLedgerPage] = React.useState(0);
  const historyDays = d ? [...new Set([...d.activeDays,...d.state.grace])].sort().reverse().slice(0,30) : [];
  const reconcile = platform?.request;
  React.useEffect(() => { if (reconcile) void reconcile("/api/v1/me/engagement/reconcile","POST").catch(() => {}); },[reconcile]);
  async function action(path: string,method: string,body?: unknown) { if (!platform) return; setBusy(true); setError(""); try { await platform.request(path,method,body); setRemove(null); } catch (e) { setError(e instanceof Error ? e.message : t("retryFailed")); } finally { setBusy(false); } }
  return <div className="flex flex-col gap-6">
    <WeeklyPanel courses={courses} />
    {error ? <p role="alert" className="text-err">{error}</p> : null}
    {d ? <>
      {d.state.showRewards ? <Surface className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">{t("longest")}: {t("days",{ count: d.streak.longest })}</h2><p className="mt-1 max-w-xl text-sm text-ink-muted">{t("graceHelp")}</p></div><Button className="min-h-11" variant="outline" disabled={!d.graceAvailable || busy} onClick={() => { void action("/api/v1/me/engagement/grace","POST"); }}>{t("grace")}</Button></Surface> : null}
      <Surface><h2 className="mb-3 text-lg font-semibold">{t("dailyHistory")}</h2>{historyDays.length ? <ul className="grid gap-2 sm:grid-cols-2">{historyDays.map((date) => <li className="flex flex-wrap justify-between gap-2 rounded-lg border border-line p-3 text-sm" key={date}><span>{date}</span><span>{t(d.activeDays.includes(date) ? "activeDay" : "graceDay")}</span></li>)}</ul> : <p className="text-ink-muted">{t("noLogs")}</p>}</Surface>
      <Surface><h2 className="mb-3 text-lg font-semibold">{t("history")}</h2><p className="mb-3 text-sm text-ink-muted">{t("correction")}</p>
        {!d.state.logs.length ? <p>{t("noLogs")}</p> : <ul className="divide-y divide-line">{[...d.state.logs].sort((a,b) => b.date.localeCompare(a.date)).slice(page*20,page*20+20).map((log) => <li key={log.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0 flex-1"><p className="font-medium">{log.date} · {t("logged",{ minutes: log.minutes })}</p><p className="text-sm text-ink-muted">{courses.find((c) => c.course_id === log.courseId)?.title ?? t("independent")}</p>{log.reflection ? <p className="mt-2 break-words text-sm">{log.reflection}</p> : null}</div><div className="flex gap-2">{log.date >= shiftDay(d.today,-7) ? <StudyLogDialog courses={courses} edit={log} /> : null}<Button className="min-h-11" variant="ghost" onClick={() => setRemove(log.id)}>{t("delete")}</Button></div></li>)}</ul>}
        {d.state.logs.length > 20 ? <div className="mt-3 flex gap-3"><Button className="min-h-11" aria-label={t("previous")} disabled={page===0} onClick={() => setPage(page-1)}>←</Button><Button className="min-h-11" aria-label={t("next")} disabled={(page+1)*20>=d.state.logs.length} onClick={() => setPage(page+1)}>→</Button></div> : null}
      </Surface>
      {d.state.showRewards ? <>
        <Surface><h2 className="mb-4 text-lg font-semibold">{t("badges")}</h2><div className="grid gap-4 sm:grid-cols-2">{badges.map((id) => { const earned = d.state.achievements.find((a) => a.id === id); return <div key={id} className={`rounded-lg border p-4 ${earned ? "border-brand-line bg-brand-soft" : "border-line"}`}><p className="font-semibold">{earned ? "★ " : "☆ "}{t(id)}</p><p className="mt-1 text-sm text-ink-muted">{t(`${id}_reason`)}</p><p className="mt-2 text-sm">{earned ? t("earnedOn",{ date: earned.date }) : t("notEarned")}</p></div>; })}</div></Surface>
        <Surface><h2 className="mb-3 text-lg font-semibold">{t("rewards")}</h2><p className="mb-4 text-sm text-ink-muted">{t("rewardsHelp")}</p><div className="grid gap-3 sm:grid-cols-3">{COSMETICS.map((c) => <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-line p-4"><RewardIcon cosmetic={c.id} /><h3 className="font-semibold">{t(c.id)}</h3><p className="text-sm text-ink-muted">{t("locked",{ points: c.points })}</p><Button className="min-h-11" disabled={busy || !d.state.unlocked.includes(c.id) || d.state.cosmetic===c.id} variant="outline" onClick={() => { void action("/api/v1/me/engagement/preferences","PATCH",{ cosmetic: c.id }); }}>{t(d.state.cosmetic===c.id ? "selected" : "select")}</Button></div>)}</div></Surface>
        <Surface><h2 className="mb-3 text-lg font-semibold">{t("ledger")}</h2><details onToggle={(e) => { if (e.currentTarget.open) platform?.track("reward_details"); }}><summary className="min-h-11 cursor-pointer font-medium">{t("rules")}</summary><p className="mb-4 max-w-2xl text-sm text-ink-muted">{t("rulesBody")}</p></details><ul className="divide-y divide-line">{[...d.state.ledger].sort((a,b) => b.date.localeCompare(a.date)).slice(ledgerPage*20,ledgerPage*20+20).map((e) => <li key={e.key} className="flex justify-between gap-3 py-3 text-sm"><span>{e.date} · {t(e.kind === "study" ? "studyAward" : e.kind === "course" ? "courseAward" : "goalAward")}</span><strong className="shrink-0">+{e.points}</strong></li>)}</ul>{!d.state.ledger.length ? <p>{t("noLedger")}</p> : null}{d.state.ledger.length>20 ? <div className="mt-3 flex gap-3"><Button className="min-h-11" aria-label={t("previous")} disabled={ledgerPage===0} onClick={() => setLedgerPage(ledgerPage-1)}>←</Button><Button className="min-h-11" aria-label={t("next")} disabled={(ledgerPage+1)*20>=d.state.ledger.length} onClick={() => setLedgerPage(ledgerPage+1)}>→</Button></div> : null}</Surface>
      </> : null}
      <Dialog open={!!remove} onOpenChange={(open) => { if (!open && !busy) setRemove(null); }}><DialogContent><DialogHeader><DialogTitle>{t("delete")}</DialogTitle><DialogDescription>{t("deleteConfirm")}</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button className="min-h-11" variant="outline" disabled={busy} onClick={() => setRemove(null)}>{t("cancel")}</Button><Button className="min-h-11" variant="destructive" disabled={busy} onClick={() => { void action(`/api/v1/me/study-logs/${remove}`,"DELETE"); }}>{t("delete")}</Button></div>{error ? <p role="alert">{error}</p> : null}</DialogContent></Dialog>
    </> : null}
  </div>;
}
