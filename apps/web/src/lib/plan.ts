/**
 * Learning Plan: pure helpers, no React. Ported from the prototype's
 * engine/plan.js. The learner places sessions on days themselves; this works
 * out what is left, what each day holds, and on request a suggested layout
 * for everything not planned yet. Nothing is ever "missed": a planned
 * session that was not done simply stays where it is.
 */
import type { Course, DueReview, FinaleStepId, HistoryEntry } from "@/data/types";
import { moduleTopics } from "@/lib/topics";
import type { StageId } from "@/lib/stages";

/** Default minutes per stage (ch13 Op 4 table, mid-points). Scaled per module. */
export const STAGE_MINUTES: Record<StageId, number> = {
  hook: 3,
  explainer: 7,
  worked: 8,
  guided: 8,
  lab: 15,
  project: 30,
  gate: 8,
  reflection: 4,
  review: 4,
};

export const SESSION_LENGTHS = [10, 20, 30, 45] as const;
/** Date.getDay() indices, Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const HORIZON_DAYS = 365;

export type PlanUnit = {
  id: string;
  courseId: string;
  courseTitle: string;
  /** module id, or "finale" for the steps after all modules */
  moduleId: string;
  /** 1-based; 0 for the finale */
  moduleIndex: number;
  /** module title, or the finale's group title */
  moduleTitle: string;
  /** the topic's own title, shown instead of the method name */
  label: string;
  /** used for the icon and colour only */
  stage: StageId;
  href: string;
  minutes: number;
  done: boolean;
};

export type PlanSession = { id: string; date: string; unitId: string };

export type PlanPrefs = { studyDays: number[]; sessionMinutes: number };

export type PlanState = PlanPrefs & { sessions: PlanSession[] };

export const DEFAULT_PLAN: PlanState = { sessions: [], studyDays: [1, 3, 5], sessionMinutes: 30 };

export type DayItem =
  | { id: string; type: "session"; unit: PlanUnit; sessionId: string; done: boolean }
  | { id: string; type: "review"; label: string; course: string; minutes: number; done: false; dueToday: boolean }
  | { id: string; type: "done"; label: string; course: string; detail: string; done: true };

/* ------------------------------------------------------------- dates */

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(key: string, n: number) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Weeks of a month, Monday first; cells outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => dayKey(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/* ------------------------------------------------------------- units */

/**
 * Every topic of every module, then the finale steps, in course order.
 * Minutes scale the stage defaults to the module's estimate. Done comes from
 * the course outline plus whatever the player has stored.
 */
export function courseUnits(
  course: Course,
  storedDone: Record<string, StageId[]> = {},
  finaleDone: FinaleStepId[] = [],
): PlanUnit[] {
  const out: PlanUnit[] = [];
  const base = `/learn/courses/${course.course_id}`;
  course.modules.forEach((m, mi) => {
    const topics = moduleTopics(m);
    const total = topics.reduce((n, t) => n + STAGE_MINUTES[t.stage], 0) || 1;
    const scale = m.minutes / total;
    const cut = m.current_stage ? m.stages.indexOf(m.current_stage) : -1;
    const stored = new Set(storedDone[m.module_id] ?? []);
    for (const t of topics) {
      const outlineDone =
        m.state === "done" || (m.state === "in_progress" && cut > 0 && m.stages.indexOf(t.stage) < cut);
      out.push({
        id: `${course.course_id}:${m.module_id}:${t.stage}`,
        courseId: course.course_id,
        courseTitle: course.title,
        moduleId: m.module_id,
        moduleIndex: mi + 1,
        moduleTitle: m.title,
        label: t.title,
        stage: t.stage,
        href: `${base}/${m.module_id}/${t.stage}`,
        minutes: Math.max(1, Math.round(STAGE_MINUTES[t.stage] * scale)),
        done: outlineDone || stored.has(t.stage),
      });
    }
  });
  for (const f of course.finale.steps) {
    out.push({
      id: `${course.course_id}:finale:${f.id}`,
      courseId: course.course_id,
      courseTitle: course.title,
      moduleId: "finale",
      moduleIndex: 0,
      moduleTitle: course.finale.title,
      label: `${f.kicker}: ${f.title}`,
      stage: f.stage,
      href: `${base}/finale/${f.id}`,
      minutes: f.minutes,
      done: finaleDone.includes(f.id),
    });
  }
  return out;
}

export const sessionId = (date: string, unitId: string) => `${date}|${unitId}`;

/* ------------------------------------------------------------- plan it for me */

/**
 * Sessions for every remaining unit without one, laid onto the study days from
 * `today`, each day filled to about the session length. A unit longer than the
 * session still gets a day of its own.
 */
export function autoFill(remaining: PlanUnit[], plan: PlanState, today: string): PlanSession[] {
  if (!plan.studyDays.length) return [];
  const planned = new Set(plan.sessions.map((s) => s.unitId));
  const queue = remaining.filter((u) => !planned.has(u.id));
  const minutesOf = new Map(remaining.map((u) => [u.id, u.minutes]));
  const used: Record<string, number> = {};
  for (const s of plan.sessions) used[s.date] = (used[s.date] ?? 0) + (minutesOf.get(s.unitId) ?? 0);

  const out: PlanSession[] = [];
  let i = 0;
  for (let n = 0; n < HORIZON_DAYS && i < queue.length; n++) {
    const key = addDays(today, n);
    if (!plan.studyDays.includes(fromKey(key).getDay())) continue;
    let total = used[key] ?? 0;
    let placed = 0;
    while (i < queue.length) {
      const u = queue[i]!;
      if (!(total + u.minutes <= plan.sessionMinutes || (total === 0 && placed === 0))) break;
      out.push({ id: sessionId(key, u.id), date: key, unitId: u.id });
      total += u.minutes;
      placed++;
      i++;
    }
  }
  return out;
}

/* ------------------------------------------------------------- calendar days */

/**
 * Everything on each day: planned sessions, health checks on their due date
 * (overdue ones wait on today), and work already done.
 */
export function dayItems({
  sessions,
  units,
  reviews,
  history,
  today,
}: {
  sessions: PlanSession[];
  units: Map<string, PlanUnit>;
  reviews: DueReview[];
  history: HistoryEntry[];
  today: string;
}): Record<string, DayItem[]> {
  const days: Record<string, DayItem[]> = {};
  const put = (key: string, item: DayItem) => (days[key] ??= []).push(item);

  for (const s of sessions) {
    const unit = units.get(s.unitId);
    if (unit) put(s.date, { id: s.id, type: "session", unit, sessionId: s.id, done: unit.done });
  }
  for (const r of reviews) {
    const dueToday = r.due <= today;
    put(dueToday ? today : r.due, {
      id: r.review_item_id,
      type: "review",
      label: r.module_title,
      course: r.course_title,
      minutes: r.questions * 1 + 2,
      done: false,
      dueToday,
    });
  }
  for (const h of history) {
    put(h.at.slice(0, 10), {
      id: `done:${h.at}`,
      type: "done",
      label: h.module_title,
      course: h.course_title,
      detail: h.detail,
      done: true,
    });
  }
  return days;
}
