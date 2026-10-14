"use client";
import * as React from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePlanState, useCourseUnits } from "@/components/plan/use-plan";
import { useEngagement } from "./provider";
export function EngagementNotifications() {
  const t = useTranslations("engagement"); const p = useEngagement(); const { plan } = usePlanState(); const { all } = useCourseUnits(p?.courses ?? []);
  const [error,setError] = React.useState(""); const [busy,setBusy] = React.useState(false); const d = p?.data;
  const activeNotice = (key: string) => key.startsWith("badge:") ? d?.state.achievements.some((a) => key===`badge:${a.id}`) : key.startsWith("goal:") ? d?.state.ledger.some((e) => e.key===key) : true;
  const rewards = d?.state.showRewards ? Object.entries(d.state.notifications).filter(([key,n]) => !n.dismissed && activeNotice(key)).map(([id,n]) => ({ id,read: n.read,text: n.kind === "goal" ? t("goalNotice") : n.kind === "badge" ? t("badgeNotice",{ name: t(n.subject as "first-day") }) : t("cosmeticNotice",{ name: t(n.subject as "orbit") }) })) : [];
  const sessions = plan.sessions.filter((s) => s.date===d?.today && !all.get(s.unitId)?.done && !d?.state.noticeStates[`session:${s.id}`]?.dismissed).map((s) => ({ id: `session:${s.id}`,read: !!d?.state.noticeStates[`session:${s.id}`]?.read,text: t("sessionNotice",{ name: all.get(s.unitId)?.label ?? t("sessions") }) }));
  const items = [...sessions,...rewards].slice(0,30); const unread = items.filter((n) => !n.read).length;
  async function update(id: string,body: unknown) { if (!p) return; setBusy(true); setError(""); try { await p.request(`/api/v1/me/notifications/${encodeURIComponent(id)}`,"PATCH",body); } catch (e) { setError(e instanceof Error ? e.message : t("retryFailed")); } finally { setBusy(false); } }
  return <Popover><PopoverTrigger asChild><Button variant="ghost" className="relative min-h-11 min-w-11" aria-label={`${t("notifications")}${unread ? ` (${unread})` : ""}`}><Bell aria-hidden />{unread ? <span className="absolute right-1 top-1 rounded-full bg-brand-deep px-1.5 text-xs text-on-brand">{unread}</span> : null}</Button></PopoverTrigger><PopoverContent align="end" className="w-[min(360px,calc(100vw-24px))] max-h-[70dvh] overflow-y-auto"><h2 className="font-semibold">{t("notifications")}</h2>{!items.length ? <p className="py-4 text-sm text-ink-muted">{p?.error ? t("loadError") : t("emptyNotifications")}</p> : <ul className="divide-y divide-line">{items.map((n) => <li key={n.id} className="py-3"><p className={`break-words text-sm ${n.read ? "text-ink-muted" : "font-semibold"}`}>{n.text}</p><div className="mt-2 flex gap-2">{!n.read ? <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { void update(n.id,{ read: true }); }}>{t("markRead")}</Button> : null}<Button className="min-h-11" variant="ghost" disabled={busy} onClick={() => { void update(n.id,{ dismissed: true }); }}>{t("dismiss")}</Button></div></li>)}</ul>}{error ? <p role="alert" className="text-err">{error}</p> : null}</PopoverContent></Popover>;
}
