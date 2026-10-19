import * as z from "zod/v4";

/** Generated content is data, never executable HTML, JavaScript, or arbitrary URLs. */
export const PreviewSlide = z.object({
  title: z.string().min(1).max(100),
  caption: z.string().min(1).max(240),
  narration: z.string().min(20).max(850),
  imagePrompt: z.string().min(20).max(1000).optional(),
  imageAlt: z.string().min(1).max(240).optional(),
  animation: z.enum(["reveal", "sequence", "compare"]),
  steps: z.array(z.string().min(1).max(100)).min(2).max(4),
});
// HTML slides use structured text/diagrams, never model-written executable markup.
export const HtmlSlide = PreviewSlide.omit({ imagePrompt: true, imageAlt: true });
export const SimulationWorkspace = z.object({
  name: z.string().min(1).max(60),
  incomingLabel: z.string().min(1).max(40),
  request: z.string().min(10).max(240),
  agentLabel: z.string().min(1).max(40),
  outputLabel: z.string().min(1).max(40),
  state: z.string().min(1).max(180),
  instructionPlaceholder: z.string().min(1).max(120),
  runLabel: z.string().min(1).max(40),
});
export const ActivityTask = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,40}$/),
  title: z.string().min(1).max(100),
  scene: z.string().min(20).max(700),
  instruction: z.string().min(10).max(300),
  kind: z.enum(["compose", "arrange", "select", "simulation"]),
  items: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9-]{1,30}$/), text: z.string().min(1).max(200) })).max(5),
  artifact: z.string().min(1).max(1000),
  workspace: SimulationWorkspace.optional(),
  skills: z.array(z.string().min(1).max(20)).min(1).max(5),
  imagePrompt: z.string().min(20).max(1000),
});
/** Tighter presentation bounds for newly generated tasks; saved tasks remain readable. */
export const CompactActivityTask = ActivityTask.extend({
  title: z.string().min(1).max(70), scene: z.string().min(20).max(180), instruction: z.string().min(10).max(160),
  artifact: z.string().min(1).max(500),
  items: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9-]{1,30}$/), text: z.string().min(1).max(90) })).max(5),
});
export const SimulationTask = CompactActivityTask.extend({
  kind: z.literal("simulation"), workspace: SimulationWorkspace,
  items: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9-]{1,30}$/), text: z.string().min(1).max(90) })).min(2).max(5),
});
export const ActivityEvent = z.object({
  type: z.enum(["add", "remove", "move", "edit", "run"]),
  itemId: z.string().max(30).optional(),
  position: z.number().int().min(0).max(4).optional(),
});
export const Evidence = z.object({
  skill: z.string().min(1).max(20),
  observation: z.string().min(1).max(400),
  level: z.enum(["unknown", "emerging", "developing", "demonstrated"]),
  confidence: z.enum(["low", "medium", "high"]),
  support: z.enum(["light", "standard", "extra"]),
  reason: z.string().min(1).max(300),
});
export const ActivityResponse = z.object({
  taskId: z.string().max(40),
  submissionId: z.string().regex(/^[a-zA-Z0-9-]{8,60}$/),
  text: z.string().max(2400),
  selected: z.array(z.string().max(30)).max(5),
  confidence: z.enum(["not-stated", "unsure", "partly", "confident"]),
  helpUsed: z.boolean().nullable(),
  skipped: z.boolean(),
  events: z.array(ActivityEvent).max(80).optional(),
});
export type AdaptiveTask = z.infer<typeof ActivityTask>;
export type AdaptiveSlide = z.infer<typeof PreviewSlide>;
export type SkillEvidence = z.infer<typeof Evidence>;
export type ActivitySubmission = z.infer<typeof ActivityResponse>;
export type AdaptiveSession = {
  id: string;
  title: string;
  rationale: string;
  slides: AdaptiveSlide[];
  task: AdaptiveTask | null;
  configuration?: { text: string; selected: string[] };
  rounds: number;
  feedback: string;
  done: boolean;
  evidence: SkillEvidence[];
  summary: string;
  strengths: string[];
  focus: string[];
};
