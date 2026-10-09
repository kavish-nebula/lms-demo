import {
  Lightbulb,
  BookOpen,
  ListChecks,
  PencilRuler,
  FlaskConical,
  Hammer,
  ShieldCheck,
  MessageSquareQuote,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

/** The nine evidence-based steps of a module, in delivery order (ch13 Op 4). */
export const STAGE_ORDER = [
  "hook",
  "explainer",
  "worked",
  "guided",
  "lab",
  "project",
  "gate",
  "reflection",
  "review",
] as const;

export type StageId = (typeof STAGE_ORDER)[number];

/** Stages the V1 player ships (ARCHITECTURE.pdf section 6). */
export const V1_STAGES: ReadonlySet<StageId> = new Set([
  "hook",
  "explainer",
  "worked",
  "guided",
  "lab",
  "gate",
  "reflection",
  "review",
]);

export type StageMeta = {
  index: number;
  icon: LucideIcon;
  bloom: "understand" | "apply" | "analyze" | "create" | "evaluate" | "remember";
  /** Tailwind classes for the soft chip look: fill, ink, border. */
  chip: string;
  /** Tailwind class for a solid dot / bar. */
  solid: string;
  /** Tailwind class for ink only. */
  ink: string;
};

/*
 * Class strings are written out in full so Tailwind can see them.
 * Colours come from the --stage-* tokens via @theme in globals.css.
 */
export const STAGE_META: Record<StageId, StageMeta> = {
  hook: {
    index: 1,
    icon: Lightbulb,
    bloom: "understand",
    chip: "bg-stage-hook-soft text-stage-hook border-stage-hook-line",
    solid: "bg-stage-hook",
    ink: "text-stage-hook",
  },
  explainer: {
    index: 2,
    icon: BookOpen,
    bloom: "understand",
    chip: "bg-stage-explainer-soft text-stage-explainer border-stage-explainer-line",
    solid: "bg-stage-explainer",
    ink: "text-stage-explainer",
  },
  worked: {
    index: 3,
    icon: ListChecks,
    bloom: "apply",
    chip: "bg-stage-worked-soft text-stage-worked border-stage-worked-line",
    solid: "bg-stage-worked",
    ink: "text-stage-worked",
  },
  guided: {
    index: 4,
    icon: PencilRuler,
    bloom: "apply",
    chip: "bg-stage-guided-soft text-stage-guided border-stage-guided-line",
    solid: "bg-stage-guided",
    ink: "text-stage-guided",
  },
  lab: {
    index: 5,
    icon: FlaskConical,
    bloom: "analyze",
    chip: "bg-stage-lab-soft text-stage-lab border-stage-lab-line",
    solid: "bg-stage-lab",
    ink: "text-stage-lab",
  },
  project: {
    index: 6,
    icon: Hammer,
    bloom: "create",
    chip: "bg-stage-project-soft text-stage-project border-stage-project-line",
    solid: "bg-stage-project",
    ink: "text-stage-project",
  },
  gate: {
    index: 7,
    icon: ShieldCheck,
    bloom: "analyze",
    chip: "bg-stage-gate-soft text-stage-gate border-stage-gate-line",
    solid: "bg-stage-gate",
    ink: "text-stage-gate",
  },
  reflection: {
    index: 8,
    icon: MessageSquareQuote,
    bloom: "evaluate",
    chip: "bg-stage-reflection-soft text-stage-reflection border-stage-reflection-line",
    solid: "bg-stage-reflection",
    ink: "text-stage-reflection",
  },
  review: {
    index: 9,
    icon: RotateCcw,
    bloom: "apply",
    chip: "bg-stage-review-soft text-stage-review border-stage-review-line",
    solid: "bg-stage-review",
    ink: "text-stage-review",
  },
};

export type StageState = "done" | "current" | "todo" | "locked" | "absent" | "not_in_v1";

/**
 * Stages a module may contain. Each module closes with its own check (gate)
 * before the spaced review; the project and the reflection happen once, in the
 * course finale, which also holds the final check.
 */
export const MODULE_STAGES: readonly StageId[] = ["hook", "explainer", "worked", "guided", "lab", "gate", "review"];

export function isModuleStage(value: string): value is StageId {
  return (MODULE_STAGES as readonly string[]).includes(value);
}

/** Finale steps, in order; each borrows a stage only for its icon and colour. */
export const FINALE_ORDER = ["capstone", "final-check", "wrap-up"] as const;

export function isFinaleStepId(value: string): value is (typeof FINALE_ORDER)[number] {
  return (FINALE_ORDER as readonly string[]).includes(value);
}

export function isStageId(value: string): value is StageId {
  return (STAGE_ORDER as readonly string[]).includes(value);
}

/** "m01.explain.s2" -> "explainer". Step IDs use short stage names in segment 2. */
export function stageFromStepId(stepId: string): StageId | undefined {
  const part = stepId.split(".")[1] ?? "";
  const alias: Record<string, StageId> = { explain: "explainer", reflect: "reflection" };
  const s = alias[part] ?? part;
  return isStageId(s) ? s : undefined;
}
