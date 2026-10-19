/**
 * The Mission: a two-to-three minute story set in the learner's own work
 * that replaces the prior-knowledge quiz. Three scenes, two moments each, one
 * per course module. Every moment is a decision inside the story (what you
 * reply, what you tell the assistant, which plan you approve), and every
 * option stands for one idea from the course's quick check, so a choice tells
 * us which idea the learner holds, not just right or wrong. One "why?" in the
 * middle separates understanding from a lucky pick.
 *
 * Pure functions only: the server (server/mission.ts) writes the story and
 * keeps the answer key; this file shapes, scores and summarises.
 */
import type { SetupAnswers } from "@/lib/setup";
import { inferLearning, scoreByOverlap, type InteractionSignals, type LearningPrefs } from "@/lib/discovery";

export type MissionKind = "reply" | "instruct" | "approve";
/** Sets tone and look: never more playful than the person's working life. */
export type Audience = "learner" | "professional" | "executive";

export type MissionOption = { id: string; text: string };
export type MissionMoment = { id: string; kind: MissionKind; prompt: string; options: MissionOption[] };
/**
 * What the AI assistant's screen shows in a scene, played line by line like a
 * shot of a real screen: the learner asks, the assistant answers, calls a
 * tool, gets a result. Written for the learner's own task.
 */
export type MissionScreenLine = { kind: "user" | "agent" | "tool" | "result"; text: string };
export type MissionScreen = { app: "chat" | "email" | "sheet" | "notes"; title: string; lines: MissionScreenLine[] };
export type MissionScene = { heading: string; narration: string; screen: MissionScreen | null; moments: MissionMoment[] };
export const SCREEN_APPS: MissionScreen["app"][] = ["chat", "email", "sheet", "notes"];
export const SCREEN_KINDS: MissionScreenLine["kind"][] = ["user", "agent", "tool", "result"];
/** What the browser gets: no answer key. */
export type MissionScript = {
  id: string;
  title: string;
  /** the place and time, shown on the title card */
  setting: string;
  cast: { name: string; role: string };
  audience: Audience;
  /** for the designed backdrop when there is no image */
  field: string;
  scenes: MissionScene[];
  /** the moment that asks "why?" afterwards */
  whyMoment: string;
  whyPrompt: string;
  /** scene pictures can be requested from /api/v1/mission/image */
  images: boolean;
  /** narration can be requested from /api/v1/mission/voice (Gemini's voice); otherwise the browser reads it */
  voice: boolean;
  source: "ai" | "scripted";
};

/** Server-only: what each moment's options mean. */
export type MomentKey = {
  item: string;
  skill: string;
  /** option id → the quick-check option id it stands for */
  means: Record<string, string>;
  correct: string;
  /** quick-check option id → its text, the idea a learner holds by picking it */
  ideas: Record<string, string>;
};
export type MissionKey = Record<string, MomentKey>;

export type MissionAnswer = { moment: string; option: string | null; ms: number; switches: number };
export type MissionWhy = { moment: string; text: string; voice: boolean };
/** One idea the learner showed, per course module. */
export type MissionIdea = { skill: string; title: string; held: string; accurate: boolean; sure: boolean };

export const MISSION_MOMENTS = 6;

/* ----------------------------------------------------------------- who it is for */

export function audienceOf(a: SetupAnswers): Audience {
  const words = `${a.subRole ?? ""} ${a.roleOther ?? ""} ${a.goalDetail ?? ""}`.toLowerCase();
  if (a.role === "student" || /\b(student|studying|intern|trainee)\b/.test(words)) return "learner";
  if (a.role === "manager" || /\b(manag\w*|owner|director|head|founder|chief|partner|principal|executive)\b/.test(words) || a.experience === "regularly") return "executive";
  return "professional";
}

/** One quick-check item per module: the first (gentler) one for newcomers, the second for experienced learners. */
export function pickItems<T extends { lesson: string }>(items: T[], experience: string | null | undefined): T[] {
  const byLesson = new Map<string, T[]>();
  for (const it of items) byLesson.set(it.lesson, [...(byLesson.get(it.lesson) ?? []), it]);
  const later = experience === "sometimes" || experience === "regularly";
  return [...byLesson.values()].map((list) => (later ? list.at(-1)! : list[0]!));
}

/* ----------------------------------------------------------------- checking the model's options */

const STOP = new Set("the and for with that this from your you our its it's into than then them they what when which who will would can could should a an of to in on by is are be as at or it not just only each every all".split(" "));
const stem = (w: string) => w.replace(/(ing|ed|es|s|ly)$/, "").slice(0, 6);
const terms = (s: string) => new Set(s.toLowerCase().match(/[a-z]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)).map(stem) ?? []);
// words that carry an idea even when the story rewords everything else
const SYNONYMS: [RegExp, string][] = [
  [/\b(bigger|larger|more powerful|huge)\b/, "big"],
  [/\b(faster|quicker|speed|quickly)\b/, "fast"],
  [/\b(predict\w*|next (word|token|piece))\b/, "predict"],
  [/\b(look\w* up|database|retriev\w*|fetch\w*)\b/, "lookup"],
  [/\b(your code|our code|our app\w*|our program|our system|the app\w*)\b/, "ourcode"],
  [/\b(browser|customer|client side|parent)\b/, "browser"],
  [/\b(remember\w*|memory|recall\w*|retain\w*)\b/, "remember"],
  [/\b(step limit|cap|maximum|spend|budget|cost)\b/, "limit"],
  [/\b(environment variable|server|secret store|vault)\b/, "server"],
  [/\b(test cases?|test set|failures?|what fails)\b/, "testset"],
  [/\b(one (tool|step) at a time|smallest|simplest)\b/, "small"],
];
const concepts = (s: string) => {
  const out = terms(s);
  const low = s.toLowerCase();
  for (const [re, tag] of SYNONYMS) if (re.test(low)) out.add(`#${tag}`);
  return out;
};
const similarity = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit += w.startsWith("#") ? 2 : 1;
  return hit / Math.sqrt(a.size * b.size);
};
const permutations = <T,>(xs: T[]): T[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));

/**
 * Which idea each story option retells. The model labels its options, but a
 * label slip would score a learner against the wrong idea, so the wording is
 * matched back to the original ideas too: the assignment that best fits both
 * the labels and the words wins. Returns option index → idea id.
 */
export function alignOptions(options: { text: string; means: string }[], ideas: { id: string; text: string }[]): { means: string[]; changed: boolean } {
  const opt = options.map((o) => concepts(o.text));
  const idea = ideas.map((i) => concepts(i.text));
  const ids = ideas.map((i) => i.id);
  let best = options.map((o) => o.means);
  let bestScore = -Infinity;
  for (const perm of permutations(ids)) {
    const score = perm.reduce((s, id, i) => s + similarity(opt[i]!, idea[ids.indexOf(id)]!) + (options[i]!.means === id ? 0.35 : 0), 0);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = perm;
    }
  }
  return { means: best, changed: best.some((id, i) => id !== options[i]!.means) };
}

/* ----------------------------------------------------------------- narration */

/**
 * Every line the Mission reads aloud, in playing order, with the key the
 * voice route uses: the opening, each scene's narration, each decision, and
 * the "why".
 */
export function missionLines(m: Pick<MissionScript, "setting" | "title" | "scenes" | "whyMoment" | "whyPrompt">): { key: string; text: string }[] {
  const out = [{ key: "open", text: `${m.setting} ${m.title}.` }];
  m.scenes.forEach((s, i) => {
    out.push({ key: `scene-${i}`, text: s.narration });
    for (const mo of s.moments) {
      out.push({ key: mo.id, text: mo.prompt });
      if (mo.id === m.whyMoment) out.push({ key: "why", text: m.whyPrompt });
    }
  });
  return out.filter((l) => l.text.trim());
}

/* ----------------------------------------------------------------- scoring */

/**
 * Levels per module (0 to 2) from the choices: the right idea, picked without
 * much wavering, is 2; the right idea after changing their mind twice or
 * more, or with a weak "why", is 1; another idea or "not sure" is 0, unless
 * their "why" shows the right reasoning.
 */
export function scoreMission(
  key: MissionKey,
  answers: MissionAnswer[],
  why: { moment: string; level: 0 | 1 | 2 } | null,
  titles: Record<string, string>,
): { lessons: Record<string, 0 | 1 | 2>; ideas: MissionIdea[] } {
  const lessons: Record<string, 0 | 1 | 2> = {};
  const ideas: MissionIdea[] = [];
  for (const [moment, k] of Object.entries(key)) {
    const a = answers.find((x) => x.moment === moment);
    const picked = a?.option ? k.means[a.option] : undefined;
    const right = picked === k.correct;
    let level: 0 | 1 | 2 = right ? (a!.switches >= 2 ? 1 : 2) : 0;
    if (why?.moment === moment) level = right ? (why.level === 0 ? 1 : level) : why.level === 2 ? 1 : 0;
    lessons[k.skill] = level;
    ideas.push({
      skill: k.skill,
      title: titles[k.skill] ?? `Module ${k.skill}`,
      held: picked ? (k.ideas[picked] ?? "") : "Not sure yet",
      accurate: right,
      sure: !!a?.option && a.switches < 2,
    });
  }
  return { lessons, ideas };
}

/** The "why" answer scored without the model: overlap with the right idea's words. */
export const whyByOverlap = (text: string, rightIdea: string): 0 | 1 | 2 => scoreByOverlap(text, rightIdea);

/** How they decided, in the chat's terms, so "what helps first" is inferred the same way. */
export function missionSignals(answers: MissionAnswer[], why: MissionWhy | null): InteractionSignals {
  const n = answers.length;
  return {
    replies: n,
    avgSeconds: n ? Math.round((answers.reduce((s, a) => s + a.ms, 0) / n / 1000) * 10) / 10 : 0,
    avgWords: why?.text.trim() ? why.text.trim().split(/\s+/).length : 0,
    voiceReplies: why?.voice ? 1 : 0,
    helpAsks: answers.filter((a) => a.switches >= 2).length,
    notSure: answers.filter((a) => !a.option).length,
    chipReplies: 0,
  };
}

/** Plain-language result for the learner: strengths and focus by module title, never scores. */
export function missionProfile(ideas: MissionIdea[], lessons: Record<string, number>): { summary: string; strengths: string[]; focus: string[] } {
  const strengths = ideas.filter((i) => lessons[i.skill] === 2).map((i) => i.title).slice(0, 3);
  const focus = ideas.filter((i) => lessons[i.skill] === 0).map((i) => i.title).slice(0, 3);
  const summary =
    strengths.length >= 4
      ? "You already think like someone who builds agents. We'll move quickly."
      : strengths.length
        ? "You have a feel for some of this already. We'll move faster there and slow down where it's new."
        : "You're starting fresh, which is fine. We'll build it step by step.";
  return { summary, strengths, focus };
}

export const learningFromMission = (answers: MissionAnswer[], why: MissionWhy | null): LearningPrefs => inferLearning(missionSignals(answers, why));

/* ----------------------------------------------------------------- the ready-made story */

/**
 * Used when the model is off or fails: the same moments, framed as a story
 * in the learner's field. {name}, {field} and {task} are filled in.
 */
export const SCRIPTED_PROMPTS: Record<string, { kind: MissionKind; prompt: string }> = {
  p1: { kind: "reply", prompt: "{name} asks you: “People call this an agent, not a chatbot. What is the difference?”" },
  p2: { kind: "approve", prompt: "The assistant can take one job off your list. Which job is better done by a simple fixed routine instead?" },
  p3: { kind: "reply", prompt: "{name} asks you: “How does it write these replies?”" },
  p4: { kind: "instruct", prompt: "Before it starts, the assistant needs its main instructions. What do you give it?" },
  p5: { kind: "reply", prompt: "{name} asks you: “When it uses one of our work systems, who really does the work?”" },
  p6: { kind: "instruct", prompt: "A system the assistant needs stops answering. What should the assistant be told?" },
  p7: { kind: "reply", prompt: "{name} asks you: “Will it remember what we told it yesterday?”" },
  p8: { kind: "approve", prompt: "It needs to answer using your own {field} documents. Which setup do you approve?" },
  p9: { kind: "approve", prompt: "You will set up your own assistant for {task}. Which plan do you approve?" },
  p10: { kind: "reply", prompt: "{name} asks you: “How will we know it is ready for real {task}?”" },
  p11: { kind: "approve", prompt: "It is Friday evening. A tool keeps failing, and the assistant keeps trying again. Which safety rule do you approve?" },
  p12: { kind: "instruct", prompt: "The IT team asks where the assistant’s secret key should be kept when it goes online." },
};

export const SCRIPTED_SCENES: { heading: string; narration: string; screen: MissionScreen }[] = [
  {
    heading: "The new assistant",
    narration: "It is Monday morning. Your team has a new AI assistant to help with {task}. {name} wants your opinion before it is used for real work.",
    screen: {
      app: "chat",
      title: "Assistant · {task}",
      lines: [
        { kind: "user", text: "Can you help me with {task} today?" },
        { kind: "agent", text: "Yes. Let me see what’s waiting first." },
        { kind: "tool", text: "Opening today’s {field} work list" },
        { kind: "result", text: "12 items found · 3 marked urgent" },
        { kind: "agent", text: "I’ll start with the urgent ones and draft each for you to check." },
      ],
    },
  },
  {
    heading: "Giving it tools",
    narration: "It is midday. The assistant is now connected to your work systems. It works fast, but some things go wrong.",
    screen: {
      app: "notes",
      title: "Assistant · working log",
      lines: [
        { kind: "agent", text: "Item 4 needs details from another system." },
        { kind: "tool", text: "Looking up records" },
        { kind: "result", text: "No reply after 30 seconds" },
        { kind: "agent", text: "Something went wrong there. Deciding what to do next…" },
      ],
    },
  },
  {
    heading: "Going live",
    narration: "It is Friday. The assistant is almost ready to use. You make the final decisions.",
    screen: {
      app: "sheet",
      title: "Go-live checklist",
      lines: [
        { kind: "result", text: "Drafts this week: 46 · sent after review: 41" },
        { kind: "tool", text: "Running final checks" },
        { kind: "result", text: "2 checks still open" },
        { kind: "agent", text: "Ready when you are. A few settings need your decision." },
      ],
    },
  },
];

/** Background colours for the designed set, by field (used when there is no generated image). */
export function backdropOf(field: string): { from: string; to: string; motif: string } {
  const f = field.toLowerCase();
  if (/health|clinic|hospital|nurs|medic|pharm/.test(f)) return { from: "#0e2a33", to: "#0a1418", motif: "health" };
  if (/financ|bank|account|insur|invest/.test(f)) return { from: "#14233b", to: "#0b111c", motif: "finance" };
  if (/educat|teach|school|college|train/.test(f)) return { from: "#2a2238", to: "#120f1a", motif: "education" };
  if (/manufactur|factory|plant|production|engineer/.test(f)) return { from: "#2b2618", to: "#13110b", motif: "manufacturing" };
  if (/retail|shop|store|commerce/.test(f)) return { from: "#33201c", to: "#150d0b", motif: "retail" };
  if (/\bit\b|software|tech|develop|data/.test(f)) return { from: "#10263a", to: "#0a0f17", motif: "it" };
  return { from: "#1c2233", to: "#0c0e15", motif: "work" };
}
