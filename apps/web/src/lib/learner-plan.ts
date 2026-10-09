import * as z from "zod/v4";
import type { PrecheckResult, SetupAnswers, SupportOverride } from "@/lib/setup";

/**
 * A learner's course plan: written by the AI planner (GLM) from their
 * profile, setup and quick check, revised as their answers come in, and stored per version on
 * the server. Shared by the server (to validate the model's output) and the app
 * (to render it). Every field drives something on screen.
 *
 * The schema is sent to the model in the prompt and checked on the reply;
 * length and count limits are enforced after parsing
 * (src/server/planner/validate.ts).
 */

export const SupportLevel = z.enum(["light", "standard", "extra"]);

export const PlanLesson = z.object({
  lessonId: z.string().describe("A lesson id from the course outline, such as 2.1."),
  support: SupportLevel.describe("How much help this learner needs in this lesson."),
  why: z.string().describe("One short sentence to the learner explaining the help level."),
  inYourWorld: z
    .object({
      title: z.string().describe("A short heading, under 8 words."),
      body: z.string().describe("Two or three sentences applying the lesson's idea to the learner's own field and role."),
    })
    .describe("A concrete example of this lesson from the learner's world."),
});

export const PlanModule = z.object({
  moduleId: z.string().describe("A module id from the course outline, such as m1."),
  emphasis: z.enum(["skim", "standard", "deep"]).describe("How much attention this module deserves for this learner."),
  why: z.string().describe("One short sentence to the learner explaining the emphasis."),
  topicOrder: z.array(z.string()).describe("The module's authored topic ids, in the order this learner should take them. The recall topic, if present, stays last."),
  support: SupportLevel.describe("The module's overall help level."),
  hookScene: z
    .string()
    .nullable()
    .describe("For modules with an opening scenario: two or three sentences retelling it from the learner's role and field. Null otherwise."),
  lessons: z.array(PlanLesson).describe("Every lesson in the module, in outline order."),
});

export const PlanChange = z.object({
  target: z.string().describe("What changed, such as 'lesson 2.3 help' or 'm3 emphasis'."),
  from: z.string(),
  to: z.string(),
  reason: z.string().describe("One sentence to the learner, citing the evidence."),
});

export const LearnerPlanSchema = z.object({
  summary: z.string().describe("Two or three sentences to the learner: how the course is tuned for them and why."),
  learner: z.object({
    level: z.enum(["new", "some", "confident"]),
    strengths: z.array(z.string()).describe("Up to three short phrases."),
    gaps: z.array(z.string()).describe("Up to three short phrases."),
  }),
  pacing: z.object({
    minutesPerSession: z.number().int(),
    sessionsPerWeek: z.number().int(),
    note: z.string().describe("One sentence on how to pace the course."),
  }),
  modules: z.array(PlanModule).describe("Every module in the course, in outline order."),
  capstoneBrief: z.string().describe("Two or three sentences framing the capstone project for the learner's role and field."),
  changes: z.array(PlanChange).describe("When revising a plan: each change from the previous plan. Empty for a first plan."),
});

export type Support = z.infer<typeof SupportLevel>;
export type LearnerPlan = z.infer<typeof LearnerPlanSchema>;
export type PlanModuleT = z.infer<typeof PlanModule>;
export type PlanLessonT = z.infer<typeof PlanLesson>;
export type PlanChangeT = z.infer<typeof PlanChange>;

export type PlanSource = "ai" | "baseline";
export type PlanStatus = "generating" | "ready" | "failed";

/** One stored version of a plan, as the API returns it. */
export type PlanVersion = {
  version: number;
  status: PlanStatus;
  source: PlanSource;
  trigger: "enrol" | "setup" | "profile" | "signals";
  model: string | null;
  plan: LearnerPlan | null;
  changes: PlanChangeT[];
  error: string | null;
  createdAt: string;
};

/** An enrollment as the API returns it: setup, the plan the course follows now, and progress. */
export type EnrollmentView = {
  courseId: string;
  enrolledAt: string;
  answers: SetupAnswers;
  supportOverride: SupportOverride;
  pace: { sessionMinutes: number; studyDays: number[] } | null;
  precheck: PrecheckResult | null;
  /** the plan the course follows now */
  plan: PlanVersion | null;
  /** a newer plan being written */
  pending: { version: number; startedAt: string } | null;
  /** why the latest attempt failed, when it is newer than the current plan */
  lastError: string | null;
  progress: Record<string, string[]>;
  /** whether AI planning is configured on the server */
  ai: boolean;
};

/** The plan's topic order for a module, if it is a valid order of these topics. */
export function planTopicOrder<S extends string>(plan: LearnerPlan | null | undefined, moduleId: string, stages: readonly S[]): S[] | null {
  const order = planModule(plan, moduleId)?.topicOrder;
  if (!order || order.length !== stages.length || !stages.every((s) => order.includes(s))) return null;
  return order as S[];
}

export const planModule = (plan: LearnerPlan | null | undefined, moduleId: string) => plan?.modules.find((m) => m.moduleId === moduleId) ?? null;

export const planLesson = (plan: LearnerPlan | null | undefined, lessonId: string) => {
  for (const m of plan?.modules ?? []) {
    const l = m.lessons.find((x) => x.lessonId === lessonId);
    if (l) return l;
  }
  return null;
};
