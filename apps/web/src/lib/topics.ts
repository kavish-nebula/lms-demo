import type { CourseModule, Topic } from "@/data/types";
import type { StageId } from "@/lib/stages";

type HasTopics = Pick<CourseModule, "topics" | "stages">;

/** A module's topics in delivery order, limited to the stages it includes. */
export function moduleTopics(m: HasTopics): Topic[] {
  return m.stages.map((s) => m.topics.find((t) => t.stage === s)).filter((t): t is Topic => !!t);
}

/** The topic for one stage of a module, with its position ("2 of 5"). */
export function topicOf(m: HasTopics, stage: StageId): { topic: Topic; n: number; total: number } | null {
  const list = moduleTopics(m);
  const i = list.findIndex((t) => t.stage === stage);
  return i < 0 ? null : { topic: list[i]!, n: i + 1, total: list.length };
}

/**
 * Teach the idea before its worked example, then let the learner practise.
 * Repair saved plans too, without changing stage IDs or completion keys.
 */
export function practiceAfterExamples<S extends string>(order: readonly S[]): S[] {
  const normalized = [...order];
  const e = normalized.indexOf("explainer" as S);
  const w = normalized.indexOf("worked" as S);
  if (e >= 0 && w >= 0 && w < e) {
    normalized.splice(w, 1);
    normalized.splice(normalized.indexOf("explainer" as S) + 1, 0, "worked" as S);
  }
  order = normalized;
  const g = order.indexOf("guided" as S);
  if (g < 0) return [...order];
  const after = Math.max(order.indexOf("worked" as S), order.indexOf("explainer" as S));
  if (after < g) return [...order];
  const rest = order.filter((s) => s !== "guided");
  rest.splice(rest.indexOf(order[after]!) + 1, 0, "guided" as S);
  return rest;
}

/** The teaching sequence also applies when no personalized plan is ready. */
export function orderStages(stages: StageId[], exampleFirst = false): StageId[] {
  // Retain the caller signature for existing preferences; sequence is now fixed.
  void exampleFirst;
  return practiceAfterExamples(stages);
}
