import type { ConceptVideo, ModuleContent, StageBlock, Topic } from "@/data/types";
import type { StageId } from "@/lib/stages";

/**
 * A module as the learner meets it: a few headed sections, from the problem
 * that opens it to the check that closes it, each holding numbered parts.
 * The concept topic is split into one part per lesson video, so no part is
 * longer than a few minutes and every heading says what happens under it.
 */
export type SectionId = "problem" | "learn" | "see" | "build" | "apply" | "check" | "keep";

/** What the learner does or comes away with in a part: an i18n key in "outline" and its values. */
export type Deliverable = { key: "hook" | "video" | "worked" | "guided" | "lab" | "gate" | "review"; values: Record<string, number> };

export type ModulePart = {
  /** stable id: the stage, or "video:{id}" for a lesson video */
  key: string;
  stage: StageId;
  /** for a lesson video */
  video?: { id: string; lesson: string };
  /** 1-based position in the module */
  n: number;
  title: string;
  minutes?: number;
  deliverable: Deliverable;
  /** path under the module: "hook", "explainer?v=m1-2" */
  path: string;
};

export type ModuleSection = { id: SectionId; parts: ModulePart[]; minutes: number };

const SECTION_OF: Record<StageId, SectionId> = {
  hook: "problem",
  explainer: "learn",
  worked: "see",
  guided: "build",
  lab: "apply",
  project: "build",
  gate: "check",
  reflection: "keep",
  review: "keep",
};

/** About how long a lesson video takes: narration at 150 words a minute, plus its quick checks. */
export function videoMinutes(v: ConceptVideo) {
  const words = v.slides.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
  return Math.max(1, Math.round(words / 150 + (v.midQuiz.length + v.endQuiz.length) * 0.5));
}

function deliverableOf(block: StageBlock): Deliverable {
  switch (block.stage) {
    case "hook":
      return { key: "hook", values: {} };
    case "worked":
      return { key: "worked", values: { count: block.examples.length } };
    case "guided":
      return { key: "guided", values: { count: block.steps.length } };
    case "lab":
      return { key: "lab", values: { count: block.scenarios.length } };
    case "gate":
      return { key: "gate", values: { count: block.items.length, percent: Math.round(block.pass_threshold * 100) } };
    case "review":
      return { key: "review", values: { count: block.variants.length } };
    default:
      return { key: "video", values: { checks: 0 } };
  }
}

/**
 * The module's sections and parts, in the learner's topic order. Only topics
 * the module has content for appear; a topic missing from `topics` takes the
 * module's title.
 */
export function moduleOutline(module: ModuleContent, topics: Topic[], order: StageId[]): ModuleSection[] {
  const sections: ModuleSection[] = [];
  let n = 0;
  const add = (part: Omit<ModulePart, "n">) => {
    const id = SECTION_OF[part.stage];
    let section = sections.at(-1);
    if (section?.id !== id) {
      section = { id, parts: [], minutes: 0 };
      sections.push(section);
    }
    section.parts.push({ ...part, n: ++n });
    section.minutes += part.minutes ?? 0;
  };

  for (const stage of order) {
    if (!module.stages_included.includes(stage)) continue;
    const block = module.blocks.find((b) => b.stage === stage);
    if (!block) continue;
    const title = topics.find((x) => x.stage === stage)?.title ?? module.title;
    if (block.stage === "explainer" && block.videos?.length) {
      for (const v of block.videos)
        add({
          key: `video:${v.id}`,
          stage,
          video: { id: v.id, lesson: v.lesson },
          title: `${v.lesson} ${v.title}`,
          minutes: videoMinutes(v),
          deliverable: { key: "video", values: { checks: v.midQuiz.length + v.endQuiz.length } },
          path: `explainer?v=${v.id}`,
        });
      continue;
    }
    add({ key: stage, stage, title, minutes: block.duration_min, deliverable: deliverableOf(block), path: stage });
  }
  return sections;
}

/** Every part, in order. */
export function flatParts(sections: ModuleSection[]) {
  return sections.flatMap((s) => s.parts);
}

/** The part on screen: the stage, and for the concept topic the video (its first one when none is named). */
export function currentPart(parts: ModulePart[], stage: StageId, video?: string) {
  return parts.find((p) => p.stage === stage && (!p.video || !video || p.video.id === video)) ?? parts.find((p) => p.stage === stage);
}
