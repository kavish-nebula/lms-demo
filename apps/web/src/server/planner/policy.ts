import "server-only";
import type { LearnerPlan, PlanChangeT } from "@/lib/learner-plan";
import type { SignalRow } from "@/server/repo";

/**
 * When the evidence is worth a new plan, and what the rules change when the
 * AI planner isn't available. AI revisions are rate-limited per enrollment.
 */

export const AI_COOLDOWN_MS = 10 * 60_000;

const missed = (s: SignalRow) => (s.kind === "video_check" || s.kind === "recall_answer" || s.kind === "scenario_answer") && s.payload.correct === false;

/** A failed module check or final check, with the lessons (or, for a whole module, its number) it found weak. */
const failedCheck = (s: SignalRow) => (s.kind === "module_check" || s.kind === "final_check") && s.payload.passed === false;
const missedIn = (s: SignalRow) => (Array.isArray(s.payload.missedLessons) ? (s.payload.missedLessons as string[]) : []);
/** "2.3" names a lesson; "2" names every lesson of module 2. */
const covers = (key: string, lessonId: string) => key === lessonId || (!key.includes(".") && lessonId.startsWith(`${key}.`));

/** Why the new signals call for a re-plan, or null when they don't. */
export function replanReason(fresh: SignalRow[], unused: SignalRow[]): string | null {
  for (const s of fresh) {
    if (s.kind === "module_complete") return `finished ${s.moduleId}`;
    if (s.kind === "module_check" && s.payload.passed === false) return `module check not passed in ${s.moduleId}`;
    if (s.kind === "final_check" && s.payload.passed === false) return "final check not passed";
    if (s.kind === "capstone_check" && s.payload.accepted === false) return "capstone check not passed";
  }
  const lessons = new Set(fresh.filter(missed).map((s) => s.lesson).filter((l): l is string => !!l));
  for (const l of lessons) if (unused.filter((s) => missed(s) && s.lesson === l).length >= 2) return `two misses in lesson ${l}`;
  return null;
}

/**
 * The rule-based revision used without the AI planner: lessons with two or more
 * misses, or missed on a failed module or final check, get extra help.
 * Returns null when nothing changes.
 */
export function ruleRevision(plan: LearnerPlan, evidence: SignalRow[]): LearnerPlan | null {
  const misses = new Map<string, number>();
  for (const s of evidence) if (missed(s) && s.lesson) misses.set(s.lesson, (misses.get(s.lesson) ?? 0) + 1);
  const checks = evidence.filter(failedCheck);
  const checkMiss = (lessonId: string) => checks.find((s) => missedIn(s).some((k) => covers(k, lessonId)));

  const changes: PlanChangeT[] = [];
  const modules = plan.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => {
      const n = misses.get(l.lessonId) ?? 0;
      const check = n < 2 ? checkMiss(l.lessonId) : undefined;
      if (l.support === "extra" || (n < 2 && !check)) return l;
      const which = check?.kind === "module_check" ? "module check" : "final check";
      const reason = n >= 2 ? `You missed ${n} checks in lesson ${l.lessonId}, so it now gives more help.` : `The ${which} showed lesson ${l.lessonId} needs another look, so it now gives more help.`;
      changes.push({ target: `lesson ${l.lessonId} help`, from: l.support, to: "extra", reason });
      return { ...l, support: "extra" as const, why: reason };
    }),
  }));
  return changes.length ? { ...plan, modules, changes } : null;
}
