/**
 * UI-facing types for the fixtures. They mirror the content schema
 * (ARCHITECTURE.pdf section 6) and data model (section 5) closely enough
 * that swapping fixtures for API calls is a change to src/data only.
 */
import type { StageId } from "@/lib/stages";

export type Bloom = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
export type Load = "low" | "medium" | "high";

export type Option = { id: string; text: string; correct?: boolean; rationale?: string };

/* ---------------------------------------------------------------- pipelines */

export type NodeKind = "trigger" | "data" | "logic" | "action" | "wait" | "http" | string;
export type RunState = "idle" | "running" | "ok" | "error" | string;

export type PipelineNode = { id: string; kind: NodeKind; label: string; sub: string; x: number; y: number; state: RunState; note?: string };
export type PipelineEdge = { id: string; source: string; target: string; state: RunState };
export type Pipeline = { nodes: PipelineNode[]; edges: PipelineEdge[] };
/** Pipeline state at one caption of a narrated run. */
export type Frame = Pipeline & { caption: string };
export type TimedFrame = Frame & { t: number };

/* ---------------------------------------------------------------- items */

export type McItem = { step_id: string; kind: "mc"; stem: string; options: Option[]; hints: string[] };


/* ---------------------------------------------------------------- blocks */

type BlockBase = {
  step_id: string;
  duration_min: number;
  bloom: Bloom;
  load: Load;
  objective_ids: string[];
  status?: "not_in_v1";
};

export type HookBlock = BlockBase & {
  stage: "hook";
  kicker: string;
  title: string;
  narration: string;
  why: string;
  stat: string;
  messages: { who: string; av: string; at: string; text: string }[];
  prompt: string;
  hunches: { id: string; label: string }[];
  correct: string;
  pipeline: Pipeline;
  reveal: { narration: string; frames: Frame[]; timeline: TimedFrame[] };
  wrap_correct: string;
  wrap_wrong: string;
  wrap_point: string;
};

export type Beat = { id: string; narration: string; why: Record<string, string>; check: McItem | null };

export type Segment = {
  step_id: string;
  lesson: string;
  title: string;
  duration_sec: number;
  beats: Beat[];
  notes: string[];
  alt: { title: string; text: string; prompt: string } | null;
  pipeline: Pipeline | null;
};

/* ---------------------------------------------------------------- concept videos */

/** Something on a slide that appears when the narration reaches sentence `cue`. */
type Cued = { cue: number };
type SlideBase = { title: string; narration: string; sentences: string[] };
type Aside = Cued & { icon: string; label: string; text: string };
type CompareSide = Cued & { label: string; tone: "bad" | "ok" | "info"; points: string[] };

export type VideoSlide =
  | (SlideBase & { kind: "title"; icon: string; kicker: string; sub: string })
  | (SlideBase & { kind: "compare"; left: CompareSide; right: CompareSide })
  | (SlideBase & { kind: "define"; term: string; definition: string; parts: (Cued & { text: string })[]; analogy: { label: string; text: string } })
  | (SlideBase & { kind: "flow"; run?: boolean; nodes: (Cued & { kind: string; icon: string; label: string; sub: string })[]; note: Cued & { text: string } })
  | (SlideBase & { kind: "bullets"; lead: string; bullets: (Cued & { icon: string; text: string })[]; aside: Aside })
  | (SlideBase & { kind: "example"; scenario: string; steps: (Cued & { time: string; icon: string; text: string })[]; result: Cued & { text: string } })
  | (SlideBase & { kind: "cards"; cards: (Cued & { icon: string; title: string; flow: string[] })[] })
  | (SlideBase & { kind: "table"; columns: string[]; rows: (Cued & { cells: string[]; tone?: string })[]; note: Cued & { text: string } })
  | (SlideBase & { kind: "code"; lead: string; rows: (Cued & { code: string; out: string })[]; aside: Aside })
  | (SlideBase & { kind: "recap"; points: (Cued & { text: string })[] });

/** A short check inside a video: a wrong answer gets a hint, not the answer. */
export type VideoQuiz = { q: string; options: string[]; correct: number; explain: string; hint: string };

/** A narrated slide video for one lesson (audio: /audio/video-{id}-s{n}.mp3). */
export type ConceptVideo = {
  id: string;
  module: string;
  lesson: string;
  title: string;
  notes: string[];
  quizAfter: number | null;
  slides: VideoSlide[];
  midQuiz: VideoQuiz[];
  endQuiz: VideoQuiz[];
};

export type ExplainerBlock = BlockBase & {
  stage: "explainer";
  concepts: string[];
  segments: Segment[];
  /** when present, the concept topic is taught by these narrated videos */
  videos?: ConceptVideo[];
};

export type WorkedExample = {
  step_id: string;
  lesson: string;
  title: string;
  intro: string;
  narration: string;
  predict: McItem | null;
  frames: Frame[];
};

export type WorkedBlock = BlockBase & { stage: "worked"; examples: WorkedExample[] };

/* ---------------------------------------------------------------- guided practice */

/** Node icons on the recreated n8n screens. */
export type ScreenIcon = "sheets" | "schedule" | "webhook" | "set" | "filter" | "if" | "dedupe" | "hubspot" | "slack" | "http" | "wait" | "noop" | "manual" | "form";

export type ScreenNode = { id: string; icon: ScreenIcon; name: string; x: number; y: number; trigger?: boolean; status?: "ok" | "error" };
export type ScreenEdge = { from: string; to: string; label?: string; branch?: string };
/** Data shown in an input or output pane: column names, then rows. */
export type ScreenData = { items: number; columns: string[]; rows: string[][] };

export type ScreenField =
  | { id: string; kind: "select" | "text"; label: string; value: string }
  | { id: string; kind: "expr"; label: string; value: string; result?: string }
  | { id: string; kind: "toggle"; label: string; on: boolean }
  | { id: string; kind: "assign"; label: string; rows: { name: string; type: string; value: string; result?: string }[] }
  | { id: string; kind: "condition"; label: string; rows: { left: string; op: string; right?: string }[] }
  | { id: string; kind: "button"; label: string };

/**
 * A recreated n8n screen (n8n 2.x, dark theme). `marks` puts a numbered
 * badge on an element: the number matches the step's action list.
 */
export type N8nScreen = { marks?: Record<string, number>; caption: string } & (
  | { view: "canvas"; name: string; nodes: ScreenNode[]; edges: ScreenEdge[]; published?: boolean; toast?: string }
  | { view: "panel"; name: string; title: string; search: string; items: { id: string; icon: ScreenIcon; name: string; desc: string; group?: string }[]; nodes: ScreenNode[]; edges: ScreenEdge[] }
  | { view: "ndv"; icon: ScreenIcon; node: string; tab?: "parameters" | "settings"; action: string; fields: ScreenField[]; input?: ScreenData; output?: ScreenData; notice?: string }
  | { view: "credential"; icon: ScreenIcon; title: string; fields: { id: string; label: string; value: string }[]; button: string }
  | { view: "sheet"; title: string; tabs: string[]; tab: string; columns: string[]; rows: string[][] }
  | { view: "slack"; channel: string; messages: { who: string; time: string; text: string }[] }
);

export type GuideStep = {
  id: string;
  title: string;
  /** what this step is for, one or two sentences */
  body: string;
  /** what to do, in order; **bold** names a button or field, `code` is something to type */
  actions: string[];
  /** values to copy into n8n */
  values?: { label: string; value: string }[];
  screen: N8nScreen;
  /** "You should see" */
  check: string;
  /** "Stuck?" */
  tip?: string;
};

export type GuidedBlock = BlockBase & {
  stage: "guided";
  title: string;
  situation: string;
  intro: string;
  /** the finished workflow */
  goal: N8nScreen;
  before: { items: string[]; downloads: { label: string; href: string; note: string }[] };
  steps: GuideStep[];
  finish: { title: string; body: string; checklist: string[] };
};

export type PlaceholderBlock = BlockBase & { stage: "lab" | "project" };

export type GateItem = {
  id: string;
  objective_id: string;
  kind: "mc" | "multi" | "fill";
  stem: string;
  options?: { id: string; text: string }[];
  /** lessons a final-check question draws on, e.g. ["1.1", "2.2"] */
  lessons?: string[];
  placeholder?: string;
  transfer?: boolean;
  interleaved_from?: string;
};

export type GateBlock = BlockBase & {
  stage: "gate";
  pass_threshold: number;
  min_correct_per_objective: number;
  retry_policy: { wait_hours: number; new_variants: boolean };
  item_count: number;
  objectives_tested: string[];
  items: GateItem[];
  remediation: Record<string, { label: string; step_id: string }>;
};

export type ReflectionBlock = BlockBase & {
  stage: "reflection";
  min_sentences: number;
  prompts: { id: string; kind: "worked" | "failed" | "transfers"; text: string }[];
};

export type ReviewVariant = { id: string; title: string; after_days: number; stem: string; options: Option[] };

export type ReviewBlock = BlockBase & {
  stage: "review";
  schedule: { review: number; after_days: number }[];
  variants: ReviewVariant[];
};

export type StageBlock =
  | HookBlock
  | ExplainerBlock
  | WorkedBlock
  | GuidedBlock
  | PlaceholderBlock
  | GateBlock
  | ReflectionBlock
  | ReviewBlock;

export type Objective = { id: string; text: string; lesson: string };

export type ModuleContent = {
  course_id: string;
  course_title: string;
  module_id: string;
  version: string;
  locale: string;
  title: string;
  summary: string;
  estimated_minutes: number;
  stages_included: StageId[];
  metadata: { objectives: Objective[] };
  blocks: StageBlock[];
};

/* ---------------------------------------------------------------- course */

export type ModuleState = "done" | "in_progress" | "available" | "locked";

/** One step of a module, shown to learners by its own title (never the method name). */
export type Topic = { stage: StageId; title: string; summary: string };

export type FinaleStepId = "capstone" | "final-check" | "wrap-up";

/** A course-level step after all modules. `stage` only picks the icon and colour. */
export type FinaleStep = {
  id: FinaleStepId;
  stage: StageId;
  kicker: string;
  title: string;
  summary: string;
  minutes: number;
  outcomes: string[];
};

export type CourseFinale = { title: string; summary: string; steps: FinaleStep[] };

export type Lesson = { id: string; title: string; notes: string[] };

export type CourseModule = {
  module_id: string;
  title: string;
  minutes: number;
  stages: StageId[];
  state: ModuleState;
  current_stage?: StageId;
  lite: boolean;
  pain: string;
  hours_saved: number;
  lead_in: string | null;
  lessons: Lesson[];
  topics: Topic[];
  /** "What you'll learn" when the module row is opened */
  outcomes: string[];
  skills: string[];
  /** topics that have lesson content (filled in by the data layer) */
  authored?: StageId[];
};

export type Course = {
  course_id: string;
  slug: string;
  title: string;
  tagline: string;
  goal: string;
  domain: string;
  provider: string;
  level: string;
  estimated_hours: number;
  locales: string[];
  languages: { code: string; name: string; native: string }[];
  version: string;
  skills: string[];
  learn: string[];
  tools: string[];
  modules: CourseModule[];
  finale: CourseFinale;
};

/* ---------------------------------------------------------------- pre-check */

/** Ungraded check of prior knowledge before Module 1; sets support per lesson. */
export type PrecheckItem = { id: string; lesson: string; module: string; stem: string; options: { id: string; text: string }[] };

export type PrecheckContent = { course_id: string; version: string; items: PrecheckItem[] };

/* ---------------------------------------------------------------- finale content */

/** What the capstone sandbox provides: the sheets, channels and credentials, and sample rows to run. */
export type CapstoneSandbox = {
  document: string;
  sheets: { name: string; columns: string[]; note: string }[];
  channels: { name: string; note: string }[];
  credentials: { name: string; app: string }[];
  /** "Execute workflow" runs these, one execution per row; a fault makes HubSpot fail on that row */
  sample: { row: Record<string, string>; fault?: { crm?: "rateLimitOnce" | "down" }; note?: string }[];
};

export type CapstoneBlock = {
  step_id: string;
  duration_min: number;
  kicker: string;
  title: string;
  workflow_name: string;
  scene: string;
  /** ids match the grader's requirement ids */
  requirements: { id: string; text: string }[];
  edge_cases: string[];
  /** the fields HubSpot expects */
  data_contract: { field: string; rule: string; example: string }[];
  closing: string;
  sandbox: CapstoneSandbox;
  real_n8n: { intro: string; steps: string[] };
  reactions: { who: string; av: string; text: string }[];
  hours_saved: number;
};

export type WrapUpBlock = {
  step_id: string;
  duration_min: number;
  min_sentences: number;
  prompts: ReflectionBlock["prompts"];
};

export type FinaleContent = {
  course_id: string;
  version: string;
  objectives: Objective[];
  capstone: CapstoneBlock;
  final: GateBlock;
  wrap_up: WrapUpBlock;
};

/* ---------------------------------------------------------------- learner */

export type DueReview = {
  review_item_id: string;
  course_title: string;
  module_title: string;
  due: string;
  questions: number;
  concept_tags: string[];
};

export type Assignment = {
  id: string;
  title: string;
  course_title: string;
  course_id?: string;
  due: string;
  assigned_by: string;
};

export type Credential = {
  credential_id: string;
  kind: "module" | "course" | "skill";
  title: string;
  course_title: string;
  issued_at: string;
  verify_url: string;
};

export type HistoryEntry = {
  at: string;
  kind: "stage_completed" | "gate_passed" | "gate_retry" | "review_done" | "reflection";
  course_title: string;
  module_title: string;
  stage: StageId;
  detail: string;
};

export type Learner = {
  user: {
    user_id: string;
    name: string;
    email: string;
    locale: string;
    roles: { role: string; scope_type: string; scope_id: string }[];
    settings: Record<string, unknown>;
  };
  due_reviews: DueReview[];
  assignments: Assignment[];
  daily_progress: { day: string; minutes: number }[];
  credentials: Credential[];
  history: HistoryEntry[];
};
