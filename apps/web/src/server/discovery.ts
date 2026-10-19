import "server-only";
import * as z from "zod/v4";
import keysJson from "@lms/fixtures/mock-gate-keys.json";
import { getCourse, getPrecheck } from "@/data";
import { geminiConfigured, geminiJson, GeminiError } from "@/server/ai/gemini";
import { ApiError } from "@/server/http";
import { AnswersIn } from "@/server/validators";
import { questionsFor, answerLabel, type SetupAnswers } from "@/lib/setup";
import {
  MAX_LEARNER_TURNS,
  bestLevels,
  cleanEvidence,
  inferLearning,
  isLearningPrefs,
  learnerTurns,
  profileFromLevels,
  scoreByOverlap,
  type DiscoveryEvidence,
  type DiscoveryMessage,
  type DiscoveryProfile,
  type DiscoveryScene,
  type DiscoverySkill,
  type DiscoveryTurn,
  type InteractionSignals,
} from "@/lib/discovery";

/**
 * Discovery, the live conversation that replaces the quick check. Gemini plays
 * a colleague from the learner's own field and talks through realistic
 * situations; every reply is scored against one course skill. Stateless: the
 * browser sends the transcript and the evidence so far on every turn. Without
 * GEMINI_API_KEY, or when the model fails, a short scripted conversation runs
 * instead, so enrolment always works.
 */

/** Request body for POST /api/v1/discovery. */
export const DiscoveryBody = z.object({
  courseId: z.string().min(1).max(40),
  answers: AnswersIn,
  messages: z.array(z.object({ role: z.enum(["guide", "learner"]), text: z.string().min(1).max(700) })).max(24),
  evidence: z.array(z.object({ skill: z.string().max(10), level: z.number().int().min(0).max(2), note: z.string().max(200) })).max(40).default([]),
  signals: z
    .object({
      replies: z.number().int().min(0).max(50),
      avgSeconds: z.number().min(0).max(3600),
      avgWords: z.number().min(0).max(1000),
      voiceReplies: z.number().int().min(0).max(50),
      helpAsks: z.number().int().min(0).max(50),
      notSure: z.number().int().min(0).max(50),
      chipReplies: z.number().int().min(0).max(50),
    })
    .nullable()
    .default(null),
});

const KEYS = keysJson as unknown as { precheck?: Record<string, string> };

/** One skill per module; the quick check's questions and right answers describe what understanding looks like. */
export async function discoverySkills(courseId: string): Promise<{ title: string; skills: DiscoverySkill[] }> {
  const course = await getCourse(courseId);
  if (!course) throw new ApiError(404, "not_found", "There is no such course.");
  const items = (await getPrecheck(courseId))?.items ?? [];
  const skills = course.modules.map((m, i) => {
    const key = String(i + 1);
    const probes = items
      .filter((it) => it.lesson === key)
      .map((it) => ({ situation: it.stem, idea: it.options.find((o) => o.id === KEYS.precheck?.[it.id])?.text ?? "" }))
      .filter((p) => p.idea);
    return { key, moduleId: m.module_id, title: m.title, probes };
  });
  return { title: course.title, skills };
}

type LearnerContext = { name: string; field: string | null; role: string | null; goal: string | null; experience: string | null; useCase: string | null };

function learnerContext(name: string, answers: SetupAnswers): LearnerContext {
  const q = (id: string) => questionsFor(answers).find((x) => x.id === id);
  const label = (id: string) => {
    const question = q(id);
    return question ? answerLabel(question, answers) : null;
  };
  // "About you" keeps the learner's own words (Hospital administration, Billing and claims); prefer them
  return {
    name,
    field: label("domain"),
    role: answers.subRole?.trim() || label("role"),
    goal: answers.goalDetail?.trim() || label("goal"),
    experience: label("experience"),
    useCase: answers.useCase?.trim() || null,
  };
}

/* ----------------------------------------------------------------- prompt */

function systemPrompt(courseTitle: string, skills: DiscoverySkill[]): string {
  const skillLines = skills
    .map((s) => `Skill ${s.key} (${s.title}):\n${s.probes.map((p) => `  - Situation: ${p.situation}\n    Understanding sounds like: ${p.idea}`).join("\n")}`)
    .join("\n");
  return [
    `You run "Discovery", a short live conversation that replaces a quiz before the course "${courseTitle}".`,
    "You play one friendly colleague who works in the learner's own field. Invent a believable name and role for yourself and a small workplace where an AI assistant has just been introduced. Use fictional data only.",
    "",
    "Your goal: find out how much the learner already understands each skill below, through talk about realistic situations at their work. The learner should feel they are chatting with a colleague, not taking a test.",
    "",
    "How to talk:",
    "- Each turn, bring up one small, concrete situation with the AI assistant and ask what they would do, notice, or tell the assistant. One question per turn.",
    "- React to what they said first, briefly and warmly, then move the story on.",
    "- Never ask for definitions or \"what is the difference between\" questions. Never give lettered or numbered options. Never use the words test, quiz, score, correct or wrong.",
    "  Bad: \"What makes an AI agent different from a chatbot?\"",
    "  Good (clinic example; use the learner's own field): \"A patient messages the assistant to move tomorrow's appointment. It replies with our phone number. What would you want it to do instead?\"",
    "- If they are unsure, give a small nudge or a simpler angle, then move on. Do not lecture or reveal full answers.",
    "- Plain words a 12-year-old and a 60-year-old both understand. At most 60 words per reply.",
    "- Stay on topic. No medical, legal or financial advice: situations are about how the AI assistant behaves, never real decisions.",
    "",
    "Skills (one per course module) and what real understanding sounds like:",
    skillLines,
    "",
    "Evidence (for the learner's latest message only):",
    "- 2: clear, right reasoning in their own words without help.",
    "- 1: partly right, or right only after your nudge.",
    "- 0: a misconception, or they say they don't know.",
    "- Record only skills their latest message actually showed. Never guess from their job title. Add a short note (under 15 words) on what they showed.",
    "",
    "Flow:",
    "- First turn (no learner messages yet): fill `scene`, greet the learner by first name, set the scene in one or two sentences, and ask about the first skill.",
    "- Cover each skill once, in any natural order, ideally one skill per learner reply. Skip a skill only if the learner clearly already showed it.",
    `- Finish when every skill has evidence, when the learner has replied ${MAX_LEARNER_TURNS} times, or when they ask to stop. Then set done to true, write a warm two-sentence wrap-up in reply, and fill profile: summary (one sentence), strengths (up to 3 short phrases), focus (up to 3 short phrases). No numbers or scores in the profile.`,
    "- quickReplies: up to 3 short helper phrases only, such as \"I'm not sure\", \"Can you give me a hint?\" or \"Tell me more about it\". Never an answer or an opinion about the situation.",
    "- probing: the key of the skill your reply asks about, or an empty string when done.",
    "",
    "How they learn (only when done): from how the learner interacts (reply length and speed, asking for hints or examples, saying they are unsure, speaking instead of typing) and how they reason, fill learning:",
    "- firstStep: example (they lean on examples or ask for them), idea (they reason from principles and explain at length) or try (they jump in and act quickly).",
    "- style: short (brief, quick replies) or steps (they want help broken down, or ask for more detail).",
    "- note: one warm sentence to the learner about how the course will teach them, in plain words, no numbers.",
  ].join("\n");
}

const TURN_SCHEMA = (keys: string[]) => ({
  type: "object",
  properties: {
    reply: { type: "string", description: "The colleague's next message to the learner. At most 60 words." },
    scene: {
      type: "object",
      description: "Only on the first turn: the workplace and your character.",
      properties: {
        title: { type: "string", description: "Short place name, at most 5 words." },
        setting: { type: "string", description: "One sentence: where we are and what the AI assistant does." },
        character: { type: "string", description: "Your first name." },
        characterRole: { type: "string", description: "Your job, at most 4 words." },
      },
      required: ["title", "setting", "character", "characterRole"],
    },
    probing: { type: "string", description: "Key of the skill this reply asks about, or empty when done." },
    evidence: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          skill: { type: "string", enum: keys },
          level: { type: "integer", enum: [0, 1, 2] },
          note: { type: "string" },
        },
        required: ["skill", "level", "note"],
      },
    },
    quickReplies: { type: "array", maxItems: 3, items: { type: "string" } },
    done: { type: "boolean" },
    learning: {
      type: "object",
      description: "Only when done: how the learner likes to learn.",
      properties: {
        firstStep: { type: "string", enum: ["example", "idea", "try"] },
        style: { type: "string", enum: ["short", "steps"] },
        note: { type: "string" },
      },
      required: ["firstStep", "style", "note"],
    },
    profile: {
      type: "object",
      properties: {
        summary: { type: "string" },
        strengths: { type: "array", maxItems: 3, items: { type: "string" } },
        focus: { type: "array", maxItems: 3, items: { type: "string" } },
      },
      required: ["summary", "strengths", "focus"],
    },
  },
  required: ["reply", "probing", "evidence", "quickReplies", "done"],
});

function userPrompt(ctx: LearnerContext, messages: DiscoveryMessage[], evidence: DiscoveryEvidence[], skills: DiscoverySkill[], signals: InteractionSignals | null): string {
  const levels = bestLevels(evidence);
  const seen = skills.filter((s) => levels[s.key] !== undefined).map((s) => s.key);
  const unseen = skills.filter((s) => levels[s.key] === undefined).map((s) => s.key);
  const transcript = messages.length
    ? messages.map((m) => `${m.role === "guide" ? "You" : "Learner"}: ${m.text}`).join("\n")
    : "(nothing yet: this is the first turn)";
  return [
    "Learner:",
    `- First name: ${ctx.name.split(/\s+/)[0] || "there"}`,
    `- Field: ${ctx.field ?? "not given"}`,
    `- Role: ${ctx.role ?? "not given"}`,
    `- Goal: ${ctx.goal ?? "not given"}`,
    `- Says their experience is: ${ctx.experience ?? "not given"}`,
    `- Wants to improve or automate: ${ctx.useCase ?? "not given"} (build situations around this when you can)`,
    "",
    "Conversation so far:",
    transcript,
    "",
    `Skills with evidence: ${seen.length ? seen.join(", ") : "none"}. Still to explore: ${unseen.length ? unseen.join(", ") : "none"}.`,
    `Learner replies so far: ${learnerTurns(messages)} of ${MAX_LEARNER_TURNS}.`,
    signals && signals.replies
      ? `How they interact so far: about ${signals.avgSeconds}s and ${signals.avgWords} words per reply; ${signals.helpAsks} asks for hints or examples; ${signals.notSure} "not sure" replies; ${signals.voiceReplies} spoken replies; ${signals.chipReplies} tapped suggestions.`
      : "How they interact so far: no replies yet.",
    "Write the next turn as JSON.",
  ].join("\n");
}

/* ----------------------------------------------------------------- turn */

type Raw = Partial<{ reply: string; scene: Partial<DiscoveryScene>; probing: string; evidence: unknown; quickReplies: unknown; done: boolean; profile: Partial<DiscoveryProfile>; learning: unknown }>;

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v: unknown, max: number, n: number) => (Array.isArray(v) ? v.map((x) => clip(x, n)).filter(Boolean).slice(0, max) : []);

export async function discoveryTurn(
  courseId: string,
  name: string,
  answers: SetupAnswers,
  messages: DiscoveryMessage[],
  evidenceSoFar: unknown[],
  signals: InteractionSignals | null = null,
): Promise<DiscoveryTurn> {
  const { title, skills } = await discoverySkills(courseId);
  const prior = cleanEvidence(evidenceSoFar, skills);
  const ctx = learnerContext(name, answers);
  if (!geminiConfigured()) return scriptedTurn(ctx, messages, prior, skills, signals);
  try {
    const { data: raw, model } = await geminiJson<Raw>({
      group: "main",
      system: systemPrompt(title, skills),
      contents: [{ role: "user", parts: [{ text: userPrompt(ctx, messages, prior, skills, signals) }] }],
      schema: TURN_SCHEMA(skills.map((s) => s.key)),
      thinking: "low",
      deadlineMs: 20_000,
      temperature: 0.8,
    });
    if (process.env.NODE_ENV !== "production") console.info(`[discovery] turn ${learnerTurns(messages)} by ${model}`);
    return finish(raw, messages, prior, skills, signals);
  } catch (e) {
    console.error("[discovery]", e instanceof GeminiError ? `${e.status ?? ""} ${e.message}` : e);
    return scriptedTurn(ctx, messages, prior, skills, signals);
  }
}

/** Validates a model turn and makes sure the conversation ends on time with a profile. */
function finish(raw: Raw, messages: DiscoveryMessage[], prior: DiscoveryEvidence[], skills: DiscoverySkill[], signals: InteractionSignals | null): DiscoveryTurn {
  const reply = clip(raw.reply, 700);
  if (!reply) throw new GeminiError("Gemini turn had no reply");
  const evidence = learnerTurns(messages) > 0 ? cleanEvidence(raw.evidence, skills) : [];
  const levels = bestLevels([...prior, ...evidence]);
  const covered = skills.every((s) => levels[s.key] !== undefined);
  const done = !!raw.done || learnerTurns(messages) >= MAX_LEARNER_TURNS || (covered && learnerTurns(messages) >= skills.length);
  const s = raw.scene;
  const scene = messages.length === 0 && s?.title ? { title: clip(s.title, 60), setting: clip(s.setting, 220), character: clip(s.character, 40), characterRole: clip(s.characterRole, 50) } : null;
  const p = raw.profile;
  const profile = done
    ? p?.summary
      ? { summary: clip(p.summary, 240), strengths: list(p.strengths, 3, 80), focus: list(p.focus, 3, 80) }
      : profileFromLevels(levels, skills)
    : null;
  return {
    reply,
    scene,
    probing: done ? "" : clip(raw.probing, 10),
    evidence,
    quickReplies: done ? [] : helperReplies(list(raw.quickReplies, 3, 60)),
    done,
    profile,
    learning: done ? learningFrom(raw.learning, signals) : null,
    source: "ai",
  };
}

/**
 * Quick replies help the learner reply; they never answer for them. Only
 * helper phrases survive (the model sometimes offers an answer as a chip),
 * topped up from a fixed set so there are always the same three choices.
 */
const HELPERS = ["I'm not sure", "Can you give me a hint?", "Tell me more"];
const HELPER = /not sure|don'?t know|hint|tell me more|more detail|example|say that again|explain/i;
export function helperReplies(replies: string[]): string[] {
  const safe = replies.filter((r) => HELPER.test(r) && r.split(/\s+/).length <= 6);
  for (const h of HELPERS) if (safe.length < 3 && !safe.some((r) => r.toLowerCase() === h.toLowerCase())) safe.push(h);
  return safe.slice(0, 3);
}

/** The model's reading of how the learner learns, or the rule-based one from the signals. */
function learningFrom(raw: unknown, signals: InteractionSignals | null) {
  const fallback = inferLearning(signals ?? EMPTY_SIGNALS);
  if (isLearningPrefs(raw)) return { firstStep: raw.firstStep, style: raw.style, note: clip(raw.note, 200) || fallback.note };
  return fallback;
}
const EMPTY_SIGNALS: InteractionSignals = { replies: 0, avgSeconds: 0, avgWords: 0, voiceReplies: 0, helpAsks: 0, notSure: 0, chipReplies: 0 };

/* ----------------------------------------------------------------- scripted fallback */

/** Same flow without a model: one situation per skill, replies scored by key words. */
function scriptedTurn(ctx: LearnerContext, messages: DiscoveryMessage[], prior: DiscoveryEvidence[], skills: DiscoverySkill[], signals: InteractionSignals | null): DiscoveryTurn {
  const isHint = (t: string) => /\bhint\b/i.test(t) && t.length < 60;
  const learnerMsgs = messages.filter((m) => m.role === "learner");
  // a hint request is not an answer: it keeps the same situation open
  const k = learnerMsgs.filter((m) => !isHint(m.text)).length;
  const asked = skills.filter((s) => s.probes.length);
  const latest = messages.at(-1);
  if (latest?.role === "learner" && isHint(latest.text) && asked[k]) {
    return {
      reply: "Sure. Think about what the assistant would need to do this well, and what could go wrong if it didn't have it. What would you say now?",
      scene: null,
      probing: asked[k]!.key,
      evidence: [],
      quickReplies: ["I'm not sure"],
      done: false,
      profile: null,
      learning: null,
      source: "script",
    };
  }
  const first = ctx.name.split(/\s+/)[0] || "there";
  const where = ctx.field ? `${ctx.field} team` : "team";
  const scene: DiscoveryScene = {
    title: ctx.field ? `${ctx.field} desk` : "The team desk",
    setting: `Your ${where} has just started using an AI assistant for everyday requests.`,
    character: "Sam",
    characterRole: ctx.field ? `${ctx.field} colleague` : "Your colleague",
  };

  // score the reply to the previous situation
  const evidence: DiscoveryEvidence[] = [];
  const last = latest?.role === "learner" ? latest : undefined;
  const prevSkill = asked[k - 1];
  if (last && prevSkill) {
    const probe = prevSkill.probes[0]!;
    evidence.push({ skill: prevSkill.key, level: scoreByOverlap(last.text, probe.idea), note: "Scored offline from key words" });
  }

  const next = asked[k];
  if (!next || learnerMsgs.length >= MAX_LEARNER_TURNS) {
    const levels = bestLevels([...prior, ...evidence]);
    return {
      reply: `Thanks, ${first}. That gives me a good picture of where you are. Your course is ready to start from there.`,
      scene: null,
      probing: "",
      evidence,
      quickReplies: [],
      done: true,
      profile: profileFromLevels(levels, skills),
      learning: learningFrom(null, signals),
      source: "script",
    };
  }
  const situation = next.probes[0]!.situation.trim();
  const lead = k === 0 ? `Hi ${first}, I'm Sam. ${scene.setting} Quick one from today. ` : "Thanks. Here's another one that came up. ";
  // stems that trail off ("writes its answer by…") read as a sentence to finish, not a question
  const ask = /(…|\.\.\.)$/.test(situation)
    ? `A colleague started explaining this and got stuck: "${situation}" How would you finish the thought?`
    : `A colleague asked me: "${situation.replace(/\?+$/, "")}?" How would you explain it to them?`;
  return {
    reply: `${lead}${ask}`,
    scene: k === 0 ? scene : null,
    probing: next.key,
    evidence,
    quickReplies: ["I'm not sure", "Can you give me a hint?"],
    done: false,
    profile: null,
    learning: null,
    source: "script",
  };
}
