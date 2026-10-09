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

/* ---------------------------------------------------------------- hook film */

/**
 * One illustrated scene of the hook's opening film, played at the learner's
 * pace. `say` is spoken and shown as the caption when the scene starts. Most
 * scenes then wait for the learner to do something (`act` names it: tap a
 * button, or hold one down to make time pass); `then` is spoken and shown
 * once they have. Each `say` and `then` has its own narration clip.
 */
type ShotBase = { label: string; say: string };
/** a scene the learner sets going with one tap (or holds down, for the hold types) */
type Acted = { act: string; then: string };
export type ChatLine = { from: "customer" | "agent"; text: string };
export type TerminalLine = { time: string; text: string; tone: "ok" | "warn" | "err" | "dim" };
export type HookMessage = { who: string; av: string; at: string; text: string };

export type FilmShot =
  /** the shop's website and its chatbot: the learner sends the first three `asks` and gets `reply` each time, then a counter runs */
  | (ShotBase & { type: "site-chat"; then: string; url: string; product: string; asks: string[]; reply: string; count: number; countLabel: string })
  /** a helpdesk queue, empty until the learner opens it, then flooding */
  | (ShotBase & Acted & { type: "tickets"; count: number; subjects: string[]; tag: string })
  /** a phone buzzing with the team's messages (`notes`, kept short) */
  | (ShotBase & { type: "phone"; time: string; notes: HookMessage[] })
  /** an email arrives; when the learner asks, the agent types its reply, with `highlight` marked */
  | (ShotBase & Acted & { type: "email"; from: string; address: string; subject: string; body: string; meta: string; replyBy: string; reply: string; highlight: string })
  /** the source of truth beside the agent's reply: the learner taps the part of the reply that is wrong, then a stamp */
  | (ShotBase & {
      type: "doc-vs-reply";
      then: string;
      doc: { title: string; heading: string; text: string; highlight: string };
      reply: { title: string; text: string; highlight: string };
      stamp: string;
    })
  /** the agent's "delivered" claim; when the learner tracks the parcel, the truck stops at `stop` (0 to 1) */
  | (ShotBase & Acted & { type: "parcel-map"; from: string; to: string; hub: string; stop: number; claim: string; truth: string })
  /** a log or terminal printing; `flood` repeats one line faster and faster */
  | (ShotBase & { type: "terminal"; title: string; lines: TerminalLine[]; badge?: string; flood?: { text: string; count: number } })
  /** a long chat the learner keeps going by holding: message `key` leaves the last `keep` messages, then message `ask` lands */
  | (ShotBase & Acted & { type: "long-chat"; customer: string; agent: string; messages: ChatLine[]; key: number; ask: number; keep: number })
  /** a test run the learner starts, filling a grid pass by pass */
  | (ShotBase & Acted & { type: "test-grid"; total: number; passed: number; countdown: string })
  /** a clock the learner fast-forwards by holding, while a bill and a step count climb */
  | (ShotBase & Acted & { type: "timelapse"; startDay: string; startTime: string; hours: number; amount: number; steps: number; error: string })
  /** the hook's `stat`, number by number */
  | (ShotBase & { type: "numbers" });

export type HookFilm = { shots: FilmShot[] };

export type HookBlock = BlockBase & {
  stage: "hook";
  /** the opening as a film of illustrated scenes; without it the opening is shown as text */
  film?: HookFilm;
  kicker: string;
  title: string;
  narration: string;
  why: string;
  stat: string;
  messages: HookMessage[];
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
  /** `tags` labels each card's rows (e.g. ["Input", "Tool", "Output"]); without it the rows are numbered */
  | (SlideBase & { kind: "cards"; tags?: string[]; cards: (Cued & { icon: string; title: string; flow: string[] })[] })
  | (SlideBase & { kind: "table"; columns: string[]; rows: (Cued & { cells: string[]; tone?: string })[]; note: Cued & { text: string } })
  | (SlideBase & { kind: "code"; lead: string; rows: (Cued & { code: string; out: string })[]; aside: Aside })
  | (SlideBase & { kind: "recap"; points: (Cued & { text: string })[] })
  /** one thing in the middle, its parts around it (e.g. an agent and its LLM, tools, memory, planning) */
  | (SlideBase & { kind: "hub"; center: { icon: string; label: string; sub: string }; spokes: (Cued & { icon: string; label: string; sub: string })[]; note?: Cued & { text: string } })
  /** steps that repeat in a loop (e.g. think, act, observe) */
  | (SlideBase & { kind: "cycle"; center: { label: string; sub: string }; steps: (Cued & { icon: string; label: string; sub: string })[]; note?: Cued & { text: string } })
  /** a conversation or agent trace, message by message */
  | (SlideBase & { kind: "chat"; messages: (Cued & { role: "user" | "agent" | "tool" | "system"; label?: string; text: string })[]; aside?: Aside });

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

export type GuideStep = {
  id: string;
  title: string;
  /** what this step is for, one or two sentences */
  body: string;
  /** what to do, in order; **bold** names a button or field, `code` is something to type */
  actions: string[];
  /** values to copy into the tool the learner is using */
  values?: { label: string; value: string }[];
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
  before: { items: string[]; downloads: { label: string; href: string; note: string }[] };
  steps: GuideStep[];
  finish: { title: string; body: string; checklist: string[] };
};

/* ---------------------------------------------------------------- scenarios */

/**
 * A realistic situation the learner has not seen, and a decision to make in it:
 * the module's ideas applied somewhere new (transfer). `context` is evidence
 * shown as-is, such as a log, a chat or a config.
 */
export type Scenario = {
  id: string;
  lesson: string;
  title: string;
  situation: string;
  context?: { label: string; lines: string[] };
  question: McItem;
  /** what an expert would do and why, shown once the learner has answered */
  debrief: string;
};

/** Stage 5 (stored as "lab"): scenarios that apply the module to new situations. */
export type ScenarioBlock = BlockBase & { stage: "lab"; title: string; intro: string; scenarios: Scenario[] };

export type PlaceholderBlock = BlockBase & { stage: "project" };

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
  | ScenarioBlock
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
  /** course design estimate of manual work a week the module takes over, for courses where that applies */
  hours_saved?: number;
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

export type CapstoneBlock = {
  step_id: string;
  duration_min: number;
  kicker: string;
  title: string;
  /** the finished project's name, listed under "What you built" */
  project_name: string;
  scene: string;
  requirements: { id: string; text: string }[];
  edge_cases: string[];
  closing: string;
  /** shown once the project is done; may be empty */
  reactions: { who: string; av: string; text: string }[];
  /** course design estimate of manual work a week the project takes over, for courses where that applies */
  hours_saved?: number;
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
