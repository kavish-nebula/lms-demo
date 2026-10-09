import "server-only";
import { QUESTIONS, answerLabel } from "@/lib/setup";
import { LearnerPlanSchema, type LearnerPlan, type PlanVersion } from "@/lib/learner-plan";
import type { ContextModule, CourseContext } from "./context";
import type { PlannerInput } from "./baseline";

/**
 * GLM (Z.ai) writes the learner's plan. The API is OpenAI-style chat
 * completions in JSON mode; it does not enforce a schema, so the prompt
 * carries a reply template with the course's real ids (smaller models copy a
 * raw JSON Schema back instead of filling it in), the reply is checked
 * against the schema here, and one correction round is allowed. validate.ts
 * then checks the plan against the real course. The instructions, template
 * and course outline are identical for every learner and sent first, so the
 * provider's context cache can reuse them. While the main model is
 * overloaded, the fallback model is tried.
 */

const DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";
/** Free on Z.ai, so a new key works at once; set GLM_MODEL (e.g. glm-5.3) for the paid flagship. */
const DEFAULT_MODEL = "glm-4.7-flash";
/** Also free; used while the main model is overloaded (the free tier often answers 429). */
const DEFAULT_FALLBACK = "glm-4.5-flash";

export const plannerModel = () => process.env.GLM_MODEL?.trim() || DEFAULT_MODEL;
/** The models to try in order: GLM_MODEL, then GLM_FALLBACK_MODEL ("none" turns the fallback off). */
function models(): string[] {
  const fallback = process.env.GLM_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK;
  return [...new Set([plannerModel(), ...(fallback.toLowerCase() === "none" ? [] : [fallback])])];
}
const baseUrl = () => (process.env.GLM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
export const aiConfigured = () => Boolean(process.env.GLM_API_KEY?.trim());
/** Thinking makes GLM several times slower (minutes on the flash models); off unless GLM_THINKING=enabled. */
const thinking = (): "enabled" | "disabled" => (process.env.GLM_THINKING?.trim().toLowerCase() === "enabled" ? "enabled" : "disabled");

/**
 * Why no AI plan was written. `message` is shown to the learner, so it never
 * names the provider; `detail` is the operator's version, for the server log.
 * `busy` marks overload, where another model may still answer.
 */
export class PlannerError extends Error {
  constructor(
    message: string,
    readonly detail: string = message,
    readonly busy = false,
  ) {
    super(message);
  }
}

const UNAVAILABLE = "AI planning isn't available right now.";
const BUSY = "The AI planner is busy right now.";
const INCOMPLETE = "The AI plan came back incomplete.";

export type SignalNote = { at: string; kind: string; moduleId: string | null; lesson: string | null; payload: Record<string, unknown> };

export type PlannerRequest = {
  ctx: CourseContext;
  input: PlannerInput;
  previous: { version: number; plan: LearnerPlan } | null;
  evidence: SignalNote[];
  trigger: PlanVersion["trigger"];
};

export type PlannerResult = { plan: LearnerPlan; model: string; usage: Record<string, number> };

type Message = { role: "system" | "user" | "assistant"; content: string };
export type ChatRequest = {
  model: string;
  messages: Message[];
  response_format: { type: "json_object" };
  thinking: { type: "enabled" | "disabled" };
  max_tokens: number;
  temperature: number;
};
export type ChatResponse = {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
};

/** One chat-completion call. The default goes over HTTP; tests pass a stand-in. */
export type PlannerTransport = (req: ChatRequest) => Promise<ChatResponse>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const httpTransport: PlannerTransport = async (req) => {
  const key = process.env.GLM_API_KEY?.trim();
  if (!key) throw new PlannerError(UNAVAILABLE, "GLM_API_KEY is not set.");
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (e) {
      if (attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw new PlannerError(BUSY, `Couldn't reach the GLM API: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    if (res.ok) return (await res.json()) as ChatResponse;
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string | number; message?: string } };
    const code = String(body.error?.code ?? "");
    const detail = `GLM API error ${res.status} (${req.model}): ${body.error?.message ?? res.statusText}`;
    if (res.status === 401) throw new PlannerError(UNAVAILABLE, "The GLM API key was rejected.");
    if (code === "1113") throw new PlannerError(UNAVAILABLE, `The GLM account has no balance for ${req.model}. Recharge it, or use a free model such as glm-4.7-flash (GLM_MODEL).`);
    if (code === "1211") throw new PlannerError(UNAVAILABLE, `GLM doesn't know the model "${req.model}". Check GLM_MODEL.`);
    // the free models answer 429 while overloaded; after two waits, generatePlan tries the fallback model
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 2) {
        await sleep(4000 * 2 ** attempt);
        continue;
      }
      throw new PlannerError(BUSY, detail, true);
    }
    throw new PlannerError(UNAVAILABLE, detail);
  }
};

const INSTRUCTIONS = `You are the course planner for Nebula KnowLab, an online learning platform. You write one learner's plan for one course: the order they take each module's topics in, how much help each lesson gives, how much attention each module deserves, their pacing, and short personalised text. The learner reads everything you write, addressed to them as "you". Write plainly and warmly, and be specific; no marketing tone.

What you decide:
- topicOrder for each module: include every topic id of the module, written or coming soon. The opening scenario (hook) stays first; the module check (gate) and then the recall topic (review) stay last. You may reorder the topics in between, for example putting the worked example (worked) before the explanation (explainer) for someone who learns best from examples.
- support for each lesson and module: light, standard or extra. Base it on evidence: the quick check (as a starting point, 0 of 2 right suggests extra, 2 of 2 suggests light; a score for a module covers every lesson in it), their stated experience, and their answers inside lessons once those arrive. Each "why" is one sentence citing the evidence.
- emphasis for each module: skim, standard or deep, from their goal, role and gaps.
- hookScene: only for modules that have an opening scenario. Retell its stakes in two or three sentences from the learner's role and field. Keep the scenario's facts (the company, the people, what went wrong) as the course outline gives them; reframe them, do not invent new events or numbers. Null for modules without one.
- inYourWorld for every lesson: apply that lesson's key idea to the learner's own field and role with a concrete, realistic example from their work that they would recognise. Never contradict the lesson. With no field given, use a general workplace example.
- capstoneBrief: how to approach the capstone project given their role.
- pacing: sessions per week and minutes per session that fit their stated pace and goal.
- summary: two or three sentences on how the course is tuned for them and why.

Rules:
- Use only ids from the course outline. Every module and every lesson appears, in outline order.
- You change order, help, emphasis and framing only. Never change what is taught, graded or required.
- No links. No promises about results. Do not mention AI, models or "the planner".
- Reply with the plan itself as one JSON object shaped exactly like the REPLY TEMPLATE: the same keys, every module and lesson, each <placeholder> replaced by your text and each "a | b | c" by one of those values. Never return the template or a schema.
- Revising a plan: start from the previous plan, change only what the new evidence supports, and list each change in "changes" with a reason that cites the evidence. If nothing warrants a change, return the previous plan with an empty "changes" list.`;

/** The reply's shape with this course's ids filled in; the outline's topic order is the starting point. */
function replyTemplate(modules: ContextModule[]): string {
  const support = "light | standard | extra";
  return JSON.stringify({
    summary: "<two or three sentences to the learner: how the course is tuned for them and why>",
    learner: { level: "new | some | confident", strengths: ["<short phrase, up to three>"], gaps: ["<short phrase, up to three>"] },
    pacing: { minutesPerSession: "<whole number, 10 to 90>", sessionsPerWeek: "<whole number, 1 to 7>", note: "<one sentence>" },
    modules: modules.map((m) => ({
      moduleId: m.id,
      emphasis: "skim | standard | deep",
      why: "<one sentence citing the evidence>",
      topicOrder: m.stages,
      support,
      hookScene: m.hasHook ? "<two or three sentences>" : null,
      lessons: m.lessons.map((l) => ({
        lessonId: l.id,
        support,
        why: "<one sentence citing the evidence>",
        inYourWorld: { title: "<under 8 words>", body: "<two or three sentences>" },
      })),
    })),
    capstoneBrief: "<two or three sentences>",
    changes: [{ target: "<what changed, such as lesson 2.3 help>", from: "<before>", to: "<after>", reason: "<one sentence citing the evidence>" }],
  });
}

const templates = new Map<string, string>();
function templateFor(ctx: CourseContext): string {
  let t = templates.get(ctx.courseId);
  if (!t) templates.set(ctx.courseId, (t = replyTemplate(ctx.modules)));
  return t;
}

function learnerText(req: PlannerRequest): string {
  const { input, previous, evidence, trigger } = req;
  const lines: string[] = ["LEARNER", `Name: ${input.name}`, "Profile answers:"];
  for (const q of QUESTIONS) lines.push(`- ${q.label}: ${answerLabel(q, input.answers) ?? "not answered"}`);
  lines.push(`Help level set by the learner: ${input.supportOverride === "auto" ? "automatic (decide it)" : input.supportOverride}`);
  lines.push(input.pace ? `Study pace they chose: ${input.pace.studyDays.length} days a week, ${input.pace.sessionMinutes} minutes a session` : "Study pace: not set");

  const p = input.precheck;
  if (!p || p.skipped) lines.push("Quick check: skipped");
  else if (p.isNew) lines.push("Quick check: they said they are completely new to this");
  else {
    lines.push(`Quick check (right answers out of 2, per lesson, or per module where a bare number names the module): ${Object.entries(p.lessons).map(([l, n]) => `${l.includes(".") ? "lesson" : "module"} ${l}: ${n}`).join(", ")}`);
    const dunno = Object.entries(p.responses ?? {}).filter(([, v]) => v === null).map(([k]) => k);
    if (dunno.length) lines.push(`Answered "I don't know yet" on: ${dunno.join(", ")}`);
  }

  if (previous) {
    lines.push("", `PREVIOUS PLAN (version ${previous.version}):`, JSON.stringify(previous.plan));
    lines.push("", "NEW EVIDENCE since that plan:");
    if (!evidence.length) lines.push(`- none; the learner changed their setup (${trigger})`);
    for (const e of evidence) lines.push(`- ${e.at.slice(0, 16).replace("T", " ")} ${describe(e)}`);
    lines.push("", "TASK: Revise the plan. Reply with the JSON object only.");
  } else lines.push("", "TASK: Write this learner's first plan. Reply with the JSON object only.");
  return lines.join("\n");
}

function describe(e: SignalNote): string {
  const p = e.payload;
  const where = [e.moduleId, e.lesson && `lesson ${e.lesson}`].filter(Boolean).join(", ");
  switch (e.kind) {
    case "video_check":
      return `in-video check (${where}, ${p.videoId} ${p.questionId}): ${p.correct ? "right" : "wrong"}${Number(p.attempt) > 1 ? ` on attempt ${p.attempt}` : ""}`;
    case "topic_complete":
      return `finished topic ${p.stage} (${where})`;
    case "module_complete":
      return `finished every written topic in ${e.moduleId}`;
    case "scenario_answer":
      return `scenario decision (${where}, ${p.scenarioId}): ${p.correct ? "right" : "wrong"} on the first try`;
    case "module_check":
      return `module check for ${e.moduleId}: ${p.score}/${p.total}, ${p.passed ? "passed" : "not passed"}${Array.isArray(p.missedLessons) && p.missedLessons.length ? `; weak on lessons ${p.missedLessons.join(", ")}` : ""}`;
    case "recall_answer":
      return `recall question (${where}, ${p.variantId}): ${p.correct === undefined ? "" : p.correct ? "right" : "wrong"}${p.rating ? `self-rated "${p.rating === "got" ? "got it" : "not yet"}"` : ""}`;
    case "final_check":
      return `final check: ${p.score}/${p.total}, ${p.passed ? "passed" : "not passed"}${Array.isArray(p.missedLessons) && p.missedLessons.length ? `; weak on ${p.missedLessons.map((k: string) => (k.includes(".") ? `lesson ${k}` : `module ${k}`)).join(", ")}` : ""}`;
    case "capstone_check":
      return `mini project tests: ${p.score}/${p.total} checks, ${p.passed ? "passed" : "not passed"}${Array.isArray(p.missedLessons) && p.missedLessons.length ? `; weak on lessons ${p.missedLessons.join(", ")}` : ""}${p.criticalFailed ? "; did not hand off an email that tried to change its rules" : ""}`;
    default:
      return `${e.kind} (${where}) ${JSON.stringify(p)}`;
  }
}

/** JSON mode usually returns bare JSON; tolerate a fenced block, leading prose, or the plan wrapped in one key. */
function parseJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const body = (fenced ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in the reply");
  const value: unknown = JSON.parse(body.slice(start, end + 1));
  if (value && typeof value === "object" && !("modules" in value)) {
    const inner = Object.values(value);
    if (inner.length === 1 && inner[0] && typeof inner[0] === "object" && "modules" in inner[0]) return inner[0];
  }
  return value;
}

/** The template shows numbers as placeholders, so replies sometimes quote them. */
function repair(value: unknown): unknown {
  const pacing = (value as { pacing?: unknown } | null)?.pacing;
  if (pacing && typeof pacing === "object") {
    const p = pacing as Record<string, unknown>;
    for (const k of ["minutesPerSession", "sessionsPerWeek"]) {
      const n = typeof p[k] === "string" ? Number.parseInt(p[k], 10) : Number.NaN;
      if (Number.isFinite(n)) p[k] = n;
    }
  }
  return value;
}

const echoedSchema = (text: string) => /"\$schema"|"properties"\s*:/.test(text);

export async function generatePlan(req: PlannerRequest, transport: PlannerTransport = httpTransport): Promise<PlannerResult> {
  const queue = models();
  let model = queue.shift()!;
  const messages: Message[] = [
    { role: "system", content: `${INSTRUCTIONS}\n\nREPLY TEMPLATE\n${templateFor(req.ctx)}\n\nCOURSE OUTLINE\n${req.ctx.text}` },
    { role: "user", content: learnerText(req) },
  ];
  const usage = { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, rounds: 0 };

  for (let round = 1; round <= 2; round++) {
    let res: ChatResponse;
    try {
      res = await transport({ model, messages, response_format: { type: "json_object" }, thinking: { type: thinking() }, max_tokens: 16000, temperature: 0.4 });
    } catch (e) {
      if (!(e instanceof PlannerError && e.busy && queue.length)) throw e;
      console.warn(`[planner] ${e.detail}; trying ${queue[0]}`);
      model = queue.shift()!;
      round--;
      continue;
    }
    usage.rounds = round;
    usage.prompt_tokens += res.usage?.prompt_tokens ?? 0;
    usage.completion_tokens += res.usage?.completion_tokens ?? 0;
    usage.cached_tokens += res.usage?.prompt_tokens_details?.cached_tokens ?? 0;

    const choice = res.choices?.[0];
    if (!choice?.message) throw new PlannerError(INCOMPLETE, `GLM (${model}) returned no answer.`);
    if (choice.finish_reason === "sensitive") throw new PlannerError("The AI planner declined to write this plan.", `GLM's content filter stopped the reply (${model}).`);
    if (choice.finish_reason === "length") throw new PlannerError(INCOMPLETE, `The reply was cut off at max_tokens (${model}).`);
    const text = choice.message.content ?? "";

    let problem: string;
    try {
      const parsed = LearnerPlanSchema.safeParse(repair(parseJson(text)));
      if (parsed.success) return { plan: parsed.data, model: res.model ?? model, usage };
      problem = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (e) {
      problem = e instanceof Error ? e.message : "not valid JSON";
    }
    const excerpt = text.slice(0, 240).replace(/\s+/g, " ");
    if (round === 2) throw new PlannerError(INCOMPLETE, `The reply did not match the template twice (${model}): ${problem}. It began: ${excerpt}`);
    console.warn(`[planner] reply rejected (${model}, asking again): ${problem}. It began: ${excerpt}`);
    const fix = echoedSchema(text)
      ? "That reply is a schema, not a plan. Write this learner's plan itself, shaped like the REPLY TEMPLATE with every placeholder filled in."
      : `That reply does not match the REPLY TEMPLATE: ${problem}. Reply again with the corrected JSON object only.`;
    messages.push({ role: "assistant", content: text }, { role: "user", content: fix });
  }
  throw new PlannerError(INCOMPLETE);
}

/** For tests: the exact text GLM receives. */
export const plannerPrompt = (req: PlannerRequest) => ({ system: [INSTRUCTIONS, templateFor(req.ctx), req.ctx.text], user: learnerText(req) });
