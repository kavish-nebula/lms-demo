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
 * Guided practice ("Build it") always comes after the explanation and the
 * worked example: learners build once they have seen the idea and watched it
 * run. Any order is repaired by moving it to just after the later of the two.
 */
export function practiceAfterExamples<S extends string>(order: readonly S[]): S[] {
  const g = order.indexOf("guided" as S);
  if (g < 0) return [...order];
  const after = Math.max(order.indexOf("worked" as S), order.indexOf("explainer" as S));
  if (after < g) return [...order];
  const rest = order.filter((s) => s !== "guided");
  rest.splice(rest.indexOf(order[after]!) + 1, 0, "guided" as S);
  return rest;
}

/** "See a full example first": the watch-it-run topic moves ahead of the explanation. */
export function orderStages(stages: StageId[], exampleFirst: boolean): StageId[] {
  if (!exampleFirst) return stages;
  const e = stages.indexOf("explainer");
  const w = stages.indexOf("worked");
  if (e < 0 || w < 0) return stages;
  const next = [...stages];
  next[e] = "worked";
  next[w] = "explainer";
  return next;
}
