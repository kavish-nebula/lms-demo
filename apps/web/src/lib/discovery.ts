/**
 * Discovery: a short live conversation that replaces the multiple-choice
 * quick check. The learner talks with a colleague from their own field about
 * realistic situations; each reply is evidence about one course skill (one
 * per module). Pure helpers shared by the server route and the chat UI.
 *
 * The output is the same per-module score (0-2) the quick check produced, so
 * support levels, the AI planner and every "why" note keep working unchanged.
 * A skill the conversation never reached is left out (unknown), never scored
 * as 0: not seeing a skill is not evidence the learner lacks it.
 */

export type DiscoveryLevel = 0 | 1 | 2;

/** One course skill: a module, and what real understanding of it sounds like. */
export type DiscoverySkill = {
  /** the precheck lesson key ("1".."6"), so scores slot into PrecheckResult.lessons */
  key: string;
  moduleId: string;
  title: string;
  /** situations the skill covers, each with the idea a good answer contains */
  probes: { situation: string; idea: string }[];
};

export type DiscoveryMessage = { role: "guide" | "learner"; text: string };

export type DiscoveryEvidence = { skill: string; level: DiscoveryLevel; note: string };

export type DiscoveryScene = { title: string; setting: string; character: string; characterRole: string };

export type DiscoveryProfile = { summary: string; strengths: string[]; focus: string[] };

/** What the server returns for each turn of the conversation. */
export type DiscoveryTurn = {
  reply: string;
  scene: DiscoveryScene | null;
  /** the skill the guide is exploring now ("" when wrapping up) */
  probing: string;
  /** evidence from the learner's latest message */
  evidence: DiscoveryEvidence[];
  quickReplies: string[];
  done: boolean;
  profile: DiscoveryProfile | null;
  /** at the end: how the learner seems to like to learn, from how they interacted */
  learning: LearningPrefs | null;
  /** "ai" when the model wrote it, "script" for the built-in fallback */
  source: "ai" | "script";
};

/** The conversation ends after this many learner replies, whatever the coverage. */
export const MAX_LEARNER_TURNS = 8;
export const MAX_MESSAGE_CHARS = 600;

export const learnerTurns = (messages: DiscoveryMessage[]) => messages.filter((m) => m.role === "learner").length;

/** Best level seen per skill. Skills with no evidence are absent. */
export function bestLevels(evidence: DiscoveryEvidence[]): Record<string, DiscoveryLevel> {
  const out: Record<string, DiscoveryLevel> = {};
  for (const e of evidence) {
    const prev = out[e.skill];
    if (prev === undefined || e.level > prev) out[e.skill] = e.level;
  }
  return out;
}

/** Per-module scores in the quick check's shape, limited to known skills. */
export function lessonsFromEvidence(evidence: DiscoveryEvidence[], skills: DiscoverySkill[]): Record<string, number> {
  const known = new Set(skills.map((s) => s.key));
  return Object.fromEntries(Object.entries(bestLevels(evidence)).filter(([k]) => known.has(k)));
}

/** Clamps whatever came back (from a model or a client) to valid evidence. */
export function cleanEvidence(raw: unknown, skills: DiscoverySkill[]): DiscoveryEvidence[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(skills.map((s) => s.key));
  const out: DiscoveryEvidence[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { skill, level, note } = r as Record<string, unknown>;
    const key = String(skill ?? "");
    const n = Number(level);
    if (!known.has(key) || ![0, 1, 2].includes(n)) continue;
    out.push({ skill: key, level: n as DiscoveryLevel, note: String(note ?? "").slice(0, 160) });
  }
  return out;
}

/* ----------------------------------------------------------------- fallback scoring */

const STOP = new Set(
  "a an and are as at be but by can do does for from has have how i if in into is it its it's me my not of on or so that the their them then there they this to too up us was we what when which who why will with you your".split(" "),
);
const DONT_KNOW = /\b(don'?t know|not sure|no idea|idk|no clue|skip|pass)\b/i;

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/**
 * Without a model: how close a free-text reply comes to the idea a good
 * answer contains, by shared key words. Coarse on purpose: it only sets
 * starting support, and the course keeps adapting from real answers.
 */
export function scoreByOverlap(reply: string, idea: string): DiscoveryLevel {
  if (!reply.trim() || DONT_KNOW.test(reply)) return 0;
  const want = words(idea);
  if (!want.size) return 1;
  const got = words(reply);
  let hit = 0;
  for (const w of want) if (got.has(w) || [...got].some((g) => g.length > 4 && (g.startsWith(w.slice(0, 5)) || w.startsWith(g.slice(0, 5))))) hit++;
  const ratio = hit / want.size;
  return ratio >= 0.34 ? 2 : ratio >= 0.12 ? 1 : 0;
}

/** Short plain-language summary from levels, used when the model is not available. */
export function profileFromLevels(levels: Record<string, DiscoveryLevel>, skills: DiscoverySkill[]): DiscoveryProfile {
  const title = (k: string) => skills.find((s) => s.key === k)?.title ?? k;
  const strengths = Object.entries(levels).filter(([, l]) => l === 2).map(([k]) => title(k)).slice(0, 3);
  const focus = Object.entries(levels).filter(([, l]) => l === 0).map(([k]) => title(k)).slice(0, 3);
  const summary = strengths.length
    ? "You already have a feel for some of this. We'll move faster there."
    : "You're starting fresh, which is fine. We'll build it step by step.";
  return { summary, strengths, focus };
}

/* ----------------------------------------------------------------- how the learner interacts */

/** One learner reply, as the chat saw it happen. */
export type ReplyRecord = { seconds: number; words: number; voice: boolean; chip: boolean; text: string };

/** How the learner talks in the chat: the evidence for how they like to learn. */
export type InteractionSignals = {
  replies: number;
  avgSeconds: number;
  avgWords: number;
  voiceReplies: number;
  /** "hint", "tell me more", "example" requests */
  helpAsks: number;
  /** "not sure", "don't know" replies */
  notSure: number;
  chipReplies: number;
};

/** What the chat infers, in the profile's own values: what helps first, and explanation style. */
export type LearningPrefs = { firstStep: "example" | "idea" | "try"; style: "short" | "steps"; note: string };

const HELP = /\b(hint|tell me more|example|explain|what do you mean)\b/i;
const UNSURE = /\b(not sure|don'?t know|no idea|idk)\b/i;

export function summarizeSignals(records: ReplyRecord[]): InteractionSignals {
  const n = records.length;
  const avg = (f: (r: ReplyRecord) => number) => (n ? Math.round((records.reduce((s, r) => s + f(r), 0) / n) * 10) / 10 : 0);
  return {
    replies: n,
    avgSeconds: avg((r) => r.seconds),
    avgWords: avg((r) => r.words),
    voiceReplies: records.filter((r) => r.voice).length,
    helpAsks: records.filter((r) => HELP.test(r.text)).length,
    notSure: records.filter((r) => UNSURE.test(r.text)).length,
    chipReplies: records.filter((r) => r.chip).length,
  };
}

/**
 * Without a model: a plain reading of the signals. Asking for help often
 * suggests examples first with step-by-step support; long, considered
 * replies suggest the idea first; quick, short replies suggest trying first
 * with short explanations. Learners can change both in Customise.
 */
export function inferLearning(s: InteractionSignals): LearningPrefs {
  if (s.helpAsks + s.notSure >= 2) return { firstStep: "example", style: "steps", note: "You like to see an example first, with step-by-step help." };
  if (s.avgWords >= 20) return { firstStep: "idea", style: "steps", note: "You think things through, so each lesson opens with the idea, explained in full." };
  if (s.replies && s.avgWords < 12 && s.avgSeconds < 25) return { firstStep: "try", style: "short", note: "You move quickly, so you'll try things first, with short explanations." };
  return { firstStep: "example", style: "short", note: "You'll see an example first, explained briefly." };
}

export const isLearningPrefs = (v: unknown): v is LearningPrefs => {
  const o = v as Partial<LearningPrefs> | null;
  return !!o && ["example", "idea", "try"].includes(String(o.firstStep)) && ["short", "steps"].includes(String(o.style));
};
