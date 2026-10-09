import "server-only";
import type { LearnerPlan, PlanLessonT, PlanModuleT } from "@/lib/learner-plan";
import type { CourseContext } from "./context";

/**
 * Checks a plan against the real course before anyone sees it. The schema
 * check in llm.ts guarantees the shape; this guarantees the content: every module and
 * lesson present with real ids, a topic order the player can follow (the
 * opening scenario first, the recall topic last), sane pacing, capped text,
 * no links. Anything invalid takes the baseline's value and is reported.
 */

const LIMITS = { summary: 600, why: 240, title: 80, body: 520, scene: 520, brief: 520, note: 240, phrase: 80, reason: 240 };
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

function text(v: string | null | undefined, max: number): string {
  const s = (v ?? "").replace(URL, "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function validatePlan(plan: LearnerPlan, ctx: CourseContext, baseline: LearnerPlan): { plan: LearnerPlan; issues: string[] } {
  const issues: string[] = [];

  const modules: PlanModuleT[] = ctx.modules.map((cm) => {
    const base = baseline.modules.find((m) => m.moduleId === cm.id)!;
    const got = plan.modules.find((m) => m.moduleId === cm.id);
    if (!got) {
      issues.push(`module ${cm.id} missing`);
      return base;
    }

    // topic order: a permutation of the outline's topics, opening scenario first, recall last
    let order = got.topicOrder;
    const same = order.length === cm.stages.length && cm.stages.every((s) => order.includes(s)) && new Set(order).size === order.length;
    const hookOk = !cm.stages.includes("hook") || order[0] === "hook";
    const reviewOk = !cm.stages.includes("review") || order[order.length - 1] === "review";
    if (!same || !hookOk || !reviewOk) {
      issues.push(`module ${cm.id}: topic order ${JSON.stringify(order)} rejected`);
      order = base.topicOrder;
    }

    const lessons: PlanLessonT[] = cm.lessons.map((cl) => {
      const b = base.lessons.find((l) => l.lessonId === cl.id)!;
      const l = got.lessons.find((x) => x.lessonId === cl.id);
      if (!l) {
        issues.push(`lesson ${cl.id} missing`);
        return b;
      }
      return {
        lessonId: cl.id,
        support: l.support,
        why: text(l.why, LIMITS.why) || b.why,
        inYourWorld: { title: text(l.inYourWorld.title, LIMITS.title), body: text(l.inYourWorld.body, LIMITS.body) },
      };
    });
    const extra = got.lessons.filter((l) => !cm.lessons.some((cl) => cl.id === l.lessonId)).map((l) => l.lessonId);
    if (extra.length) issues.push(`module ${cm.id}: unknown lessons ${extra.join(", ")} dropped`);

    return {
      moduleId: cm.id,
      emphasis: got.emphasis,
      why: text(got.why, LIMITS.why) || base.why,
      topicOrder: order,
      support: got.support,
      hookScene: got.hookScene ? text(got.hookScene, LIMITS.scene) : base.hookScene,
      lessons,
    };
  });
  const unknown = plan.modules.filter((m) => !ctx.modules.some((cm) => cm.id === m.moduleId)).map((m) => m.moduleId);
  if (unknown.length) issues.push(`unknown modules ${unknown.join(", ")} dropped`);

  const clamp = (n: number, lo: number, hi: number, fallback: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback);
  const phrases = (xs: string[]) => xs.map((x) => text(x, LIMITS.phrase)).filter(Boolean).slice(0, 3);

  return {
    plan: {
      summary: text(plan.summary, LIMITS.summary) || baseline.summary,
      learner: { level: plan.learner.level, strengths: phrases(plan.learner.strengths), gaps: phrases(plan.learner.gaps) },
      pacing: {
        minutesPerSession: clamp(plan.pacing.minutesPerSession, 10, 90, baseline.pacing.minutesPerSession),
        sessionsPerWeek: clamp(plan.pacing.sessionsPerWeek, 1, 7, baseline.pacing.sessionsPerWeek),
        note: text(plan.pacing.note, LIMITS.note) || baseline.pacing.note,
      },
      modules,
      capstoneBrief: text(plan.capstoneBrief, LIMITS.brief) || baseline.capstoneBrief,
      changes: plan.changes.slice(0, 12).map((c) => ({ target: text(c.target, LIMITS.phrase), from: text(c.from, LIMITS.phrase), to: text(c.to, LIMITS.phrase), reason: text(c.reason, LIMITS.reason) })),
    },
    issues,
  };
}
