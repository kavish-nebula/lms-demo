"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Surface } from "@/components/kit/surface";
import { usePlanState, useCourseUnits } from "@/components/plan/use-plan";
import { useEngagement } from "./provider";
import type { Course } from "@/data/types";
export function TodaySessions({ courses }: { courses: Course[] }) {
  const t = useTranslations("engagement"); const p = useEngagement(); const { plan } = usePlanState(); const { all } = useCourseUnits(courses);
  if (!p?.data) return null;
  const sessions = plan.sessions.filter((s) => s.date === p.data!.today && all.has(s.unitId) && !all.get(s.unitId)!.done);
  return <Surface><h2 className="mb-3 text-lg font-semibold">{t("todaySessions")}</h2>{sessions.length ? <ul className="flex flex-col gap-2">{sessions.map((s) => <li key={s.id}><Link className="flex min-h-11 items-center rounded-lg border border-line px-3 hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand" href={all.get(s.unitId)!.href}>{all.get(s.unitId)!.label}</Link></li>)}</ul> : <p className="text-ink-muted">{t("noSessions")}</p>}<Link href="/learn/plan" className="mt-3 inline-flex min-h-11 items-center font-medium text-brand-ink underline">{t("plan")}</Link>{p.data.state.showRewards && p.data.state.achievements.length ? <div className="mt-3 border-t border-line pt-3"><h3 className="mb-2 font-medium">{t("recentAchievements")}</h3>{p.data.state.achievements.slice(-2).map((a) => <p key={a.id} className="text-sm">★ {t(a.id as "first-day")} · {a.date}</p>)}</div> : null}</Surface>;
}
