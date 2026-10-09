import "server-only";
import type { LearnerPlan, PlanLessonT, PlanModuleT } from "@/lib/learner-plan";
import type { Support, SupportOverride } from "@/lib/setup";
import type { CourseContext } from "./context";

/**
 * Checks a plan against the real course before anyone sees it. The schema
 * check in llm.ts guarantees the shape; this guarantees the content: every module and
 * lesson present with real ids, a topic order the player can follow (the
 * opening scenario first; the module check, then the recall topic, last), sane pacing, capped text,
 * no links. Anything invalid takes the baseline's value and is reported.
 *
 * It also holds the plan to what the learner told us. Their explicit choices
 * win: a help level they set applies to every lesson, and "see a full example
 * first" keeps the example before the explanation. And until there is
 * evidence from inside the course, a lesson the baseline gives extra help
 * (a weak quick check, or completely new) keeps it: the model may add help,
 * not take it away.
 */

export type PlanGuard = {
  /** the help level the learner set; "auto" leaves it to the plan */
  override: SupportOverride;
  /** no answers from inside the course yet, so the baseline's extra help is a floor */
  floor: boolean;
};

const MORE_HELP: Record<Support, number> = { light: 0, standard: 1, extra: 2 };

const LIMITS = { summary: 600, why: 240, title: 80, body: 520, scene: 520, brief: 520, note: 240, phrase: 80, reason: 240 };
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

function text(v: string | null | undefined, max: number): string {
  const s = (v ?? "").replace(URL, "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function validatePlan(
  plan: LearnerPlan,
  ctx: CourseContext,
  baseline: LearnerPlan,
  guard: PlanGuard = { override: "auto", floor: false },
): { plan: LearnerPlan; issues: string[] } {
  const issues: string[] = [];
  const kept = { order: 0, help: 0 };
  const override = guard.override === "auto" ? null : guard.override;

  const modules: PlanModuleT[] = ctx.modules.map((cm) => {
    const base = baseline.modules.find((m) => m.moduleId === cm.id)!;
    const got = plan.modules.find((m) => m.moduleId === cm.id);
    if (!got) {
      issues.push(`module ${cm.id} missing`);
      return base;
    }

    // topic order: a permutation of the outline's topics, opening scenario first; module check, then recall, last
    let order = got.topicOrder;
    const same = order.length === cm.stages.length && cm.stages.every((s) => order.includes(s)) && new Set(order).size === order.length;
    const hookOk = !cm.stages.includes("hook") || order[0] === "hook";
    const tail = (["gate", "review"] as const).filter((s) => cm.stages.includes(s));
    const tailOk = tail.every((s, i) => order[order.length - tail.length + i] === s);
    if (!same || !hookOk || !tailOk) {
      issues.push(`module ${cm.id}: topic order ${JSON.stringify(order)} rejected`);
      order = base.topicOrder;
    }
    // "see a full example first" is the learner's own choice
    const exampleFirst = (o: readonly string[]) => o.includes("worked") && o.includes("explainer") && o.indexOf("worked") < o.indexOf("explainer");
    if (exampleFirst(base.topicOrder) && !exampleFirst(order)) {
      kept.order++;
      order = base.topicOrder;
    }

    const lessons: PlanLessonT[] = cm.lessons.map((cl) => {
      const b = base.lessons.find((l) => l.lessonId === cl.id)!;
      const l = got.lessons.find((x) => x.lessonId === cl.id);
      if (!l) {
        issues.push(`lesson ${cl.id} missing`);
        return b;
      }
      // the learner's own level, or no less help than the baseline gives without in-course evidence
      const floor = guard.floor && b.support === "extra" && MORE_HELP[l.support] < MORE_HELP.extra;
      if (override && l.support !== override) kept.help++;
      else if (floor) kept.help++;
      const support = override ?? (floor ? b.support : l.support);
      return {
        lessonId: cl.id,
        support,
        why: support === l.support ? text(l.why, LIMITS.why) || b.why : b.why,
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
      support: override ?? (guard.floor && base.support === "extra" ? base.support : got.support),
      hookScene: got.hookScene ? text(got.hookScene, LIMITS.scene) : base.hookScene,
      lessons,
    };
  });
  if (kept.order) issues.push(`example-first order kept in ${kept.order} module${kept.order === 1 ? "" : "s"}`);
  if (kept.help) issues.push(`help kept at the learner's level on ${kept.help} lesson${kept.help === 1 ? "" : "s"}`);
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
