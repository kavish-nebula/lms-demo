import "server-only";
import { getCourse, getPrecheck } from "@/data";
import { scorePrecheck } from "@/data/mock-grader";
import type { EnrollmentView, PlanSource, PlanVersion } from "@/lib/learner-plan";
import type { PrecheckResult, SetupAnswers, SupportOverride } from "@/lib/setup";
import type { Pace, StoredPrecheck } from "@/server/db/schema";
import type { SessionUser } from "@/server/auth";
import { ApiError } from "@/server/http";
import * as repo from "@/server/repo";
import { baselinePlan, type PlannerInput } from "./baseline";
import { PlannerError, aiConfigured, generatePlan, plannerModel, type PlannerTransport } from "./llm";
import { courseContext } from "./context";
import { AI_COOLDOWN_MS, replanReason, ruleRevision } from "./policy";
import { validatePlan } from "./validate";

/**
 * The plan lifecycle. Enrolling stores a baseline plan at once and asks the
 * AI planner (GLM) for the real one in the background; signals may ask for a
 * revision. Background work runs through `schedule` (Next's after() in route
 * handlers, an awaited call in tests), so requests never wait on the model.
 */

export type Schedule = (task: () => Promise<void>) => void;

/** A generation older than this was interrupted (for example by a restart). */
const STALE_MS = 5 * 60_000;

export type PrecheckIn = { skipped?: boolean; isNew?: boolean; responses?: Record<string, string | null> } | null;

export type SetupIn = { answers: SetupAnswers; supportOverride: SupportOverride; pace: Pace | null; precheck?: PrecheckIn };

export type { EnrollmentView };

const toVersion = (r: repo.PlanRow): PlanVersion => ({
  version: r.version,
  status: r.status,
  source: r.source,
  trigger: r.trigger,
  model: r.model,
  plan: r.plan ?? null,
  changes: r.changes,
  error: r.error,
  createdAt: r.createdAt.toISOString(),
});

export async function viewOf(e: repo.EnrollmentRow): Promise<EnrollmentView> {
  const plans = await repo.plansFor(e.id);
  for (const p of plans) {
    if (p.status === "generating" && Date.now() - p.createdAt.getTime() > STALE_MS) {
      await repo.updatePlan(p.id, { status: "failed", error: "The plan was interrupted before it finished.", completedAt: new Date() });
      p.status = "failed";
      p.error = "The plan was interrupted before it finished.";
    }
  }
  const current = plans.find((p) => p.status === "ready") ?? null;
  const pending = plans.find((p) => p.status === "generating") ?? null;
  const failed = plans.find((p) => p.status === "failed" && (!current || p.version > current.version)) ?? null;
  const progress: Record<string, string[]> = {};
  for (const r of await repo.progressFor(e.id)) (progress[r.moduleId] ??= []).push(r.stage);
  // raw quick-check responses stay on the server
  const precheck: PrecheckResult | null = e.precheck
    ? { at: e.precheck.at, skipped: e.precheck.skipped, isNew: e.precheck.isNew, lessons: e.precheck.lessons }
    : null;
  return {
    courseId: e.courseId,
    enrolledAt: e.enrolledAt.toISOString(),
    answers: e.answers,
    supportOverride: e.supportOverride,
    pace: e.pace ?? null,
    precheck,
    plan: current ? toVersion(current) : null,
    pending: pending ? { version: pending.version, startedAt: pending.createdAt.toISOString() } : null,
    lastError: failed?.error ?? null,
    progress,
    ai: aiConfigured(),
  };
}

async function scored(courseId: string, p: PrecheckIn | undefined, keep: StoredPrecheck | null): Promise<StoredPrecheck | null> {
  if (p === undefined) return keep;
  if (p === null) return null;
  const at = new Date().toISOString();
  if (p.skipped) return { at, skipped: true, lessons: {} };
  const items = (await getPrecheck(courseId))?.items ?? [];
  if (p.isNew) return { at, isNew: true, lessons: Object.fromEntries([...new Set(items.map((i) => i.lesson))].map((l) => [l, 0])) };
  const responses = p.responses ?? {};
  return { at, lessons: scorePrecheck(items, responses), responses };
}

const inputOf = (user: SessionUser, e: repo.EnrollmentRow): PlannerInput => ({
  name: user.name,
  answers: e.answers,
  supportOverride: e.supportOverride,
  pace: e.pace ?? null,
  precheck: e.precheck ?? null,
});

/** Enrol, or change the setup of an existing enrollment. Either way the plan is rebuilt. */
export async function saveSetup(user: SessionUser, courseId: string, setup: SetupIn, schedule: Schedule, api?: PlannerTransport) {
  const ctx = await courseContext(courseId).catch(() => {
    throw new ApiError(404, "unknown_course", `There is no course "${courseId}".`);
  });
  const existing = await repo.findEnrollment(user.id, courseId);
  const precheck = await scored(courseId, setup.precheck, existing?.precheck ?? null);
  const e = await repo.upsertEnrollment(user.id, courseId, { answers: setup.answers, supportOverride: setup.supportOverride, pace: setup.pace, precheck });
  const trigger = existing ? "setup" : "enrol";
  await repo.insertPlan(e.id, { status: "ready", source: "baseline", trigger, plan: baselinePlan(inputOf(user, e), ctx), changes: [], completedAt: new Date() });
  await startAi(user, e, trigger, schedule, api);
  return viewOf(e);
}

/** Store answers from lessons; re-plan when the evidence calls for it. */
export async function recordSignals(user: SessionUser, courseId: string, list: repo.NewSignal[], schedule: Schedule, api?: PlannerTransport) {
  const e = await mustFind(user, courseId);
  const fresh = await repo.insertSignals(e.id, list.map((s) => ({ ...s, key: `${e.id}:${s.key}` })));
  const replanning = fresh.length ? await maybeReplan(user, e, fresh, schedule, api) : false;
  return { accepted: fresh.length, replanning };
}

/** Mark a topic done. Finishing every written topic of a module is itself a signal. */
export async function recordProgress(user: SessionUser, courseId: string, moduleId: string, stage: string, schedule: Schedule, api?: PlannerTransport) {
  const e = await mustFind(user, courseId);
  const ctx = await courseContext(courseId);
  const m = ctx.modules.find((x) => x.id === moduleId);
  if (!m || !m.stages.includes(stage)) throw new ApiError(400, "unknown_topic", `Module ${moduleId} has no topic "${stage}".`);
  const added = await repo.addProgress(e.id, moduleId, stage);
  if (added) {
    const done = new Set((await repo.progressFor(e.id)).filter((r) => r.moduleId === moduleId).map((r) => r.stage));
    const list: repo.NewSignal[] = [{ key: `${e.id}:topic:${moduleId}:${stage}`, kind: "topic_complete", moduleId, lesson: null, payload: { stage } }];
    if (m.authored.length && m.authored.every((s) => done.has(s))) list.push({ key: `${e.id}:module:${moduleId}`, kind: "module_complete", moduleId, lesson: null, payload: {} });
    const fresh = await repo.insertSignals(e.id, list);
    await maybeReplan(user, e, fresh, schedule, api);
  }
  return viewOf(e);
}

async function mustFind(user: SessionUser, courseId: string) {
  const e = await repo.findEnrollment(user.id, courseId);
  if (!e) throw new ApiError(404, "not_enrolled", `You are not enrolled in "${courseId}".`);
  return e;
}

async function maybeReplan(user: SessionUser, e: repo.EnrollmentRow, fresh: repo.SignalRow[], schedule: Schedule, api?: PlannerTransport) {
  const unused = await repo.unusedSignals(e.id);
  const reason = replanReason(fresh, unused);
  if (!reason) return false;
  if ((aiConfigured() || api) && (await startAi(user, e, "signals", schedule, api, true))) return true;

  // No AI planner, or it revised the plan minutes ago: apply the rule-based
  // revision at once. The signals stay unused, so the next AI revision still
  // sees them as evidence.
  const current = (await repo.plansFor(e.id)).find((p) => p.status === "ready");
  const revised = current?.plan ? ruleRevision(current.plan, unused) : null;
  if (!revised) return false;
  // the revision adjusts the current plan, so it keeps that plan's source: an AI-written plan stays personalised
  await repo.insertPlan(e.id, { status: "ready", source: current!.source, trigger: "signals", plan: revised, changes: revised.changes, completedAt: new Date() });
  return true;
}

/** Ask the AI planner for a plan in the background, unless one is already being written (or one was just written). */
async function startAi(user: SessionUser, e: repo.EnrollmentRow, trigger: PlanVersion["trigger"], schedule: Schedule, api?: PlannerTransport, cooldown = false): Promise<boolean> {
  if (!api && !aiConfigured()) return false;
  const plans = await repo.plansFor(e.id);
  if (plans.some((p) => p.status === "generating" && Date.now() - p.createdAt.getTime() < STALE_MS)) return false;
  // the last AI call (rule revisions of an AI plan share its source but record no model)
  const lastAi = plans.find((p) => p.source === "ai" && p.model);
  if (cooldown && lastAi && Date.now() - lastAi.createdAt.getTime() < AI_COOLDOWN_MS) return false;

  const row = await repo.insertPlan(e.id, { status: "generating", source: "ai" satisfies PlanSource, trigger, model: plannerModel() });
  schedule(() => runAi(user, e.id, e.courseId, row, trigger, api));
  return true;
}

async function runAi(user: SessionUser, enrollmentId: string, courseId: string, row: repo.PlanRow, trigger: PlanVersion["trigger"], api?: PlannerTransport) {
  try {
    const e = await repo.findEnrollment(user.id, courseId);
    if (!e || e.id !== enrollmentId) return;
    const ctx = await courseContext(courseId);
    const input = inputOf(user, e);
    const plans = await repo.plansFor(e.id);
    const current = plans.find((p) => p.status === "ready" && p.version < row.version);
    const evidence = trigger === "enrol" ? [] : await repo.unusedSignals(e.id);
    const previous = trigger === "enrol" || !current?.plan ? null : { version: current.version, plan: current.plan };
    const result = await generatePlan(
      {
        ctx,
        input,
        previous,
        evidence: evidence.map((s) => ({ at: s.createdAt.toISOString(), kind: s.kind, moduleId: s.moduleId, lesson: s.lesson, payload: s.payload })),
        trigger,
      },
      api,
    );
    const { plan, issues } = validatePlan(result.plan, ctx, baselinePlan(input, ctx), { override: input.supportOverride, floor: evidence.length === 0 });
    await repo.updatePlan(row.id, {
      status: "ready",
      plan,
      changes: previous ? plan.changes : [],
      model: result.model,
      usage: result.usage,
      error: issues.length ? `Adjusted after checks: ${issues.join("; ")}` : null,
      completedAt: new Date(),
    });
    await repo.markSignalsUsed(
      evidence.map((s) => s.id),
      row.version,
    );
  } catch (err) {
    const message = err instanceof PlannerError ? err.message : "The AI plan could not be written.";
    if (err instanceof PlannerError) console.warn("[planner]", err.detail);
    else console.error("[planner]", err);
    await repo.updatePlan(row.id, { status: "failed", error: message, completedAt: new Date() }).catch(() => {});
  }
}

/** Every enrollment in a course that still exists (a removed course's rows stay stored, unlisted). */
export async function enrollmentsOf(user: SessionUser) {
  const rows = await repo.listEnrollments(user.id);
  const live = await Promise.all(rows.map(async (e) => ((await getCourse(e.courseId)) ? e : null)));
  return Promise.all(live.filter((e): e is NonNullable<typeof e> => !!e).map(viewOf));
}

export async function enrollmentOf(user: SessionUser, courseId: string) {
  return viewOf(await mustFind(user, courseId));
}

export async function planHistory(user: SessionUser, courseId: string) {
  const e = await mustFind(user, courseId);
  return (await repo.plansFor(e.id)).map(toVersion);
}
