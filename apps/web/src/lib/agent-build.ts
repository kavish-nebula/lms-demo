/**
 * "Your agent, built along": the learner's own AI agent, named after the task
 * they chose in About you, gets built piece by piece as they go. Setting up
 * gives it a job, starting skills (from the Mission) and a roadmap; each
 * module adds a part (purpose, brain, tools, memory, first run, launch).
 * Looking at the agent tells the learner where they are and what comes next,
 * and the journey itself follows how an agent is built.
 *
 * Pure functions only. The agent speaks in short first-person lines, in plain
 * English.
 */
import type { PrecheckResult, SetupAnswers } from "@/lib/setup";

export type PartState = "built" | "building" | "next" | "later";
export type AgentPart = {
  key: string;
  label: string;
  /** what the part gives the agent, a few words */
  detail: string;
  state: PartState;
  /** the module this part comes from (module parts only) */
  moduleId?: string;
};

type PartDef = { label: string; detail: string; next: string; built: string };

/** The setup pieces, earned while setting up the course. */
const SETUP: Record<"job" | "skills" | "roadmap", PartDef> = {
  job: { label: "Job", detail: "What it helps with", next: "Tell me about your work, and I'll know my job.", built: "I know my job now." },
  skills: { label: "Starting skills", detail: "What you already know", next: "Next, show me what you already know.", built: "I know what you already know, so we can skip it." },
  roadmap: { label: "Roadmap", detail: "Your plan", next: "Next, check your plan, and I'll get my roadmap.", built: "I have my roadmap. Let's start building me." },
};

/** One part per module of the AI agent course, in module order. Other courses use their module titles. */
const MODULE_PARTS: Record<string, PartDef> = {
  m1: { label: "Purpose", detail: "Decides its own steps", next: "Next, teach me what makes me an agent: deciding my own steps.", built: "I can decide my own steps now, not just reply." },
  m2: { label: "Brain", detail: "A language model", next: "Next, give me a brain that can understand and write.", built: "I have a brain now. I can understand and write." },
  m3: { label: "Tools", detail: "Uses your systems", next: "Next, give me tools so I can look things up and act.", built: "I have tools now. I can look things up and act." },
  m4: { label: "Memory", detail: "Remembers and plans", next: "Next, give me memory so I can remember and plan.", built: "I can remember now, and plan ahead." },
  m5: { label: "First run", detail: "Works from start to end", next: "Next, let's run me for real, one small step at a time.", built: "I ran for the first time, and it worked." },
  m6: { label: "Launch", detail: "Safe and live", next: "Next, make me safe and put me to work.", built: "I'm live and safe to use. Thank you!" },
};

/** What the agent says when a module's part is added ("I have tools now…"). */
export const partBuiltLine = (key: string): string | null => MODULE_PARTS[key]?.built ?? null;

/* ----------------------------------------------------------------- the name */

const AGENT_NOUN: Record<string, string> = {
  scheduling: "Scheduler",
  booking: "Scheduler",
  writing: "Writer",
  drafting: "Writer",
  answering: "Helper",
  tracking: "Tracker",
  planning: "Planner",
  checking: "Checker",
  reviewing: "Reviewer",
  sorting: "Sorter",
  summarizing: "Summarizer",
  summarising: "Summarizer",
  monitoring: "Monitor",
  predicting: "Forecaster",
  forecasting: "Forecaster",
  reporting: "Reporter",
  handling: "Handler",
  managing: "Manager",
  organizing: "Organizer",
  organising: "Organizer",
};
const FILLER = new Set(["and", "the", "a", "an", "for", "of", "to", "my", "our", "your", "with", "in", "on", "all", "daily", "today"]);
/** "follow-up" → "Follow-up": a capital at the start only */
const title = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w);
const singular = (w: string) => (/(ss|us)$/.test(w) ? w : w.replace(/ies$/, "y").replace(/s$/, ""));

/**
 * A short name for the learner's agent from their task: "Scheduling
 * follow-up appointments" → "Follow-up Appointment Scheduler". Falls back to
 * "{Field} Assistant", or null when nothing is known yet.
 */
export function agentNameFor(useCase: string | null | undefined, field?: string | null): string | null {
  const words = (useCase ?? "").toLowerCase().match(/[a-z][a-z-]*/g) ?? [];
  if (words.length) {
    const noun = AGENT_NOUN[words[0]!];
    const topic = (noun ? words.slice(1) : words).filter((w) => !FILLER.has(w)).slice(0, 2);
    if (topic.length) topic[topic.length - 1] = singular(topic[topic.length - 1]!);
    // short enough to read at a glance: a long name keeps only its first topic word
    const long = [...topic.map(title), noun ?? "Helper"].join(" ");
    const name = long.length > 24 && topic.length > 1 ? [title(topic[0]!), noun ?? "Helper"].join(" ") : long;
    if (topic.length) return name.slice(0, 40);
  }
  const f = (field ?? "").trim();
  return f ? `${title(f.split(/\s+/)[0]!.toLowerCase())} Assistant` : null;
}

/* ----------------------------------------------------------------- the blueprint */

export type SetupPhase = "profile" | "intro" | "precheck" | "customize" | "build";

export type AgentInput = {
  answers: SetupAnswers;
  /** the field's display name, e.g. "Healthcare" */
  fieldLabel?: string | null;
  precheck: PrecheckResult | null;
  enrolled: boolean;
  /** while setting up: the step on screen */
  phase?: SetupPhase | null;
  modules: { module_id: string; title: string; liveState: "done" | "in_progress" | "available" | "locked" }[];
  /** where "Continue" goes (lib/course-progress.ts) */
  resume?: { href: string; moduleIndex: number; title: string; minutesLeft: number } | null;
};

export type AgentBlueprint = {
  name: string | null;
  /** "Helps clinic reception with follow-up appointments" */
  purpose: string | null;
  skills: string[];
  setup: AgentPart[];
  parts: AgentPart[];
  builtCount: number;
  /** the part being built now */
  current: AgentPart | null;
  /** what the agent says: the last thing it got, then what it needs next */
  said: string | null;
  needs: string | null;
  next: { label: string; href: string; minutes: number } | null;
};

const SETUP_DONE: Record<SetupPhase, number> = { profile: 0, intro: 1, precheck: 1, customize: 2, build: 2 };

export function agentBlueprint(input: AgentInput): AgentBlueprint {
  const a = input.answers;
  const task = a.useCase?.trim() || null;
  const name = a.agentName?.trim() || agentNameFor(task, input.fieldLabel);
  const who = a.subRole?.trim() || a.roleOther?.trim() || null;
  // "Drafting parent emails · K-12 teaching", in the learner's own words
  const purpose = [task, who].filter(Boolean).join(" · ") || null;
  const intro = name ? `I'm ${name}.${task ? ` I'll help with ${task[0]!.toLowerCase()}${task.slice(1)}.` : ""}` : null;
  const skills = input.precheck?.activity?.strengths ?? [];

  // setup: how many pieces are done, from the step on screen or (after setup) all three
  const setupDone = input.enrolled ? 3 : input.phase ? SETUP_DONE[input.phase] : 0;
  const setupKeys = ["job", "skills", "roadmap"] as const;
  const setup: AgentPart[] = setupKeys.map((key, i) => ({
    key,
    label: SETUP[key].label,
    detail: key === "job" && purpose ? purpose : key === "skills" && skills.length ? skills.slice(0, 2).join(", ") : SETUP[key].detail,
    state: i < setupDone ? "built" : i === setupDone ? "building" : i === setupDone + 1 ? "next" : "later",
  }));

  // modules: built when done; the one "Continue" points at is being built (once set up)
  const buildingModule = input.enrolled ? (input.resume?.moduleIndex ?? 0) - 1 : -1;
  const parts: AgentPart[] = input.modules.map((m, i) => {
    const def = MODULE_PARTS[m.module_id];
    const state: PartState = m.liveState === "done" ? "built" : i === buildingModule ? "building" : "later";
    return { key: m.module_id, label: def?.label ?? m.title, detail: def?.detail ?? m.title, state, moduleId: m.module_id };
  });
  const firstLater = parts.findIndex((p, i) => p.state === "later" && i > buildingModule);
  if (input.enrolled && firstLater >= 0) parts[firstLater] = { ...parts[firstLater]!, state: "next" };

  const current = setup.find((p) => p.state === "building") ?? parts.find((p) => p.state === "building") ?? null;
  const builtCount = parts.filter((p) => p.state === "built").length;

  // what the agent says
  const lastSetup = setupDone > 0 ? SETUP[setupKeys[Math.min(setupDone, 3) - 1]!] : null;
  const lastModule = [...parts].reverse().find((p) => p.state === "built");
  let said: string | null = null;
  if (input.enrolled && lastModule) said = MODULE_PARTS[lastModule.key]?.built ?? null;
  else if (setupDone <= 1) said = intro;
  else if (lastSetup) said = lastSetup.built;
  let needs: string | null = null;
  // once the task is known, About you only needs finishing
  if (current?.key === "job" && task) needs = "Finish About you, and my job is set.";
  else if (current && setup.includes(current)) needs = SETUP[current.key as keyof typeof SETUP].next;
  else if (current) needs = MODULE_PARTS[current.key]?.next ?? `Next: ${current.label}.`;
  else if (input.enrolled && builtCount === parts.length) needs = null;

  const next = input.enrolled && input.resume ? { label: input.resume.title, href: input.resume.href, minutes: input.resume.minutesLeft } : null;
  return { name, purpose, skills, setup, parts, builtCount, current, said, needs, next };
}
