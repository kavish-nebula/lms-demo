import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";
import keysJson from "@lms/fixtures/mock-gate-keys.json";
import { getCourse, getPrecheck } from "@/data";
import { geminiConfigured, geminiJson, GeminiError } from "@/server/ai/gemini";
import { geminiImage, geminiImagesReady } from "@/server/ai/gemini-image";
import { speak, voiceReady } from "@/server/voice";
import { ApiError } from "@/server/http";
import { AnswersIn } from "@/server/validators";
import { QUESTIONS, answerLabel, type SetupAnswers } from "@/lib/setup";
import {
  SCREEN_APPS,
  SCREEN_KINDS,
  SCRIPTED_PROMPTS,
  alignOptions,
  SCRIPTED_SCENES,
  audienceOf,
  missionLines,
  learningFromMission,
  missionProfile,
  pickItems,
  scoreMission,
  whyByOverlap,
  type Audience,
  type MissionAnswer,
  type MissionIdea,
  type MissionKey,
  type MissionKind,
  type MissionScreen,
  type MissionScreenLine,
  type MissionScript,
  type MissionWhy,
} from "@/lib/mission";
import type { LearningPrefs } from "@/lib/discovery";

/**
 * The Mission (see lib/mission.ts). Gemini writes the whole story in one
 * call from the learner's profile: three scenes, six moments, each option a
 * faithful retelling of one quick-check option. The browser gets the story
 * without the answer key; the key stays here, with the story, until the
 * learner finishes. Without GEMINI_API_KEY, or when the model fails, a
 * ready-made story with the same moments runs instead.
 */

export const MissionBody = z.object({ courseId: z.string().min(1).max(40), answers: AnswersIn });
export const MissionFinishBody = z.object({
  id: z.string().min(8).max(40),
  answers: z
    .array(z.object({ moment: z.string().max(20), option: z.string().max(20).nullable(), ms: z.number().int().min(0).max(3_600_000), switches: z.number().int().min(0).max(50) }))
    .max(12),
  why: z.object({ moment: z.string().max(20), text: z.string().max(600), voice: z.boolean().default(false) }).nullable().default(null),
});

const KEYS = keysJson as unknown as { precheck?: Record<string, string> };

type Item = { id: string; lesson: string; stem: string; options: { id: string; text: string }[] };
type Stored = {
  script: MissionScript;
  key: MissionKey;
  titles: Record<string, string>;
  /** how every picture looks, and who is in it */
  style: string;
  people: string;
  castLook: string;
  imagePrompts: string[];
  images: Map<number, Promise<{ data: Buffer; mimeType: string } | null>>;
  /** narration per line key, generated once */
  voices: Map<string, Promise<Buffer | null>>;
  at: number;
};

// shared across route bundles (the dev server may load this module once per route)
const store: Map<string, Stored> = ((globalThis as { __missions?: Map<string, Stored> }).__missions ??= new Map());
const TTL = 2 * 60 * 60_000;
function remember(s: Stored) {
  for (const [id, v] of store) if (Date.now() - v.at > TTL || store.size > 300) store.delete(id);
  store.set(s.script.id, s);
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
const shuffle = <T,>(list: T[]) => list.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const newId = () => randomBytes(9).toString("base64url");

/** Voice for the story; look and people for the pictures. Pictures are always photographs, never cartoons. */
const TONE: Record<Audience, { voice: string; look: string; people: string }> = {
  learner: {
    voice: "Warm and encouraging, simple everyday words. A friendly named colleague who talks naturally.",
    look: "Photorealistic candid film still, 35mm lens, soft natural daylight, warm true-to-life colours",
    people: "young people in their late teens or twenties",
  },
  professional: {
    voice: "Calm and realistic, respectful of their experience. A colleague who talks like a real coworker in their field.",
    look: "Photorealistic cinematic film still, 35mm lens, natural window light, muted true-to-life colours, shallow depth of field",
    people: "working adults of mixed ages",
  },
  executive: {
    voice: "Crisp briefing tone with very few words. Frame each moment as a decision with real consequences. No small talk.",
    look: "Photorealistic cinematic film still, anamorphic lens, low-key premium lighting, muted rich tones",
    people: "experienced senior professionals",
  },
};


function context(name: string, a: SetupAnswers) {
  const label = (id: string) => {
    const q = QUESTIONS.find((x) => x.id === id);
    return q ? answerLabel(q, a) : null;
  };
  return {
    first: name.split(/\s+/)[0] || "",
    field: label("domain") ?? "their workplace",
    role: a.subRole?.trim() || label("role") || "",
    task: a.useCase?.trim() || "everyday work",
    goal: a.goalDetail?.trim() || label("goal") || "",
    experience: label("experience") || "",
  };
}

/* ----------------------------------------------------------------- writing the story */

const KINDS: MissionKind[] = ["reply", "instruct", "approve"];
const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "A short film-like title, at most 5 words." },
    setting: { type: "string", description: "Place and time for the title card, e.g. 'Monday, 7:40 am. Greenfield School staff room.' At most 12 words." },
    cast: {
      type: "object",
      properties: {
        name: { type: "string" },
        role: { type: "string" },
        look: { type: "string", description: "What the colleague looks like, for the pictures: age range, clothing that fits their job, one distinctive detail. At most 20 words." },
      },
      required: ["name", "role", "look"],
    },
    whyPrompt: { type: "string", description: "What the colleague asks after the third moment to hear the learner's reasoning, in the story, at most 16 words." },
    scenes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "At most 4 words." },
          narration: { type: "string", description: "What the narrator says to set the scene: two or three short, plain sentences, at most 24 words." },
          screen: {
            type: "object",
            description:
              "What the AI assistant's screen shows during this scene, played line by line like a short film shot: the learner asks, the assistant replies, calls a tool, gets a result. About the learner's own task, with fictional data. It shows the situation only, never the answer to this scene's decisions.",
            properties: {
              app: { type: "string", enum: ["chat", "email", "sheet", "notes"], description: "The kind of window that fits the task." },
              title: { type: "string", description: "Window title, at most 6 words, e.g. 'Handover notes · Ward 4B'." },
              lines: {
                type: "array",
                minItems: 3,
                maxItems: 6,
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      enum: ["user", "agent", "tool", "result"],
                      description: "user = the learner typing; agent = the assistant speaking; tool = a tool it starts using; result = what the tool returned.",
                    },
                    text: { type: "string", description: "At most 14 words. Tool lines name the action, e.g. 'Opening the vitals system'." },
                  },
                  required: ["kind", "text"],
                },
              },
            },
            required: ["app", "title", "lines"],
          },
          imagePrompt: {
            type: "string",
            description:
              "A photorealistic film still of this scene for an image model, at most 60 words: the exact room and equipment of the learner's job, props from their task, what the colleague is doing, the learner seen from behind or over the shoulder, time of day, and the shot (wide or medium). Screens and papers unreadable. No text.",
          },
          moments: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              properties: {
                item: { type: "string", description: "The id of the idea set this moment retells." },
                kind: { type: "string", enum: KINDS },
                prompt: { type: "string", description: "The situation and what the learner must decide, inside the story, at most 28 words." },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { means: { type: "string", description: "The id of the idea this option retells." }, text: { type: "string", description: "At most 16 words." } },
                    required: ["means", "text"],
                  },
                },
              },
              required: ["item", "kind", "prompt", "options"],
            },
          },
        },
        required: ["heading", "narration", "screen", "imagePrompt", "moments"],
      },
    },
  },
  required: ["title", "setting", "cast", "whyPrompt", "scenes"],
};

type RawMission = {
  title?: unknown;
  setting?: unknown;
  cast?: { name?: unknown; role?: unknown; look?: unknown };
  whyPrompt?: unknown;
  scenes?: { heading?: unknown; narration?: unknown; screen?: unknown; imagePrompt?: unknown; moments?: { item?: unknown; kind?: unknown; prompt?: unknown; options?: { means?: unknown; text?: unknown }[] }[] }[];
};

function systemPrompt(courseTitle: string, audience: Audience) {
  const lines = [
    `You write "The Mission", a two-minute interactive story that replaces a prior-knowledge quiz before the course "${courseTitle}".`,
    "The story happens in the learner's own workplace: an AI assistant has just arrived to help with the task they care about. One colleague (fictional) appears throughout.",
    `Tone: ${TONE[audience].voice}`,
    "",
    "You get six idea sets, in order. Each becomes one moment: two moments per scene, in the order given.",
    "A moment is a decision inside the story: what they reply to the colleague (reply), what they tell the assistant (instruct), or which of the assistant's proposals they approve (approve). Mix the kinds.",
    "Each idea set has several ideas. Write one option per idea, retelling exactly that idea in the story's own words and the learner's field. Keep each option's meaning precisely: a wrong idea must stay wrong, the right idea must stay right.",
    "Make every option equally plausible, similar in length and tone. Never hint which one is better. Never use the words quiz, test, correct, wrong, score or question.",
    "Use fictional names and data only.",
    "",
    "Language: everything is read aloud, so write plain, everyday English that sounds like normal speech. Short sentences, at most 15 words each. Common words a school student or a 60-year-old would use. No poetic or film-style phrases (not 'the last calls are yours', 'the morning rush hums'), no idioms, no slang. Say things directly: 'It is Monday morning. Your team has a new AI assistant.' Explain any technical word in a few plain words.",
    "",
    "Show, don't tell: each scene plays the assistant's screen as it works on the learner's task (what they ask, what it says, the tools it uses, what comes back). Keep the narration short; the screen carries the scene. The screen must never give away a decision.",
    "",
    "Pictures: each scene becomes a real-looking photograph. Show the true workplace of someone in the learner's role, with the right room, equipment and clothing (scrubs and monitors on a ward, desks and a whiteboard in a classroom, machines and safety gear on a factory floor), and props from the task they named.",
    `People in the pictures are ${TONE[audience].people}. Scene 1 is morning, scene 2 midday, scene 3 late afternoon. The same colleague appears in every scene, looking as described.`,
  ];
  return lines.join("\n");
}

function userPrompt(ctx: ReturnType<typeof context>, items: Item[]) {
  return [
    "LEARNER",
    `- Field: ${ctx.field}`,
    ctx.role && `- Part of the field: ${ctx.role}`,
    `- Wants an AI assistant to help with: ${ctx.task}`,
    ctx.goal && `- Goal: ${ctx.goal}`,
    ctx.experience && `- Experience with AI: ${ctx.experience}`,
    "",
    "IDEA SETS (in order; scene 1 takes the first two, scene 2 the next two, scene 3 the last two)",
    ...items.map((it) => `Set ${it.id} (about: ${it.stem})\n${it.options.map((o) => `  idea ${o.id}: ${o.text}`).join("\n")}`),
    "",
    "Write the story as JSON.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Builds the browser's story and the server's key from model output; null if anything doesn't fit. */
function fromModel(raw: RawMission, items: Item[], ctx: ReturnType<typeof context>, audience: Audience, images: boolean) {
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.slice(0, 3) : [];
  if (scenes.length !== 3) return null;
  const key: MissionKey = {};
  const imagePrompts: string[] = [];
  const out: MissionScript["scenes"] = [];
  let n = 0;
  for (const [si, s] of scenes.entries()) {
    const moments = Array.isArray(s.moments) ? s.moments.slice(0, 2) : [];
    if (moments.length !== 2) return null;
    const built = [];
    for (const [mi, m] of moments.entries()) {
      const item = items[si * 2 + mi];
      if (!item || clip(m.item, 10) !== item.id) return null;
      const kind = KINDS.includes(m.kind as MissionKind) ? (m.kind as MissionKind) : "reply";
      const opts = Array.isArray(m.options) ? m.options : [];
      const ids = item.options.map((o) => o.id);
      const seen = new Set<string>();
      const written: { text: string; means: string }[] = [];
      for (const o of opts) {
        const id = clip(o?.means, 4);
        const text = clip(o?.text, 140);
        if (!ids.includes(id) || seen.has(id) || !text) continue;
        seen.add(id);
        written.push({ text, means: id });
      }
      if (seen.size !== ids.length) return null; // every idea must be there, once
      // the answer key never rests on the model's labels alone: check them against the wording
      const aligned = alignOptions(written, item.options);
      if (aligned.changed) console.warn(`[mission] corrected the model's option labels for ${item.id}`);
      const options: { id: string; text: string }[] = [];
      const means: Record<string, string> = {};
      written.forEach((w, i) => {
        const oid = `o${newId().slice(0, 6)}`;
        options.push({ id: oid, text: w.text });
        means[oid] = aligned.means[i]!;
      });
      const prompt = clip(m.prompt, 220);
      if (!prompt) return null;
      const momentId = `m${++n}`;
      key[momentId] = keyFor(item, means);
      built.push({ id: momentId, kind, prompt, options: shuffle(options) });
    }
    imagePrompts.push(clip(s.imagePrompt, 500));
    out.push({ heading: clip(s.heading, 40) || SCRIPTED_SCENES[si]!.heading, narration: clip(s.narration, 260), screen: cleanScreen(s.screen), moments: built });
  }
  const castName = clip(raw.cast?.name, 30) || "Sam";
  const script: MissionScript = {
    id: newId(),
    title: clip(raw.title, 50) || "The new assistant",
    setting: clip(raw.setting, 90),
    cast: { name: castName, role: clip(raw.cast?.role, 50) || "Your colleague" },
    audience,
    field: ctx.field,
    scenes: out,
    whyMoment: "m3",
    whyPrompt: clip(raw.whyPrompt, 140) || `${castName} asks: “Why that one?”`,
    images,
    voice: false,
    source: "ai",
  };
  return { script, key, imagePrompts, castLook: clip(raw.cast?.look, 160) };
}

/** A model-written screen, checked; null shows the scene without one. */
function cleanScreen(raw: unknown): MissionScreen | null {
  const r = raw as { app?: unknown; title?: unknown; lines?: unknown } | null;
  if (!r || !Array.isArray(r.lines)) return null;
  const lines = (r.lines as { kind?: unknown; text?: unknown }[])
    .map((l) => ({ kind: SCREEN_KINDS.includes(l?.kind as MissionScreenLine["kind"]) ? (l.kind as MissionScreenLine["kind"]) : "agent", text: clip(l?.text, 110) }))
    .filter((l) => l.text)
    .slice(0, 6);
  if (lines.length < 2) return null;
  const app = SCREEN_APPS.includes(r.app as MissionScreen["app"]) ? (r.app as MissionScreen["app"]) : "chat";
  return { app, title: clip(r.title, 50) || "Assistant", lines };
}

function keyFor(item: Item, means: Record<string, string>) {
  return {
    item: item.id,
    skill: item.lesson,
    means,
    correct: KEYS.precheck?.[item.id] ?? "",
    ideas: Object.fromEntries(item.options.map((o) => [o.id, o.text])),
  };
}

function scripted(items: Item[], ctx: ReturnType<typeof context>, audience: Audience, images: boolean) {
  const vars = { name: "Priya", field: ctx.field.toLowerCase(), task: ctx.task.toLowerCase() };
  const key: MissionKey = {};
  let n = 0;
  const scenes = SCRIPTED_SCENES.map((s, si) => ({
    heading: s.heading,
    narration: fill(s.narration, vars),
    screen: { app: s.screen.app, title: fill(s.screen.title, vars), lines: s.screen.lines.map((l) => ({ kind: l.kind, text: fill(l.text, vars) })) },
    moments: items.slice(si * 2, si * 2 + 2).map((item) => {
      const p = SCRIPTED_PROMPTS[item.id] ?? { kind: "reply" as const, prompt: `Priya asks: “${item.stem}”` };
      const means: Record<string, string> = {};
      const options = item.options.map((o) => {
        const oid = `o${newId().slice(0, 6)}`;
        means[oid] = o.id;
        return { id: oid, text: o.text };
      });
      const momentId = `m${++n}`;
      key[momentId] = keyFor(item, means);
      return { id: momentId, kind: p.kind, prompt: fill(p.prompt, vars), options: shuffle(options) };
    }),
  }));
  const script: MissionScript = {
    id: newId(),
    title: "The new assistant",
    setting: `Monday morning. ${ctx.field}.`,
    cast: { name: "Priya", role: "Your colleague" },
    audience,
    field: ctx.field,
    scenes,
    whyMoment: "m3",
    whyPrompt: "Priya asks: “Why that one?”",
    images,
    voice: false,
    source: "scripted",
  };
  const place = `a ${ctx.field.toLowerCase()} workplace`;
  const imagePrompts = [
    `Early morning in ${place}, a laptop on a desk showing a new AI assistant, a colleague leaning in to look`,
    `Midday in ${place}, screens connected to work systems, busy but calm, a colleague pointing at a monitor`,
    `Late afternoon in ${place}, golden light, two colleagues reviewing a screen before going live`,
  ];
  return { script, key, imagePrompts, castLook: "a friendly colleague in work clothes that fit the job" };
}

export async function createMission(courseId: string, name: string, answers: SetupAnswers): Promise<MissionScript> {
  const course = await getCourse(courseId);
  if (!course) throw new ApiError(404, "not_found", "There is no such course.");
  const all = ((await getPrecheck(courseId))?.items ?? []) as Item[];
  const items = pickItems(all, answers.experience).slice(0, 6);
  if (items.length < 6) throw new ApiError(404, "not_found", "This course has no mission yet.");
  const audience = audienceOf(answers);
  const ctx = context(name, answers);
  const titles = Object.fromEntries(course.modules.map((m, i) => [String(i + 1), m.title]));
  const images = geminiImagesReady();

  let built = null;
  if (geminiConfigured()) {
    try {
      const { data, model } = await geminiJson<RawMission>({
        group: "main",
        thinking: "low",
        deadlineMs: 25_000,
        temperature: 0.8,
        maxOutputTokens: 6000,
        system: systemPrompt(course.title, audience),
        contents: [{ role: "user", parts: [{ text: userPrompt(ctx, items) }] }],
        schema: SCHEMA,
      });
      built = fromModel(data, items, ctx, audience, images);
      if (!built) console.warn(`[mission] ${model} wrote a story that didn't fit; using the ready-made one`);
      else if (process.env.NODE_ENV !== "production") console.info(`[mission] story by ${model}`);
    } catch (e) {
      console.error("[mission]", e instanceof GeminiError ? `${e.status ?? ""} ${e.message}` : e);
    }
  }
  built ??= scripted(items, ctx, audience, images);
  const { castLook, ...rest } = built;
  rest.script.voice = voiceReady();
  remember({
    ...rest,
    titles,
    style: TONE[audience].look,
    people: `${TONE[audience].people} working as ${ctx.role || "staff"} in ${ctx.field.toLowerCase()}`,
    castLook: castLook || "a colleague in work clothes that fit the job",
    images: new Map(),
    voices: new Map(),
    at: Date.now(),
  });
  // narration: every line starts now, in playing order, so each is ready before it's needed
  if (rest.script.voice) void narrateAll(rest.script.id);
  // draw every scene now, so each picture is ready by the time its scene plays (2 and 3 wait for 1, their reference)
  if (images) for (let i = 0; i < rest.imagePrompts.length; i++) void missionImage(rest.script.id, i);
  return built.script;
}

/* ----------------------------------------------------------------- finishing */

export type MissionResult = {
  lessons: Record<string, 0 | 1 | 2>;
  activity: { summary: string; strengths: string[]; focus: string[]; learning: LearningPrefs; ideas: MissionIdea[] };
};

export async function finishMission(id: string, answers: MissionAnswer[], why: MissionWhy | null): Promise<MissionResult> {
  const s = store.get(id);
  if (!s) throw new ApiError(410, "expired", "This mission has expired. Please start it again.");
  let whyLevel: { moment: string; level: 0 | 1 | 2 } | null = null;
  const k = why?.text.trim() ? s.key[why.moment] : undefined;
  if (why && k) {
    const right = k.ideas[k.correct] ?? "";
    const picked = answers.find((a) => a.moment === why.moment)?.option;
    whyLevel = { moment: why.moment, level: await judgeWhy(why.text, right, picked ? (k.ideas[k.means[picked] ?? ""] ?? "") : "") };
  }
  const { lessons, ideas } = scoreMission(s.key, answers, whyLevel, s.titles);
  const profile = missionProfile(ideas, lessons);
  return { lessons, activity: { ...profile, learning: learningFromMission(answers, why), ideas } };
}

/** How well a "why" shows the right idea: 0 none, 1 partly, 2 clearly. The model when it can, word overlap when not. */
async function judgeWhy(text: string, rightIdea: string, pickedIdea: string): Promise<0 | 1 | 2> {
  if (!geminiConfigured()) return whyByOverlap(text, rightIdea);
  try {
    const { data } = await geminiJson<{ level?: number }>({
      group: "fast",
      thinking: "low",
      deadlineMs: 8_000,
      temperature: 0,
      system: "You judge how well a learner's short explanation shows an idea about AI agents. Judge the reasoning, not spelling or wording.",
      contents: [
        {
          role: "user",
          parts: [{ text: `The accurate idea: ${rightIdea}\nThe option they picked meant: ${pickedIdea || "they were not sure"}\nTheir explanation: "${text.slice(0, 600)}"\n\nlevel 2 = their reasoning clearly matches the accurate idea; 1 = partly or vaguely; 0 = not at all, or they don't know.` }],
        },
      ],
      schema: { type: "object", properties: { level: { type: "integer", enum: [0, 1, 2] } }, required: ["level"] },
    });
    return data.level === 2 ? 2 : data.level === 1 ? 1 : 0;
  } catch {
    return whyByOverlap(text, rightIdea);
  }
}

/* ----------------------------------------------------------------- narration */

/**
 * One narration line as WAV in the audience's voice (server/voice.ts: the
 * local Kokoro model by default, kept on disk, so a line is made once). null
 * when no voice is available; the player then uses the browser's voice for
 * that line. A failed line is forgotten, so a later request tries again.
 */
export function missionVoice(id: string, key: string, lane: "now" | "later" = "now"): Promise<Buffer | null> {
  const s = store.get(id);
  const line = s ? missionLines(s.script).find((l) => l.key === key) : undefined;
  if (!s || !line || !s.script.voice) return Promise.resolve(null);
  let p = s.voices.get(key);
  // the learner is waiting for a line still queued for later: move it up
  if (p && lane === "now") void speak(line.text, s.script.audience, "now");
  if (!p) {
    p = speak(line.text, s.script.audience, lane).then((audio) => {
      if (!audio) s.voices.delete(key);
      return audio;
    });
    s.voices.set(key, p);
  }
  return p;
}

/**
 * Records the opening lines of a story ahead (the "later" lane, so anything a
 * learner is waiting for goes first). Later lines are recorded just ahead of
 * the learner: the player asks for the next line while the current one plays.
 */
async function narrateAll(id: string) {
  const s = store.get(id);
  if (!s) return;
  for (const line of missionLines(s.script).slice(0, 2)) await missionVoice(id, line.key, "later");
}

/* ----------------------------------------------------------------- scene pictures */

/** What each scene's picture is asked to show (development only, for checking the fit). */
export function missionPictures(id: string) {
  const s = store.get(id);
  return s ? { style: s.style, people: s.people, colleague: s.castLook, scenes: s.imagePrompts } : null;
}

const IMAGE_DIR = path.join(process.cwd(), ".data", "mission-images");

/**
 * The picture for one scene, generated once and kept on disk (by prompt), so
 * learners with the same story reuse it. Scenes 2 and 3 are drawn with scene
 * 1 as a reference, so the place and people stay the same. null when images
 * are unavailable; the player then shows its designed backdrop.
 */
export async function missionImage(id: string, scene: number): Promise<{ data: Buffer; mimeType: string } | null> {
  const s = store.get(id);
  if (!s || !s.script.images || scene < 0 || scene >= s.imagePrompts.length) return null;
  let p = s.images.get(scene);
  if (!p) {
    p = drawScene(s, scene).catch((e) => {
      console.error("[mission image]", e instanceof GeminiError ? `${e.status ?? ""} ${e.message.slice(0, 160)}` : e);
      return null;
    });
    s.images.set(scene, p);
  }
  return p;
}

async function drawScene(s: Stored, scene: number) {
  const prompt = [
    `${s.style}.`,
    s.imagePrompts[scene],
    `The colleague, ${s.script.cast.name}: ${s.castLook}.`,
    `Everyone looks like ${s.people}, dressed as they would be at that job.`,
    "Natural expressions and believable hands. Screens and papers show only blurred, unreadable content. No text, captions, logos or watermarks. Wide 16:9 frame.",
  ].join(" ");
  const reference = scene > 0 ? await missionImage(s.script.id, 0) : null;
  const file = path.join(IMAGE_DIR, `${createHash("sha1").update(`${prompt}|${reference ? "ref" : ""}`).digest("hex").slice(0, 20)}.png`);
  const cached = await readFile(file).catch(() => null);
  if (cached) return { data: cached, mimeType: "image/png" };
  if (!geminiImagesReady()) return null;
  const img = await geminiImage({
    prompt: reference ? `${prompt} Keep the same place, people and look as the reference picture.` : prompt,
    reference: reference ? { mimeType: reference.mimeType, data: reference.data.toString("base64") } : null,
  });
  await mkdir(IMAGE_DIR, { recursive: true });
  await writeFile(file, img.data).catch(() => undefined);
  return { data: img.data, mimeType: img.mimeType };
}
