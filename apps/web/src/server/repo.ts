import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { SetupAnswers, SupportOverride } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";
import { db } from "./db/client";
import { adaptedContent, enrollments, learnerPlans, profileDrafts, profiles, signals, stepProgress, type AdaptedPiece, type Pace, type StoredPrecheck } from "./db/schema";

/** Queries for learner data. Callers pass the session user's id; nothing here reads across users. */

export type EnrollmentRow = typeof enrollments.$inferSelect;
export type PlanRow = typeof learnerPlans.$inferSelect;
export type SignalRow = typeof signals.$inferSelect;
export type NewPlan = Omit<typeof learnerPlans.$inferInsert, "id" | "enrollmentId" | "version">;
export type AdaptedRow = typeof adaptedContent.$inferSelect;
export type NewSignal = { key: string; kind: string; moduleId: string | null; lesson: string | null; payload: Record<string, unknown> };

/* ---------------------------------------------------------------- profile */

export async function getProfile(userId: string) {
  const d = await db();
  return (await d.query.profiles.findFirst({ where: eq(profiles.userId, userId) })) ?? null;
}

/** `derived` is left as it is when not given. */
export async function saveProfile(userId: string, answers: SetupAnswers, needs: string[], derived?: ProfileDerived | null) {
  const d = await db();
  const now = new Date();
  const set = { answers, needs, updatedAt: now, ...(derived !== undefined ? { derived } : {}) };
  await d
    .insert(profiles)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: profiles.userId, set });
  return getProfile(userId);
}

/* ---------------------------------------------------------------- profile draft ("About you" in progress) */

export async function getProfileDraft(userId: string) {
  const d = await db();
  return (await d.query.profileDrafts.findFirst({ where: eq(profileDrafts.userId, userId) })) ?? null;
}

export async function saveProfileDraft(userId: string, answers: SetupAnswers, needs: string[], derived: ProfileDerived | null) {
  const d = await db();
  const now = new Date();
  const set = { answers, needs, derived, updatedAt: now };
  await d
    .insert(profileDrafts)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: profileDrafts.userId, set });
}

export async function deleteProfileDraft(userId: string) {
  const d = await db();
  await d.delete(profileDrafts).where(eq(profileDrafts.userId, userId));
}

/* ---------------------------------------------------------------- enrollments */

export async function findEnrollment(userId: string, courseId: string) {
  const d = await db();
  return (await d.query.enrollments.findFirst({ where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)) })) ?? null;
}

export async function listEnrollments(userId: string) {
  const d = await db();
  return d.query.enrollments.findMany({ where: eq(enrollments.userId, userId), orderBy: asc(enrollments.enrolledAt) });
}

export type EnrollmentPatch = { answers: SetupAnswers; supportOverride: SupportOverride; pace: Pace | null; precheck: StoredPrecheck | null; enrolledAt?: Date };

export async function upsertEnrollment(userId: string, courseId: string, patch: EnrollmentPatch): Promise<EnrollmentRow> {
  const d = await db();
  const now = new Date();
  const [row] = await d
    .insert(enrollments)
    .values({ userId, courseId, ...patch, enrolledAt: patch.enrolledAt ?? now, updatedAt: now })
    .onConflictDoUpdate({
      target: [enrollments.userId, enrollments.courseId],
      set: { answers: patch.answers, supportOverride: patch.supportOverride, pace: patch.pace, precheck: patch.precheck, updatedAt: now },
    })
    .returning();
  return row!;
}

export async function deleteEnrollment(userId: string, courseId: string) {
  const d = await db();
  await d.delete(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
}

/** Everything the learner has stored: enrollments (and with them plans, signals, progress) and the profile. */
export async function deleteUserData(userId: string) {
  const d = await db();
  await d.delete(enrollments).where(eq(enrollments.userId, userId));
  await d.delete(profiles).where(eq(profiles.userId, userId));
  await d.delete(profileDrafts).where(eq(profileDrafts.userId, userId));
}

/* ---------------------------------------------------------------- adapted content */

export async function adaptedFor(enrollmentId: string, moduleId?: string) {
  const d = await db();
  return d.query.adaptedContent.findMany({
    where: moduleId ? and(eq(adaptedContent.enrollmentId, enrollmentId), eq(adaptedContent.moduleId, moduleId)) : eq(adaptedContent.enrollmentId, enrollmentId),
    orderBy: asc(adaptedContent.createdAt),
  });
}

/** Starts (or restarts) one piece: its row, reset to `writing` from these inputs. */
export async function startAdapted(enrollmentId: string, moduleId: string, piece: AdaptedPiece, inputs: string) {
  const d = await db();
  const set = { status: "writing" as const, inputs, content: null, audio: null, model: null, error: null, updatedAt: new Date() };
  const [row] = await d
    .insert(adaptedContent)
    .values({ enrollmentId, moduleId, piece, ...set })
    .onConflictDoUpdate({ target: [adaptedContent.enrollmentId, adaptedContent.moduleId, adaptedContent.piece], set })
    .returning();
  return row!;
}

export async function updateAdapted(id: string, set: Partial<Pick<AdaptedRow, "status" | "content" | "audio" | "model" | "error">>) {
  const d = await db();
  await d.update(adaptedContent).set({ ...set, updatedAt: new Date() }).where(eq(adaptedContent.id, id));
}

/* ---------------------------------------------------------------- plans */

export async function plansFor(enrollmentId: string) {
  const d = await db();
  return d.query.learnerPlans.findMany({ where: eq(learnerPlans.enrollmentId, enrollmentId), orderBy: desc(learnerPlans.version) });
}

export async function insertPlan(enrollmentId: string, plan: NewPlan): Promise<PlanRow> {
  const d = await db();
  return d.transaction(async (tx) => {
    const last = await tx.query.learnerPlans.findFirst({ where: eq(learnerPlans.enrollmentId, enrollmentId), orderBy: desc(learnerPlans.version) });
    const [row] = await tx
      .insert(learnerPlans)
      .values({ ...plan, enrollmentId, version: (last?.version ?? 0) + 1 })
      .returning();
    return row!;
  });
}

export async function updatePlan(id: string, patch: Partial<NewPlan>) {
  const d = await db();
  await d.update(learnerPlans).set(patch).where(eq(learnerPlans.id, id));
}

/* ---------------------------------------------------------------- signals */

/** Stores new signals; repeats of an idempotency key are ignored. Returns the ones actually stored. */
export async function insertSignals(enrollmentId: string, list: NewSignal[]): Promise<SignalRow[]> {
  if (!list.length) return [];
  const d = await db();
  return d
    .insert(signals)
    .values(list.map((s) => ({ enrollmentId, kind: s.kind, moduleId: s.moduleId, lesson: s.lesson, payload: s.payload, idempotencyKey: s.key })))
    .onConflictDoNothing({ target: signals.idempotencyKey })
    .returning();
}

/** Signals no plan has taken into account yet, oldest first. */
export async function unusedSignals(enrollmentId: string) {
  const d = await db();
  return d.query.signals.findMany({ where: and(eq(signals.enrollmentId, enrollmentId), isNull(signals.usedInPlanVersion)), orderBy: asc(signals.createdAt) });
}

export async function markSignalsUsed(ids: string[], version: number) {
  if (!ids.length) return;
  const d = await db();
  await d.update(signals).set({ usedInPlanVersion: version }).where(inArray(signals.id, ids));
}

/* ---------------------------------------------------------------- progress */

export async function progressFor(enrollmentId: string) {
  const d = await db();
  return d.query.stepProgress.findMany({ where: eq(stepProgress.enrollmentId, enrollmentId), orderBy: asc(stepProgress.completedAt) });
}

/** Marks a topic done; false when it already was. */
export async function addProgress(enrollmentId: string, moduleId: string, stage: string): Promise<boolean> {
  const d = await db();
  const rows = await d.insert(stepProgress).values({ enrollmentId, moduleId, stage }).onConflictDoNothing().returning();
  return rows.length > 0;
}

