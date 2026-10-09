import "server-only";
import type { LearnerPlan, PlanChangeT } from "@/lib/learner-plan";
import type { SignalRow } from "@/server/repo";

/**
 * When the evidence is worth a new plan, and what the rules change when the
 * AI planner isn't available. AI revisions are rate-limited per enrollment.
 */

export const AI_COOLDOWN_MS = 10 * 60_000;

const missed = (s: SignalRow) => (s.kind === "video_check" || s.kind === "recall_answer") && s.payload.correct === false;

/** Why the new signals call for a re-plan, or null when they don't. */
export function replanReason(fresh: SignalRow[], unused: SignalRow[]): string | null {
  for (const s of fresh) {
    if (s.kind === "module_complete") return `finished ${s.moduleId}`;
    if (s.kind === "final_check" && s.payload.passed === false) return "final check not passed";
    if (s.kind === "capstone_check" && s.payload.accepted === false) return "capstone check not passed";
  }
  const lessons = new Set(fresh.filter(missed).map((s) => s.lesson).filter((l): l is string => !!l));
  for (const l of lessons) if (unused.filter((s) => missed(s) && s.lesson === l).length >= 2) return `two misses in lesson ${l}`;
  return null;
}

/**
 * The rule-based revision used without the AI planner: lessons with two or more
 * misses, or missed on a failed final check, get extra help. Returns null
 * when nothing changes.
 */
export function ruleRevision(plan: LearnerPlan, evidence: SignalRow[]): LearnerPlan | null {
  const misses = new Map<string, number>();
  for (const s of evidence) if (missed(s) && s.lesson) misses.set(s.lesson, (misses.get(s.lesson) ?? 0) + 1);
  const finalMissed = new Set(
    evidence.filter((s) => s.kind === "final_check" && s.payload.passed === false).flatMap((s) => (Array.isArray(s.payload.missedLessons) ? (s.payload.missedLessons as string[]) : [])),
  );

  const changes: PlanChangeT[] = [];
  const modules = plan.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => {
      const n = misses.get(l.lessonId) ?? 0;
      if (l.support === "extra" || (n < 2 && !finalMissed.has(l.lessonId))) return l;
      const reason = n >= 2 ? `You missed ${n} checks in lesson ${l.lessonId}, so it now gives more help.` : `The final check showed lesson ${l.lessonId} needs another look, so it now gives more help.`;
      changes.push({ target: `lesson ${l.lessonId} help`, from: l.support, to: "extra", reason });
      return { ...l, support: "extra" as const, why: reason };
    }),
  }));
  return changes.length ? { ...plan, modules, changes } : null;
}
