import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { platformEngagement, enrollments, stepProgress } from "./db/schema";
import { ApiError } from "./http";
import { initialEngagement, recalculate, engagementView, dateInZone, shiftDay, weekOf, canGrace, type EngagementState } from "@/lib/engagement";

export const engagementEnabled = () => process.env.PLATFORM_ENGAGEMENT_ENABLED === "true";
export function requireEngagement() { if (!engagementEnabled()) throw new ApiError(404,"feature_disabled","Platform activity is not enabled."); }
const keyOf = (e: { enrollmentId: string; moduleId: string; stage: string }) => `${e.enrollmentId}:${e.moduleId}:${e.stage}`;
export async function readEngagement(userId: string, timezone = "UTC") {
  const d = await db();
  const existing = await d.query.platformEngagement.findFirst({ where: eq(platformEngagement.userId,userId) });
  if (existing) return engagementView(existing.state,new Date());
  const progress = await d.select({ enrollmentId: stepProgress.enrollmentId, moduleId: stepProgress.moduleId, stage: stepProgress.stage }).from(stepProgress).innerJoin(enrollments,eq(enrollments.id,stepProgress.enrollmentId)).where(eq(enrollments.userId,userId));
  await d.insert(platformEngagement).values({ userId, state: initialEngagement(new Date(),timezone,progress.map(keyOf)) }).onConflictDoNothing();
  const row = await d.query.platformEngagement.findFirst({ where: eq(platformEngagement.userId,userId) });
  return engagementView(row!.state,new Date());
}
/** Lock one learner row so concurrent tabs cannot double-award activity. */
export async function changeEngagement(userId: string, change: (s: EngagementState) => EngagementState | void) {
  await readEngagement(userId);
  const d = await db();
  return d.transaction(async (tx) => {
    const [row] = await tx.select().from(platformEngagement).where(eq(platformEngagement.userId,userId)).for("update");
    const state = recalculate(change(row!.state) ?? row!.state);
    state.revision = (row!.state.revision ?? 0) + 1;
    await tx.update(platformEngagement).set({ state, updatedAt: new Date() }).where(eq(platformEngagement.userId,userId));
    return engagementView(state,new Date());
  });
}
export async function reconcileEngagement(userId: string) {
  const d = await db();
  const progress = await d.select({ enrollmentId: stepProgress.enrollmentId, moduleId: stepProgress.moduleId, stage: stepProgress.stage, completedAt: stepProgress.completedAt, courseId: enrollments.courseId }).from(stepProgress).innerJoin(enrollments,eq(enrollments.id,stepProgress.enrollmentId)).where(eq(enrollments.userId,userId));
  return changeEngagement(userId,(s) => {
    const seen = new Set([...s.baseline,...s.completions.map((e) => e.key)]);
    for (const e of progress) if (!seen.has(keyOf(e)) && e.completedAt.toISOString() > s.activatedAt) {
      const zone = [...s.timezoneHistory].filter((entry) => entry.at <= e.completedAt.toISOString()).at(-1)?.zone ?? s.timezoneHistory[0]!.zone;
      s.completions.push({ key: keyOf(e), date: dateInZone(e.completedAt,zone), timezone: zone, courseId: e.courseId }); seen.add(keyOf(e));
    }
  });
}
export function assertLogDate(state: EngagementState, date: string, now = new Date()) {
  const today = dateInZone(now,state.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || date > today || date < shiftDay(today,-7)) throw new ApiError(400,"invalid_date","Choose today or one of the preceding seven days.");
}
export function applyGrace(s: EngagementState) {
  const today = dateInZone(new Date(),s.timezone);
  if (!canGrace(s,today)) throw new ApiError(409,"grace_unavailable","Grace can cover yesterday after an active day, once per week.");
  s.grace.push(shiftDay(today,-1));
}
export function setTarget(s: EngagementState, days: number) {
  const today = dateInZone(new Date(),s.timezone);
  // The first explicit goal setup applies now; later edits apply next week.
  const initial = !s.goalConfigured;
  const week = shiftDay(weekOf(today),initial ? 0 : 7);
  s.targets = [...s.targets.filter((t) => t.week !== week), { week, days }]; s.goalConfigured = true;
}
export async function deleteEngagement(userId: string) { const d = await db(); await d.delete(platformEngagement).where(and(eq(platformEngagement.userId,userId))); }
