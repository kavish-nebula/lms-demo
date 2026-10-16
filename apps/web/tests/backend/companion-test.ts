// Companion (Pip) tests: node tests/backend/run.mjs companion. A stand-in replaces the GLM API.
import { askCompanion, companionMessages, plain, resetCompanionLimits, type CompanionRequest } from "@/server/companion/service";
import { companionContext, matchesAssessment } from "@/server/companion/context";
import { LlmError, type ChatRequest, type ChatResponse, type LlmTransport } from "@/server/ai/llm";
import { relatedPassages } from "@/lib/companion";
import { getFinale } from "@/data";

let failures = 0;
const check = (label: string, cond: unknown, extra?: unknown) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};

const ctx = (await companionContext("ai-agent"))!;
console.log(`context: ${ctx.passages.length} passages, ${ctx.assessments.length} assessment stems, outline ${ctx.outline.length} chars`);
check("context: unknown course is null", (await companionContext("nope")) === null);
check("context: outline lists every module by its label", ["Agent basics", "LLM essentials", "Launch & improve"].every((t) => ctx.outline.includes(t)), ctx.outline.slice(0, 400));
check("context: outline stays small enough to send every time", ctx.outline.length < 12000, ctx.outline.length);
check("context: knows the assessment questions", ctx.assessments.length > 10);

const finalStem = (await getFinale("ai-agent"))!.final.items.find((i) => i.stem.split(" ").length >= 8)!.stem;
check("guard: a pasted final question is recognised", matchesAssessment(`Can you answer this? ${finalStem}`, ctx), finalStem);
check("guard: an ordinary question is not", !matchesAssessment("What is the difference between an agent and a chatbot?", ctx));
check("guard: quick check questions stay askable in lessons", !matchesAssessment("What makes an AI agent different from a chatbot?", ctx));

const calls: ChatRequest[] = [];
let script: (req: ChatRequest) => ChatResponse | Promise<ChatResponse> = () => reply({ reply: "An agent decides its next step itself.", scope: "course", source: 1 });
const stub: LlmTransport = async (req) => {
  calls.push(req);
  return script(req);
};
function reply(body: unknown, finish = "stop"): ChatResponse {
  return { model: "stub", choices: [{ finish_reason: finish, message: { content: typeof body === "string" ? body : JSON.stringify(body) } }] };
}
const base: CompanionRequest = { message: "What makes an agent different from a chatbot?", phase: "explainer", moduleId: "m1", history: [] };

// restricted phases and quick buttons never reach the model, whatever the browser says
let r = await askCompanion("u1", "ai-agent", { ...base, phase: "final-check" }, stub);
check("final check: process guidance only, no model call", calls.length === 0 && r.mode === "basic" && /independently/.test(r.text), r);
r = await askCompanion("u1", "ai-agent", { ...base, phase: "gate", message: "what is an agent" }, stub);
check("module check: no model call", calls.length === 0 && r.mode === "basic");
r = await askCompanion("u1", "ai-agent", { ...base, message: "Hint", step: { hint: "Look at who picks the next action." } }, stub);
check("hint button: the step's hint, no model call", calls.length === 0 && r.text === "Look at who picks the next action.", r);
r = await askCompanion("u1", "ai-agent", { ...base, message: finalStem }, stub);
check("pasted final question in a lesson: refused, no model call", calls.length === 0 && /leave it to you/.test(r.text), r);

// a real question: course context goes to the model, the answer and its source come back
r = await askCompanion("u1", "ai-agent", base, stub);
const sent = calls.at(-1)!;
check("question: one model call in JSON mode", calls.length === 1 && sent.response_format?.type === "json_object");
check("question: system prompt carries the scope rules and outline", /only help with this course/.test(sent.messages[0]!.content) && sent.messages[0]!.content.includes("COURSE OUTLINE") && sent.messages[0]!.content.includes("Agent basics"));
check("question: the user turn carries where they are, material and the question", /WHERE THE LEARNER IS[\s\S]*COURSE MATERIAL[\s\S]*\[1\][\s\S]*LEARNER'S QUESTION\nWhat makes an agent/.test(sent.messages.at(-1)!.content), sent.messages.at(-1)!.content.slice(0, 600));
check("question: AI answer with a link to the passage it used", r.mode === "ai" && r.text.startsWith("An agent") && !!r.source?.href.startsWith("/learn/courses/ai-agent/"), r);
check("prompt: the instructions never name a provider", !/glm|z\.ai|zhipu|openai|anthropic/i.test(sent.messages[0]!.content.split("COURSE OUTLINE")[0]!));

// the system prompt is identical across questions and learners, so the provider can cache it
const other = companionMessages({ ...base, message: "How do tools work?", moduleId: "m3" }, ctx, []);
check("prompt: system message is the same for every question", other[0]!.content === sent.messages[0]!.content);

// history is passed through as turns
calls.length = 0;
await askCompanion("u1", "ai-agent", { ...base, message: "And why does that matter?", history: [{ role: "user", text: "What is an agent?" }, { role: "assistant", text: "Software that picks its own next step." }] }, stub);
check("follow-up: earlier turns are sent before the question", calls[0]!.messages.length === 4 && calls[0]!.messages[1]!.content === "What is an agent?" && calls[0]!.messages[2]!.role === "assistant");

// off-topic: the model's decline is shown without a source
script = () => reply({ reply: "I can only help with this course. Want to look at how agents pick tools?", scope: "off_topic", source: 2 });
r = await askCompanion("u1", "ai-agent", { ...base, message: "Who won the football last night?" }, stub);
check("off topic: polite decline, no source", r.mode === "ai" && /only help with this course/.test(r.text) && !r.source, r);

// formatting the model added anyway is stripped; plain text and fenced JSON are tolerated
check("plain: markdown and links removed", plain("## Title\n**Bold** see [docs](https://x.y) and https://evil.example\n- item") === "Title\nBold see docs and \n· item", plain("## Title\n**Bold** see [docs](https://x.y) and https://evil.example\n- item"));
script = () => reply("```json\n{\"reply\": \"Fenced works.\", \"scope\": \"course\", \"source\": null}\n```");
r = await askCompanion("u1", "ai-agent", base, stub);
check("reply: fenced JSON accepted", r.text === "Fenced works." && !r.source, r);
script = () => reply("Just some plain text.");
r = await askCompanion("u1", "ai-agent", base, stub);
check("reply: plain text accepted", r.text === "Just some plain text.", r);
script = () => reply({ reply: "Uses a bad source.", scope: "course", source: 99 });
r = await askCompanion("u1", "ai-agent", base, stub);
check("reply: an out-of-range source is dropped", r.text === "Uses a bad source." && !r.source, r);
script = () => reply("", "sensitive");
r = await askCompanion("u1", "ai-agent", base, stub);
check("content filter: a course-only decline", /only help with this course/.test(r.text), r);

// GLM trouble: busy tries the fallback model, then the offline answer
calls.length = 0;
script = (req) => {
  if (req.model === "glm-4.7-flash") throw new LlmError("busy", "429");
  return reply({ reply: "From the fallback.", scope: "course", source: null });
};
r = await askCompanion("u1", "ai-agent", base, stub);
check("busy: the fallback model answers", r.text === "From the fallback." && calls.map((c) => c.model).join() === "glm-4.7-flash,glm-4.5-flash", calls.map((c) => c.model));
script = () => {
  throw new LlmError("rejected", "401");
};
r = await askCompanion("u1", "ai-agent", { ...base, message: "What is an agent?" }, stub);
check("key rejected: offline passage answer instead of an error", r.mode === "basic" && r.text.length > 20, r);
r = await askCompanion("u1", "ai-agent", { ...base, message: "What is an agent?" }, null);
check("no key: offline passage answer", r.mode === "basic" && r.text.length > 20, r);

// retrieval puts the slide on screen first, even when the question shares no words with it
const slide = ctx.passages.find((p) => p.slideTitle && p.videoId)!;
const near = relatedPassages("why does this matter", ctx.passages, { moduleId: slide.moduleId, videoId: slide.videoId, slideTitle: slide.slideTitle });
check("retrieval: the slide on screen is included", near[0]?.slideTitle === slide.slideTitle, near.map((p) => p.title));
check("retrieval: at most six passages", relatedPassages("agent tool memory prompt llm", ctx.passages, {}).length <= 6);

// rate limit: each learner gets 20 model calls in five minutes
resetCompanionLimits();
script = () => reply({ reply: "ok", scope: "course", source: null });
let limited: unknown = null;
for (let i = 0; i < 21; i++) {
  try {
    await askCompanion("u2", "ai-agent", base, stub);
  } catch (e) {
    limited = e;
  }
}
check("rate limit: the 21st message in five minutes is refused", (limited as { status?: number } | null)?.status === 429, limited);
let fine = true;
try {
  await askCompanion("u3", "ai-agent", base, stub);
} catch {
  fine = false;
}
check("rate limit: per learner", fine);

let unknown: unknown = null;
try {
  await askCompanion("u1", "nope", base, stub);
} catch (e) {
  unknown = e;
}
check("unknown course: 404", (unknown as { status?: number } | null)?.status === 404);

console.log("\nSYSTEM PROMPT SAMPLE (outline, first lines):\n" + ctx.outline.split("\n").slice(0, 12).join("\n"));
console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
