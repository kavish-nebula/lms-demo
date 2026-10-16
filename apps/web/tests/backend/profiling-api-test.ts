// Profiling backend tests: node tests/backend/run.mjs profiling-api. In-memory database, a stand-in for the language model.
import { anthropicBody, fromAnthropic, llmConfig, llmHttp, llmModels, openAiBody, resetExhaustedModels, LlmError, type ChatRequest, type ChatResponse, type LlmTransport } from "@/server/ai/llm";
import { PROMPT_VERSION, analyseTypedField, matchByKeywords, resetAnalyseLimits } from "@/server/profiling/analyse";
import { discardDraft, finishProfile, profilingState, profilingStep } from "@/server/profiling/service";
import { changeFor, normalizeAnswers, profileLines, questionById, questionsFor, domainOf, roleLabelOf, type SetupAnswers } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";
import { getProfile, getProfileDraft, deleteUserData, saveProfileDraft } from "@/server/repo";
import { getSessionUser } from "@/server/auth";
import { courseContext } from "@/server/planner/context";
import { baselinePlan } from "@/server/planner/baseline";
import { plannerPrompt } from "@/server/planner/llm";

let failures = 0;
const check = (label: string, cond: unknown, extra?: unknown) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};
const reply = (body: unknown, finish = "stop"): ChatResponse => ({ model: "stub", choices: [{ finish_reason: finish, message: { content: typeof body === "string" ? body : JSON.stringify(body) } }] });
const req: ChatRequest = { model: "m", messages: [{ role: "system", content: "rules" }, { role: "user", content: "hi" }, { role: "user", content: "again" }], response_format: { type: "json_object" }, thinking: { type: "disabled" }, max_tokens: 100, temperature: 0.2 };

/* ---------------------------------------------------------------- provider adapters */
const official = openAiBody({ ...req, model: "gpt-5-mini" }, { baseUrl: "https://api.openai.com/v1", glm: false });
check("openai: official API takes max_completion_tokens, reasoning models no temperature", official.max_completion_tokens === 100 && !("max_tokens" in official) && !("temperature" in official) && !("thinking" in official));
const compatible = openAiBody(req, { baseUrl: "https://api.groq.com/openai/v1", glm: false });
check("openai-compatible: max_tokens and temperature, JSON mode, no GLM-only fields", compatible.max_tokens === 100 && compatible.temperature === 0.2 && (compatible.response_format as { type: string }).type === "json_object" && !("thinking" in compatible));
const gem = openAiBody(req, { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", glm: false });
check("gemini: low reasoning unless switched on, no GLM fields", gem.reasoning_effort === "low" && !("thinking" in gem) && openAiBody({ ...req, thinking: { type: "enabled" } }, { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", glm: false }).reasoning_effort === "high");
check("glm: keeps the thinking switch", "thinking" in openAiBody(req, { baseUrl: "https://api.z.ai/api/paas/v4", glm: true }));
const claude = anthropicBody(req) as { system: string; messages: { role: string; content: string }[] };
check("anthropic: system apart, same-role turns merged, JSON asked for in the system text", claude.system.startsWith("rules") && /JSON object only/.test(claude.system) && claude.messages.length === 1 && claude.messages[0]!.content === "hi\n\nagain");
const mapped = fromAnthropic({ model: "claude", content: [{ type: "text", text: '{"a":1}' }], stop_reason: "max_tokens", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 4 } });
check("anthropic: reply mapped to the OpenAI shape", mapped.choices?.[0]?.message?.content === '{"a":1}' && mapped.choices[0]!.finish_reason === "length" && mapped.usage?.prompt_tokens === 14 && mapped.usage.prompt_tokens_details?.cached_tokens === 4);
check("anthropic: a refusal reads as the content filter", fromAnthropic({ content: [], stop_reason: "refusal" }).choices?.[0]?.finish_reason === "sensitive");

const saved = { ...process.env };
process.env.LLM_API_KEY = "test";
process.env.LLM_PROVIDER = "anthropic";
let c = llmConfig();
check("config: LLM_* picks the provider, its URL and a default model", c.provider === "anthropic" && c.baseUrl === "https://api.anthropic.com" && c.model.startsWith("claude") && !c.glm && c.fallback === null);
process.env.LLM_PROVIDER = "openai";
process.env.LLM_BASE_URL = "https://api.deepseek.com/v1/";
process.env.LLM_MODEL = "deepseek-chat";
c = llmConfig();
check("config: any OpenAI-compatible API by base URL and model", c.provider === "openai" && c.baseUrl === "https://api.deepseek.com/v1" && c.model === "deepseek-chat");
for (const k of ["LLM_API_KEY", "LLM_PROVIDER", "LLM_BASE_URL", "LLM_MODEL"]) delete process.env[k];
Object.assign(process.env, saved);
c = llmConfig();
check("config: without LLM_API_KEY the GLM settings apply (no key in tests)", c.glm && c.model === "glm-4.7-flash" && c.key === null);

// a free tier's daily quota runs out: that model is skipped until it resets
process.env.LLM_API_KEY = "test";
process.env.LLM_MODEL = "main-model";
process.env.LLM_FALLBACK_MODEL = "backup-model";
const realFetch = globalThis.fetch;
globalThis.fetch = (async () =>
  new Response(JSON.stringify([{ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota. Please retry in 17h42m41.7s." } }]), { status: 429 })) as typeof fetch;
let quotaErr: unknown = null;
try {
  await llmHttp({ timeoutMs: 1000, retries: 2, backoffMs: 1 })({ ...req, model: "main-model" });
} catch (e) {
  quotaErr = e;
}
globalThis.fetch = realFetch;
check("quota: used up is reported as busy, without retrying", quotaErr instanceof LlmError && quotaErr.busy && /quota used up/.test(quotaErr.detail), quotaErr);
check("quota: the spent model goes last until it resets", llmModels().join() === "backup-model", llmModels());
resetExhaustedModels();
check("quota: back in order once reset", llmModels().join() === "main-model,backup-model");
for (const k of ["LLM_API_KEY", "LLM_MODEL", "LLM_FALLBACK_MODEL"]) delete process.env[k];

/* ---------------------------------------------------------------- typed field analysis */
check("rules: keyword match", matchByKeywords("I run a dental clinic") === "healthcare" && matchByKeywords("Logistics and warehousing") === "manufacturing" && matchByKeywords("Florist") === null);
const user = await getSessionUser();
let d = await analyseTypedField(user.id, "I run a dental clinic", null);
check("no model: the keyword match, no follow-ups", d.source === "rules" && d.field === "healthcare" && d.followUps.length === 0 && d.forField === "i run a dental clinic", d);

const calls: ChatRequest[] = [];
let script: (r: ChatRequest) => ChatResponse = () => reply({});
const stub: LlmTransport = async (r) => {
  calls.push(r);
  return script(r);
};
const vocab = { trigger: "a patient asks to book a check-up", item: "an appointment request", items: "appointment requests", junk: "a request with no date", action: "updating the clinic diary", team: "the front desk" };
script = () => reply({ field: "healthcare", confidence: 0.9, vocab, followUps: [{ q: "Ignored when a pack fits?", options: ["a", "b"] }] });
d = await analyseTypedField(user.id, "Dental clinic", stub);
check("model: confident pack, its nouns, no follow-ups", d.source === "ai" && d.field === "healthcare" && d.vocab?.trigger === vocab.trigger && d.vocab.label === "Dental clinic" && d.followUps.length === 0, d);
check("model: the typed text goes in as data, in JSON mode", calls.at(-1)!.response_format?.type === "json_object" && calls.at(-1)!.messages[1]!.content.includes('"Dental clinic"'));

script = () =>
  reply({
    field: "none",
    confidence: 0.2,
    vocab,
    followUps: [
      { q: "What do you handle most days?", options: ["Bookings", "Orders", "Bookings"] },
      { q: "How old are you", options: ["Under 30", "30+"] },
      { q: "Who do you mostly serve", options: ["Walk-in customers", "Businesses", "Online customers"] },
      { q: "Which task repeats most?", options: ["Replying to questions", "Updating records"] },
    ],
  });
d = await analyseTypedField(user.id, "Florist", stub);
check("model: no pack, up to two follow-ups; duplicates and personal questions dropped", d.field === null && d.followUps.length === 2 && d.followUps[0]!.q === "Who do you mostly serve?" && d.followUps.every((f) => !/old are you/.test(f.q)), d.followUps);
check("model: follow-up options get stable values", d.followUps[0]!.options.map((o) => o.v).join() === "o1,o2,o3");

script = () => reply({ field: "retail", confidence: 0.4, vocab: { ...vocab, trigger: "see https://evil.example" } });
d = await analyseTypedField(user.id, "Corner shop", stub);
check("model: a link in the wording drops just that wording; the rest is kept", d.source === "ai" && d.vocab === null && !d.failed, d);
script = () => reply("not json at all");
d = await analyseTypedField(user.id, "Something odd", stub);
check("model: unusable reply falls back to the rules", d.source === "rules" && d.failed === true);
calls.length = 0;
script = (r) => {
  if (r.model === "glm-4.7-flash") throw new LlmError("busy", "429");
  return reply({ field: "education", confidence: 0.8, vocab: null });
};
d = await analyseTypedField(user.id, "Driving instructor", stub);
check("model: busy main model, the fallback answers", d.field === "education" && calls.map((x) => x.model).join() === "glm-4.7-flash,glm-4.5-flash", calls.map((x) => x.model));
resetAnalyseLimits();
let limited = 0;
script = () => reply({ field: "it", confidence: 0.9, vocab: null });
for (let i = 0; i < 13; i++) if ((await analyseTypedField("limit-user", `Field ${i}`, stub)).source === "rules") limited++;
check("limit: twelve analyses an hour per learner, then rules", limited === 1, limited);

script = () =>
  reply({
    field: "none",
    confidence: 0.3,
    vocab,
    roles: [
      { label: "HSE consultant", kind: "hands-on" },
      { label: "Safety auditor", kind: "hands-on" },
      { label: "Student", kind: "hands-on" },
      { label: "Operations manager", kind: "manager" },
      { label: "HSE consultant", kind: "hands-on" },
      { label: "Safety software specialist", kind: "technical" },
    ],
    firstJobs: ["Writing risk assessments", "Logging site incidents", "Answering compliance questions", "Writing risk assessments"],
    followUps: [{ q: "Who do you mostly advise?", options: ["Construction firms", "Factories", "Offices"] }],
  });
d = await analyseTypedField(user.id, "Safety consulting", stub);
check("model (no pack): its own roles, without student/manager or repeats, mapped to the course's role texts", d.roles?.map((r) => r.label).join("|") === "HSE consultant|Safety auditor|Safety software specialist" && d.roles?.[2]?.as === "engineer" && d.roles?.[0]?.v === "r1", d.roles);
check("model (no pack): its own first jobs, without repeats", d.firstJobs?.map((j) => j.label).join("|") === "Writing risk assessments|Logging site incidents|Answering compliance questions", d.firstJobs);
const safety = d;
const sa: SetupAnswers = { domain: "other", domainOther: "Safety consulting" };
check("engine: a typed field never offers Student, even before the model answers", !questionById("role", sa).options.some((o) => o.v === "student") && questionById("role", {}).options.some((o) => o.v === "student"));
const roleOpts = questionsFor(sa, safety).find((q) => q.id === "role")!.options.map((o) => o.label);
check("engine: the model's roles, then lead, manager, something else", roleOpts.join("|") === "HSE consultant|Safety auditor|Safety software specialist|Team lead|Manager|Something else", roleOpts);
check("engine: the model's first jobs", questionsFor(sa, safety).find((q) => q.id === "firstJob")!.options[0]!.label === "Writing risk assessments");
const picked = normalizeAnswers({ ...sa, role: "r2", firstJob: "j1" }, safety);
check("engine: answers to the model's options are kept with its result, dropped without it", picked.role === "r2" && picked.firstJob === "j1" && !normalizeAnswers({ ...sa, role: "r2" }).role);
check("engine: they read naturally", roleLabelOf(picked, safety) === "a safety auditor" && changeFor(questionById("firstJob", picked, safety), picked, safety).text.includes("writing risk assessments"));

/* ---------------------------------------------------------------- the engine with a derived result */
const dental: ProfileDerived = { version: 1, forField: "dental clinic", field: "healthcare", confidence: 0.9, vocab: { label: "Dental clinic", ...vocab }, followUps: [], source: "ai", at: "2026-10-16" };
const typed: SetupAnswers = { domain: "other", domainOther: "Dental clinic" };
check("engine: a matched typed field asks its pack's questions", questionsFor(typed, dental).some((q) => q.id === "tools") && questionById("role", { ...typed, field: "healthcare" }).options[0]!.v === "clinician");
check("engine: …and stores the match with the answers", normalizeAnswers({ ...typed, role: "admin" }, dental).field === "healthcare" && normalizeAnswers({ ...typed, role: "admin" }, dental).role === "admin");
check("engine: a different typed field ignores the old result", !questionsFor({ domain: "other", domainOther: "Florist" }, dental).some((q) => q.id === "tools"));
check("engine: the field's own nouns for examples", domainOf(typed, dental)?.trigger === vocab.trigger && domainOf(typed, null)?.trigger !== vocab.trigger);
const florist: ProfileDerived = { version: 1, forField: "florist", field: null, confidence: 0.2, vocab: null, followUps: [{ id: "fu1", q: "Who do you mostly serve?", options: [{ v: "o1", label: "Walk-in customers" }, { v: "o2", label: "Businesses" }] }], source: "ai", at: "2026-10-16" };
const fa: SetupAnswers = { domain: "other", domainOther: "Florist", extra: { fu1: "o2", fu9: "o1" } };
const ids = questionsFor(fa, florist).map((q) => q.id);
check("engine: follow-ups are asked just before the goal", ids.indexOf("fu:fu1") === ids.indexOf("goal") - 1, ids);
check("engine: follow-up answers kept, unknown ones dropped", JSON.stringify(normalizeAnswers(fa, florist).extra) === '{"fu1":"o2"}');
check("engine: follow-up answers reach the planner's profile lines", profileLines(fa, florist).some((l) => l.label === "Who do you mostly serve?" && l.answer === "Businesses"));

/* ---------------------------------------------------------------- drafts, finishing */
await deleteUserData(user.id);
calls.length = 0;
script = () => reply({ field: "healthcare", confidence: 0.9, vocab });
let v = await profilingStep(user.id, { answers: { domain: "other", domainOther: "Dental clinic", studyLevel: "undergrad" }, needs: [] }, stub);
check("step: a new typed field is analysed and its pack's questions come back", calls.length === 1 && v.derived?.field === "healthcare" && v.questions.some((q) => q.id === "tools") && !v.answers.studyLevel, v.questions.map((q) => q.id));
check("step: the draft is saved", (await getProfileDraft(user.id))?.answers.field === "healthcare");
v = await profilingStep(user.id, { answers: { domain: "other", domainOther: "Dental clinic", role: "admin" }, needs: ["text"] }, stub);
check("step: the same field is not analysed again", calls.length === 1 && v.answers.role === "admin");
check("state: resumes the draft", (await profilingState(user.id))?.answers.role === "admin" && (await profilingState(user.id))?.needs.join() === "text");
const profile = await finishProfile(user.id, { answers: { domain: "other", domainOther: "Dental clinic", role: "admin", tools: ["scheduling"] }, needs: ["text"] }, stub);
check("finish: the profile keeps the derived result and the pack's answers", profile.derived?.field === "healthcare" && profile.answers.field === "healthcare" && profile.answers.tools?.join() === "scheduling", profile.answers);
check("finish: the draft is gone", (await getProfileDraft(user.id)) === null);
check("state: then shows the saved profile", (await profilingState(user.id))?.derived?.vocab?.team === "the front desk");
await finishProfile(user.id, { answers: { domain: "other", domainOther: "Florist" }, needs: [] }, null);
check("finish: a changed typed field is analysed again (rules without a model)", (await getProfile(user.id))?.derived?.forField === "florist");

calls.length = 0;
script = () => reply("not json");
await profilingStep(user.id, { answers: { domain: "other", domainOther: "Beekeeper" }, needs: [] }, stub);
await profilingStep(user.id, { answers: { domain: "other", domainOther: "Beekeeper", role: "other" }, needs: [] }, stub);
check("retry: a failed analysis is not repeated straight away", calls.length === 1, calls.length);
calls.length = 0;
script = () => reply({ field: "healthcare", confidence: 0.9, vocab });
await profilingStep(user.id, { answers: { domain: "other", domainOther: "Dental clinic" }, needs: [] }, stub);
const fresh = (await getProfileDraft(user.id))!.derived!;
await saveProfileDraft(user.id, { domain: "other", domainOther: "Dental clinic" }, [], { ...fresh, prompt: undefined });
await profilingStep(user.id, { answers: { domain: "other", domainOther: "Dental clinic", role: "admin" }, needs: [] }, stub);
check("refresh: a result from older instructions is redone once", calls.length === 2 && (await getProfileDraft(user.id))!.derived!.prompt === PROMPT_VERSION, calls.length);
check("discard: there is a draft to discard", (await getProfileDraft(user.id)) !== null);
await discardDraft(user.id);
check("discard: the draft is gone, the profile stays", (await getProfileDraft(user.id)) === null && (await getProfile(user.id)) !== null);

/* ---------------------------------------------------------------- the plan uses it */
const ctx = await courseContext("ai-agent");
const plan = baselinePlan({ name: "Kavish", answers: { ...typed, field: "healthcare", role: "admin" }, supportOverride: "auto", pace: null, precheck: null, derived: dental }, ctx);
const world = plan.modules[0]!.lessons[0]!.inYourWorld.body;
check("plan: 'In your world' uses the field's own nouns", world.includes("appointment request") || world.includes("front desk") || world.includes("check-up"), world);
const prompt = plannerPrompt({ ctx, input: { name: "Kavish", answers: fa, supportOverride: "auto", pace: null, precheck: null, derived: florist }, previous: null, evidence: [], trigger: "enrol" }).user;
check("plan: the AI planner sees the follow-up answers", prompt.includes("Who do you mostly serve?: Businesses"), prompt.slice(0, 600));

console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
