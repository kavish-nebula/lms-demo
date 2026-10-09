// Backend tests: node tests/backend/run.mjs (bundles with esbuild, in-memory PGlite, a stand-in for the GLM API).
import { courseContext } from "@/server/planner/context";
import { baselinePlan, type PlannerInput } from "@/server/planner/baseline";
import { validatePlan } from "@/server/planner/validate";
import { replanReason, ruleRevision } from "@/server/planner/policy";
import { PlannerError, plannerPrompt, type ChatRequest, type ChatResponse, type PlannerTransport } from "@/server/planner/llm";
import { saveSetup, recordSignals, recordProgress, planHistory, enrollmentOf } from "@/server/planner/service";
import { getSessionUser } from "@/server/auth";
import { LearnerPlanSchema, type LearnerPlan } from "@/lib/learner-plan";
import type { SignalRow } from "@/server/repo";

let failures = 0;
const check = (label: string, cond: unknown, extra?: unknown) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};

const ctx = await courseContext("n8n");
console.log(`context: ${ctx.modules.length} modules, ${ctx.text.length} chars`);
check("context lists every module", ctx.modules.map((m) => m.id).join() === "m1,m2,m3,m4,m5");

/* ---------------------------------------------------------------- baseline */
const engineer: PlannerInput = {
  name: "Kavish",
  answers: { domain: "it", role: "engineer", experience: "regularly", firstStep: "example", style: "short", goal: "work" },
  supportOverride: "auto",
  pace: { sessionMinutes: 20, studyDays: [1, 3] },
  precheck: { at: "2026-10-08", lessons: { "1.1": 2, "1.2": 2, "1.3": 2, "2.1": 0, "2.2": 1, "2.3": 2 } },
};
const beginner: PlannerInput = {
  name: "Kavish",
  answers: { domain: "retail", role: "student", experience: "never", firstStep: "idea" },
  supportOverride: "auto",
  pace: null,
  precheck: { at: "2026-10-08", isNew: true, lessons: { "1.1": 0, "1.2": 0, "1.3": 0, "2.1": 0, "2.2": 0, "2.3": 0 } },
};
const blank: PlannerInput = { name: "Kavish", answers: {}, supportOverride: "auto", pace: null, precheck: null };

const b1 = baselinePlan(engineer, ctx);
const b2 = baselinePlan(beginner, ctx);
const b3 = baselinePlan(blank, ctx);
for (const [n, p] of [["engineer", b1], ["beginner", b2], ["blank", b3]] as const) check(`baseline (${n}) matches the plan schema`, LearnerPlanSchema.safeParse(p).success);
const m1 = b1.modules.find((m) => m.moduleId === "m1")!;
check("example-first learner: worked before explainer in m1", m1.topicOrder.indexOf("worked") < m1.topicOrder.indexOf("explainer"), m1.topicOrder);
check("quick check 2/2 → light help on 1.1", m1.lessons.find((l) => l.lessonId === "1.1")!.support === "light");
check("quick check 0/2 → extra help on 2.1", b1.modules[1]!.lessons.find((l) => l.lessonId === "2.1")!.support === "extra");
check("IT field → an 'In your world' for 1.1", b1.modules[0]!.lessons[0]!.inYourWorld.body.includes("ticket"), b1.modules[0]!.lessons[0]);
check("no template for 3.1 → empty 'In your world'", b1.modules[2]!.lessons[0]!.inYourWorld.body === "");
check("engineer hook line on m1", !!m1.hookScene?.includes("7 AM"), m1.hookScene);
check("beginner (completely new) → extra everywhere", b2.modules.slice(0, 2).every((m) => m.lessons.every((l) => l.support === "extra")));
check("beginner level 'new'", b2.learner.level === "new");
check("engineer pacing from chosen pace", b1.pacing.minutesPerSession === 20 && b1.pacing.sessionsPerWeek === 2, b1.pacing);
check("blank profile → standard, idea first", b3.modules[0]!.topicOrder.indexOf("explainer") < b3.modules[0]!.topicOrder.indexOf("worked") && b3.learner.level === "some");
console.log("  summary (engineer):", b1.summary);

/* ---------------------------------------------------------------- validator */
const bad: LearnerPlan = structuredClone(b1);
bad.summary = "Visit https://evil.example.com now. " + "x".repeat(900);
bad.modules[0]!.topicOrder = ["review", "hook", "explainer", "worked", "guided"];
bad.modules[1]!.lessons = bad.modules[1]!.lessons.filter((l) => l.lessonId !== "2.2");
bad.modules[2]!.lessons.push({ lessonId: "9.9", support: "light", why: "x", inYourWorld: { title: "", body: "" } });
bad.modules.push({ ...bad.modules[0]!, moduleId: "m9" });
bad.pacing.minutesPerSession = 500;
const v = validatePlan(bad, ctx, b1);
check("validator: bad topic order replaced", v.plan.modules[0]!.topicOrder.join() === m1.topicOrder.join(), v.plan.modules[0]!.topicOrder);
check("validator: missing lesson 2.2 restored from baseline", v.plan.modules[1]!.lessons.some((l) => l.lessonId === "2.2"));
check("validator: unknown lesson and module dropped", !v.plan.modules[2]!.lessons.some((l) => l.lessonId === "9.9") && v.plan.modules.length === 5);
check("validator: links stripped and text capped", !v.plan.summary.includes("http") && v.plan.summary.length <= 600);
check("validator: pacing clamped", v.plan.pacing.minutesPerSession === 90);
check("validator: issues reported", v.issues.length >= 4, v.issues);

/* ---------------------------------------------------------------- policy */
const sig = (kind: string, lesson: string | null, payload: Record<string, unknown>, moduleId: string | null = "m2"): SignalRow => ({
  id: crypto.randomUUID(),
  enrollmentId: "e",
  kind,
  moduleId,
  lesson,
  payload,
  idempotencyKey: crypto.randomUUID(),
  usedInPlanVersion: null,
  createdAt: new Date(),
});
const w1 = sig("video_check", "2.1", { correct: false });
const w2 = sig("video_check", "2.1", { correct: false });
check("policy: one miss is not enough", replanReason([w1], [w1]) === null);
check("policy: two misses in one lesson re-plan", replanReason([w2], [w1, w2]) === "two misses in lesson 2.1");
check("policy: failed final check re-plans", replanReason([sig("final_check", null, { passed: false })], []) === "final check not passed");
check("policy: module complete re-plans", replanReason([sig("module_complete", null, {}, "m1")], []) === "finished m1");
const rr = ruleRevision(b3, [w1, w2]);
check("rules: two misses → extra help on 2.1 with a reason", rr?.modules[1]!.lessons.find((l) => l.lessonId === "2.1")!.support === "extra" && rr.changes.length === 1, rr?.changes);

/* ---------------------------------------------------------------- service, stub GLM */
const user = await getSessionUser();
check("demo user seeded", user.name === "Kavish", user);

const calls: { system: string; user: string }[] = [];
let mode: "ok" | "badorder" | "refuse" | "badjson" | "busy" = "ok";
const reply = (model: string, content: string, finish = "stop"): ChatResponse => ({
  model,
  choices: [{ finish_reason: finish, message: { content } }],
  usage: { prompt_tokens: 9000, completion_tokens: 5000, prompt_tokens_details: { cached_tokens: 4000 } },
});
const stub: PlannerTransport = async (req: ChatRequest) => {
  const user = req.messages[1]!.content;
  calls.push({ system: req.messages[0]!.content, user });
  if (mode === "refuse") return reply(req.model, "", "sensitive");
  // the main model overloaded: the transport gives up with a busy error
  if (mode === "busy" && req.model === "glm-4.7-flash") throw new PlannerError("The AI planner is busy right now.", "GLM API error 429", true);
  // first round: prose around broken JSON; the correction round gets a clean reply
  if (mode === "badjson" && req.messages.length === 2) return reply(req.model, "Here is the plan: {\"summary\": 3}");
  const plan = structuredClone(b1);
  plan.summary = "AI: tuned for an IT engineer who learns from examples.";
  plan.modules[2]!.emphasis = "deep";
  plan.modules[1]!.lessons[0]!.inYourWorld = { title: "Ticket fields", body: "Trim and lower-case the requester email on every ticket before matching it." };
  if (mode === "badorder") plan.modules[0]!.topicOrder = ["explainer", "hook", "worked", "guided", "review"];
  if (user.includes("PREVIOUS PLAN")) plan.changes = [{ target: "lesson 2.1 help", from: "extra", to: "extra", reason: "Two missed checks on expressions." }];
  // numbers quoted, as smaller models sometimes do
  const quoted = { ...plan, pacing: { ...plan.pacing, minutesPerSession: String(plan.pacing.minutesPerSession) } };
  return reply(req.model, "```json\n" + JSON.stringify(quoted) + "\n```");
};

const pending: Promise<void>[] = [];
const schedule = (task: () => Promise<void>) => void pending.push(task());
const flush = async () => {
  while (pending.length) await pending.shift();
};

const view1 = await saveSetup(
  user,
  "n8n",
  { answers: engineer.answers, supportOverride: "auto", pace: engineer.pace, precheck: { responses: { p1: "a", p2: "b", p3: null } } },
  schedule,
  stub,
);
check("enrol: baseline plan v1 ready at once", view1.plan?.version === 1 && view1.plan.source === "baseline", view1.plan);
check("enrol: AI plan v2 pending", view1.pending?.version === 2, view1.pending);
check("enrol: quick check scored on the server", typeof view1.precheck?.lessons["1.1"] === "number" && !("responses" in (view1.precheck ?? {})), view1.precheck);
await flush();
const view2 = await enrollmentOf(user, "n8n");
check("enrol: AI plan v2 is now current", view2.plan?.version === 2 && view2.plan.source === "ai" && view2.plan.plan?.summary.startsWith("AI:") && view2.plan.model === "glm-4.7-flash", view2.plan);
check("enrol: first AI plan has no changes", view2.plan?.changes.length === 0);
check("enrol: quoted numbers accepted in one round", calls.length === 1 && typeof view2.plan?.plan?.pacing.minutesPerSession === "number", calls.length);
check("prompt: course outline and JSON schema in the system prompt", calls[0]!.system.includes("MODULE m1") && calls[0]!.system.includes("QUICK CHECK") && calls[0]!.system.includes('"topicOrder"'));
check("prompt: no mention of a provider", !/claude|anthropic|glm/i.test(calls[0]!.system + calls[0]!.user));
check("prompt: profile answers as labels", calls[0]!.user.includes("IT services") || calls[0]!.user.includes("IT"), calls[0]!.user.slice(0, 400));
check("prompt: 'I don't know yet' answers passed on", calls[0]!.user.includes(`"I don't know yet" on: p3`));

// signals: two misses in 2.2 → revision with the evidence
const r1 = await recordSignals(user, "n8n", [{ key: "v1", kind: "video_check", moduleId: "m2", lesson: "2.2", payload: { videoId: "m2-2", questionId: "q1", correct: false, attempt: 1 } }], schedule, stub);
check("signals: one miss stored, no re-plan", r1.accepted === 1 && !r1.replanning, r1);
const dup = await recordSignals(user, "n8n", [{ key: "v1", kind: "video_check", moduleId: "m2", lesson: "2.2", payload: { correct: false } }], schedule, stub);
check("signals: duplicate id ignored", dup.accepted === 0, dup);
const r2 = await recordSignals(user, "n8n", [{ key: "v2", kind: "video_check", moduleId: "m2", lesson: "2.2", payload: { videoId: "m2-2", questionId: "q2", correct: false, attempt: 1 } }], schedule, stub);
check("signals: second miss inside the AI cooldown → rule revision at once", r2.replanning, r2);
const view2b = await enrollmentOf(user, "n8n");
check("rules: lesson 2.2 now extra, with the change and reason", view2b.plan?.source === "baseline" && view2b.plan.trigger === "signals" && view2b.plan.changes[0]?.target === "lesson 2.2 help", view2b.plan?.changes);

// setup change → the AI planner revises from the previous plan
mode = "badorder";
await saveSetup(user, "n8n", { answers: { ...engineer.answers, firstStep: "idea" }, supportOverride: "auto", pace: engineer.pace }, schedule, stub);
await flush();
const view3 = await enrollmentOf(user, "n8n");
check("setup change: baseline then AI", view3.plan?.version === 5 && view3.plan.source === "ai", view3.plan);
check("setup change: the planner saw the previous plan and the unused evidence", calls.at(-1)!.user.includes("PREVIOUS PLAN (version 4)") && calls.at(-1)!.user.includes("lesson 2.2"), calls.at(-1)!.user.slice(-600));
check("setup change: bad order from the model replaced, issue logged", view3.plan?.error?.includes("topic order") && view3.plan.plan?.modules[0]!.topicOrder[0] === "hook", view3.plan?.error);
check("setup change: changes recorded", (view3.plan?.changes.length ?? 0) === 1);

// content filter → failed attempt, current plan unchanged
mode = "refuse";
await saveSetup(user, "n8n", { answers: engineer.answers, supportOverride: "extra", pace: engineer.pace }, schedule, stub);
await flush();
const view4 = await enrollmentOf(user, "n8n");
check("content filter: the new baseline stays current, error reported", view4.plan?.version === 6 && view4.plan.source === "baseline" && view4.lastError === "The AI planner declined to write this plan.", { plan: view4.plan?.version, err: view4.lastError });

// invalid JSON → one correction round, then a valid plan
mode = "badjson";
const before = calls.length;
await saveSetup(user, "n8n", { answers: engineer.answers, supportOverride: "auto", pace: engineer.pace }, schedule, stub);
await flush();
const view4b = await enrollmentOf(user, "n8n");
check("bad JSON: corrected in a second round", calls.length - before === 2 && view4b.plan?.source === "ai" && view4b.plan.error === null, { calls: calls.length - before, plan: view4b.plan?.source, err: view4b.plan?.error });
mode = "ok";

// main model overloaded → the fallback model writes the plan
mode = "busy";
await saveSetup(user, "n8n", { answers: { ...engineer.answers, style: "analogies" }, supportOverride: "auto", pace: engineer.pace }, schedule, stub);
await flush();
const view4c = await enrollmentOf(user, "n8n");
check("busy: fallback model writes the plan", view4c.plan?.source === "ai" && view4c.plan.model === "glm-4.5-flash" && view4c.lastError === null, { model: view4c.plan?.model, err: view4c.lastError });
check("learner-facing errors never name the provider", !/glm|z\.ai/i.test(JSON.stringify((await planHistory(user, "n8n")).map((h) => h.error))));
mode = "ok";

// progress → module complete
for (const s of ["hook", "explainer", "worked", "guided"]) await recordProgress(user, "n8n", "m1", s, schedule, stub);
const view5 = await recordProgress(user, "n8n", "m1", "review", schedule, stub);
check("progress: stored per module", view5.progress.m1?.length === 5, view5.progress);
const history = await planHistory(user, "n8n");
check("history: newest first with sources", history[0]!.version >= 6 && history.map((h) => h.source).includes("ai"), history.map((h) => `${h.version}:${h.source}:${h.status}:${h.trigger}`));
console.log("  history:", history.map((h) => `v${h.version} ${h.source} ${h.status} (${h.trigger})`).join(" | "));

console.log("\nPROMPT SAMPLE (user turn, first lines):\n" + plannerPrompt({ ctx, input: engineer, previous: null, evidence: [], trigger: "enrol" }).user.split("\n").slice(0, 14).join("\n"));
console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
