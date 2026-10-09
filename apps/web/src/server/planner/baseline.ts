import "server-only";
import { orderStages } from "@/lib/topics";
import { adaptationOf, supportFor, type SetupAnswers, type Support, type SupportOverride } from "@/lib/setup";
import { ROLE_BRIEF, ROLE_HOOK, WORLD } from "@/lib/world";
import type { LearnerPlan, PlanModuleT } from "@/lib/learner-plan";
import type { Pace, StoredPrecheck } from "@/server/db/schema";
import type { StageId } from "@/lib/stages";
import type { CourseContext } from "./context";

/** Everything a plan is made from: the learner's setup for this course. */
export type PlannerInput = {
  name: string;
  answers: SetupAnswers;
  supportOverride: SupportOverride;
  pace: Pace | null;
  precheck: StoredPrecheck | null;
};

const roleKeyOf = (a: SetupAnswers) => (a.role && a.role in ROLE_BRIEF ? (a.role as keyof typeof ROLE_BRIEF) : "other");

/**
 * The rule-based plan: the course as it adapted before the backend, in the
 * shape the AI planner writes. It is stored the moment someone enrols, and
 * kept whenever the planner is unavailable, declines, or returns something
 * invalid.
 */
export function baselinePlan(input: PlannerInput, ctx: CourseContext): LearnerPlan {
  const a = adaptationOf(input.answers, { precheck: input.precheck, override: input.supportOverride });
  const exampleFirst = a.order[0] === "example";
  const roleKey = roleKeyOf(input.answers);
  // quick-check scores are keyed by lesson ("2.3") or, for a check that asks about a whole module, by its number ("2")
  const titleOf = new Map([...ctx.modules.map((m) => [String(m.index), m.title] as const), ...ctx.modules.flatMap((m) => m.lessons.map((l) => [l.id, l.title] as const))]);
  const scoreFor = (lesson: string) => pre?.lessons[lesson] ?? pre?.lessons[lesson.split(".")[0] ?? ""];
  const pre = input.precheck && !input.precheck.skipped ? input.precheck : null;

  const why = (lesson: string, s: Support) => {
    if (a.override) return `You set ${s === "light" ? "a lighter touch" : s === "extra" ? "extra help" : "standard help"} for every lesson.`;
    if (pre?.isNew) return "You said you're completely new, so every lesson starts with more help.";
    const score = scoreFor(lesson);
    if (score !== undefined) return `From your quick check: ${score} of 2 right on ${lesson in pre!.lessons ? "this lesson" : "this module"}.`;
    return a.supportSource === "experience" ? "Based on your experience with this topic." : "Standard help.";
  };

  const modules: PlanModuleT[] = ctx.modules.map((m) => {
    const lessons = m.lessons.map((l) => {
      const s = supportFor(a, l.id);
      const world = a.domain && WORLD[l.id] ? WORLD[l.id]!(a.domain) : "";
      return {
        lessonId: l.id,
        support: s,
        why: why(l.id, s),
        inYourWorld: { title: world ? `In ${a.domain!.label}` : "", body: world },
      };
    });
    const levels = lessons.map((l) => (l.support === "extra" ? 0 : l.support === "standard" ? 1 : 2));
    const avg = levels.reduce<number>((n, x) => n + x, 0) / (levels.length || 1);
    const support: Support = a.override ?? (avg < 0.67 ? "extra" : avg > 1.5 ? "light" : "standard");
    return {
      moduleId: m.id,
      emphasis: "standard",
      why: "Every module at the standard depth.",
      topicOrder: orderStages(m.stages as StageId[], exampleFirst),
      support,
      hookScene: m.hasHook || ROLE_HOOK[m.index] ? (ROLE_HOOK[m.index]?.[roleKey] ?? null) : null,
      lessons,
    };
  });

  const strengths = pre ? Object.entries(pre.lessons).filter(([, n]) => n >= 2).map(([l]) => titleOf.get(l) ?? l).slice(0, 3) : [];
  const gaps = pre ? Object.entries(pre.lessons).filter(([, n]) => n <= 0).map(([l]) => titleOf.get(l) ?? l).slice(0, 3) : [];
  const level = pre?.isNew || input.answers.experience === "never" ? "new" : input.answers.experience === "regularly" ? "confident" : "some";
  const minutes = input.pace?.sessionMinutes ?? 30;
  const perWeek = input.pace?.studyDays.length || 3;
  const who = [a.roleLabel, a.domain ? `in ${a.domain.label}` : null].filter(Boolean).join(" ");

  return {
    summary: `${who ? `Set up for ${who}. ` : ""}${exampleFirst ? "Examples come before explanations. " : ""}${
      a.supportSource === "precheck" ? "Help is set from your quick check." : a.supportSource === "override" ? "Help follows the level you chose." : "Help follows your experience answer."
    }`,
    learner: { level, strengths, gaps },
    pacing: { minutesPerSession: minutes, sessionsPerWeek: perWeek, note: `${perWeek} sessions of ${minutes} minutes a week.` },
    modules,
    capstoneBrief: ROLE_BRIEF[roleKey],
    changes: [],
  };
}
