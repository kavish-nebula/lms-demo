"use client";
import Link from "next/link";
import { CalendarClock, Check, ArrowRight } from "lucide-react";
import { useLocalPrefix, useHydrated } from "@/lib/local-store";
import type { LearningState } from "@/lib/learning-state";
import type { Course } from "@/data/types";

export function ScheduledReviews({ courses }: { courses: Course[] }) {
  const stored = useLocalPrefix<LearningState>("lms-learning:v1:");
  const hydrated = useHydrated();
  const tickets = courses.flatMap((course) => (stored[`lms-learning:v1:${course.course_id}`]?.reviews ?? []).map((r) => ({ ...r, course, module: course.modules.find((m) => m.module_id === r.moduleId) }))).sort((a, b) => a.due.localeCompare(b.due));
  if (!hydrated || !tickets.length) return null;
  return <section className="journey-section max-w-3xl"><div className="journey-kicker"><CalendarClock className="size-4" />Your scheduled return visits</div><h2 className="mt-2 text-xl font-semibold">Keep useful ideas close.</h2><div className="mt-4 divide-y divide-line">{tickets.map((r) => <div key={`${r.course.course_id}:${r.id}`} className="flex items-center gap-3 py-4"><span className="journey-number">{r.completedAt ? <Check className="size-4" /> : <CalendarClock className="size-4" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.module?.title ?? r.moduleId}</p><p className="mt-1 text-xs text-ink-muted">{r.completedAt ? "Recalled" : new Date(r.due) <= new Date() ? "Ready to revisit" : `Due ${new Date(r.due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`} · {r.interval}-day review</p></div><Link href={`/learn/courses/${r.course.course_id}/${r.moduleId}/review#review-${r.interval}`} className="flex items-center gap-1 text-xs text-brand-ink">{r.completedAt ? "Revisit" : "Practise"}<ArrowRight className="size-3" /></Link></div>)}</div></section>;
}
