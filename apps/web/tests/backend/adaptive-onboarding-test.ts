import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { ActivityResponse, CompactActivityTask, HtmlSlide, SimulationTask } from "@/lib/adaptive-onboarding";
import { advanceOnboarding, assertGeneratedPlan, deleteOnboardingData, onboardingMedia, onboardingPlan, profileFingerprint, readSession, startOnboarding } from "@/server/adaptive-onboarding";
import { courseContext } from "@/server/planner/context";
import { mediaCalls, requests, responses } from "./adaptive-ai-fixture";
import type { LearnerPlan } from "@/lib/learner-plan";
import { ApiError } from "@/server/http";
import { getSessionUser } from "@/server/auth";
import { saveSetup } from "@/server/planner/service";

process.env.ADAPTIVE_ONBOARDING_DIR = await mkdtemp(path.join(process.cwd(), ".data", "tests", "adaptive-"));
const user = await getSessionUser();
const owner = user.id;
const profile = { domain: "other", domainOther: "Healthcare", role: "other", roleOther: "Doctor", subRole: "Outpatient doctor", useCase: "Clinic appointment administration", experience: "never" };
assert.notEqual(profileFingerprint("ai-agent", { ...profile, learningContext: "school" }), profileFingerprint("ai-agent", { ...profile, learningContext: "workplace" }), "student and company contexts have distinct preparation sessions");
const task = (id: string) => ({ id, title: "Repair the booking assistant", scene: "A fictional clinic assistant cannot read appointment availability.", instruction: "Write instructions to check availability and request confirmation.", kind: "simulation" as const, workspace: { name: "Clinic desk", incomingLabel: "Appointment request", request: "Please find an open appointment for next week.", agentLabel: "Your booking assistant", outputLabel: "Scheduling log", state: "A request is waiting for your assistant.", instructionPlaceholder: "Add a boundary for your assistant…", runLabel: "Run booking assistant" }, items: [{ id: "lookup", text: "Check the clinic calendar" }, { id: "confirm", text: "Ask before booking" }, { id: "invent", text: "Offer an unchecked appointment" }], artifact: "Clinic policy: confirm before booking; never give clinical advice.", skills: ["1.1"], imagePrompt: "Fictional clinic reception desk in soft natural light, no written text.", evaluationGuide: "Look for a bounded goal, read-only lookup, confirmation before booking and clinical handoff." });
const slide = { title: "Your appointment assistant", caption: "Read availability before suggesting times.", narration: "A clinic assistant uses a scheduling tool to check open appointments. A chatbot alone can only suggest words; it cannot see the calendar.", imagePrompt: "Fictional clinic reception desk in soft natural light with a calendar, no text.", imageAlt: "A fictional clinic reception desk", animation: "sequence" as const, steps: ["Receive a request", "Check available times"] };
assert.equal(CompactActivityTask.safeParse({ ...task("too-long"), scene: "a".repeat(181) }).success, false, "new tasks reject long scenario walls");
const noReflection = ActivityResponse.parse({ taskId: "draft-1", submissionId: "unreported-1", text: "Check first.", selected: [], confidence: "not-stated", helpUsed: null, skipped: false });
assert.equal(noReflection.confidence, "not-stated");
assert.equal(noReflection.helpUsed, null, "unanswered reflection does not claim no help was used");
responses.push({ title: "Your clinic starting point", rationale: "Prepare to build a bounded appointment assistant.", slides: [slide, slide, slide, slide], task: task("draft-1") });
const [session, duplicate] = await Promise.all([startOnboarding(owner, "ai-agent", profile), startOnboarding(owner, "ai-agent", profile)]);
assert.equal(session.id, duplicate.id);
assert.equal(requests.length, 1, "simultaneous start requests generate only once");
assert.equal("evaluationGuide" in session.task!, false, "rubrics never leave the server");
assert.equal(SimulationTask.safeParse({ ...task("missing-world"), workspace: undefined }).success, false);
assert.equal(HtmlSlide.safeParse(slide).success, true);
assert.equal("imagePrompt" in session.slides[0]!, false, "new slides contain HTML diagram data, no photo prompt");
assert.match(requests[0]!.system, /ONE interactive mission/);
assert.equal(session.evidence.length, 0, "profile alone does not claim knowledge");
assert.equal((await startOnboarding(owner, "ai-agent", profile)).id, session.id);
assert.equal(requests.length, 1, "refresh reuses persisted generation");
assert.notEqual(profileFingerprint("ai-agent", profile), profileFingerprint("ai-agent", { ...profile, roleOther: "Engineer" }));
await assert.rejects(readSession(session.id, "another-learner"), (e: unknown) => e instanceof ApiError && e.status === 404);
await assert.rejects(readSession("../../private", owner), (e: unknown) => e instanceof ApiError && e.status === 400);
const response = (id: string, submission: string) => ActivityResponse.parse({ taskId: id, submissionId: submission, text: "Read calendar availability, show the slots, then ask for confirmation before booking. Hand clinical questions to staff.", selected: ["lookup", "confirm"], events: [{ type: "add", itemId: "lookup" }, { type: "add", itemId: "confirm" }, { type: "run" }], confidence: "unsure", helpUsed: true, skipped: false });
await assert.rejects(advanceOnboarding(session.id, owner, response("stale", "submission-stale")), (e: unknown) => e instanceof ApiError && e.status === 409);

await assert.rejects(advanceOnboarding(session.id, owner, { ...response("draft-1", "missing-run"), events: [] }), (e: unknown) => e instanceof ApiError && e.code === "incomplete_run");
await assert.rejects(advanceOnboarding(session.id, owner, { ...response("draft-1", "foreign-event"), events: [{ type: "add", itemId: "unknown-tool" }, { type: "run" }] }), (e: unknown) => e instanceof ApiError && e.code === "invalid_event");
await assert.rejects(advanceOnboarding(session.id, owner, { ...response("draft-1", "duplicate-action"), selected: ["lookup", "lookup"] }), (e: unknown) => e instanceof ApiError && e.code === "invalid_selection");
responses.push({ feedback: "The calendar check found an open slot.", evidence: [], done: false, nextTasks: [{ ...task("wrong-mission"), title: "An unrelated quiz" }], summary: "", strengths: [], focus: [] });
await assert.rejects(advanceOnboarding(session.id, owner, response("draft-1", "bad-continuation")), (e: unknown) => e instanceof ApiError && e.code === "mission_changed");
assert.equal((await readSession(session.id, owner)).rounds, 0, "a broken continuation never discards the pending run");
let current = session;
for (let turn = 1; turn <= 3; turn++) {
  const final = turn === 3;
  responses.push({ feedback: "Your draft asks for confirmation before booking.", evidence: [{ skill: "1.1", observation: `Task draft-${turn} explicitly checks availability and asks for confirmation.`, level: "demonstrated", confidence: "medium", support: "light", reason: "The learner separates a read action from a write action; other skills remain untested." }], done: final,
    nextTasks: final ? [] : [task(`draft-${turn + 1}`)], summary: final ? "You can bound an appointment assistant. We will explore tool reliability with support." : "", strengths: final ? ["Bounded assistant instructions"] : [], focus: final ? ["Tool reliability is not yet explored"] : [] });
  const submission = response(`draft-${turn}`, `submission-${turn}`);
  current = await advanceOnboarding(session.id, owner, submission);
  if (!final) {
    assert.deepEqual(current.configuration?.selected, ["lookup", "confirm"], "same mission retains the actual chosen workflow");
    assert.equal(current.configuration?.text, submission.text);
    assert.equal(current.task!.workspace!.name, session.task!.workspace!.name);
  }
  const before: number = requests.length;
  const retried = await advanceOnboarding(session.id, owner, submission);
  assert.equal(retried.rounds, turn);
  assert.equal(requests.length, before, "network retries never double-score or incur another model call");
  const prompt = JSON.parse(requests.at(-1)!.contents[0]!.parts[0]!.text);
  assert.equal(prompt.transcript.length, turn, "the evaluator receives the actual complete transcript");
}
assert.equal(current.done, true);
assert.equal(current.evidence[0]!.support, "light", "the model's judgement is preserved despite novice profile and help use");
await onboardingMedia(session.id, owner, "image", 0, "draft-1");
const image = await onboardingMedia(session.id, owner, "image", 0, "draft-1");
assert.equal(mediaCalls.image, 1, "replays reuse the generated image");
assert.equal(image.mimeType, "image/webp", "cached images retain their actual MIME type");
await onboardingMedia(session.id, owner, "audio", 0);
await onboardingMedia(session.id, owner, "audio", 0);
assert.equal(mediaCalls.audio, 1, "replays reuse the generated narration");
await assert.rejects(onboardingMedia(session.id, "another-learner", "audio", 0), (e: unknown) => e instanceof ApiError && e.status === 404);

const ctx = await courseContext("ai-agent");
const plan: LearnerPlan = { summary: "Build on your demonstrated assistant boundaries and explore the untested skills.", learner: { level: "some", strengths: ["Assistant boundaries"], gaps: ["Other skills not yet observed"] }, pacing: { minutesPerSession: 25, sessionsPerWeek: 3, note: "Short practical sessions." },
  modules: ctx.modules.map((m) => ({ moduleId: m.id, emphasis: "standard", why: "Continue observing your work.", topicOrder: m.stages, support: "light", hookScene: null,
    lessons: m.lessons.map((l) => ({ lessonId: l.id, support: "light", why: "The evaluator recommends a light starting point with help available.", inYourWorld: { title: "Clinic appointments", body: "Check the calendar before proposing an appointment." } })) })), capstoneBrief: "Build an administrative appointment assistant with explicit human confirmation.", changes: [] };
assertGeneratedPlan(plan, ctx);
assert.throws(() => assertGeneratedPlan({ ...plan, modules: plan.modules.slice(1) }, ctx));
assert.throws(() => assertGeneratedPlan({ ...plan, modules: plan.modules.map((m, i) => i ? m : { ...m, topicOrder: [...m.topicOrder].reverse() }) }, ctx));
await assert.rejects(onboardingPlan(session.id, owner, "ai-agent", { ...profile, subRole: "Surgeon" }, null, "auto"), (e: unknown) => e instanceof ApiError && e.code === "profile_changed");
responses.push(plan);
const result = await onboardingPlan(session.id, owner, "ai-agent", profile, null, "auto");
const planInput = JSON.parse(requests.at(-1)!.contents[0]!.parts[0]!.text).input;
assert.equal(planInput.transcript.length, 3, "the entire course planner receives every real activity response");
assert.equal(planInput.transcript[0].response.text, response("draft-1", "submission-1").text);
assert.equal(planInput.transcript[0].response.helpUsed, true);
assert.deepEqual(planInput.transcript[0].response.events, response("draft-1", "submission-1").events, "real action edits and run reach the entire course planner");
assert.equal(planInput.transcript[0].task.workspace.request, task("draft-1").workspace.request);
assert.match(requests.at(-1)!.system, /ENTIRE course/);
assert.equal(result.plan.modules.length, ctx.modules.length, "adaptation covers every module, including topics not directly tested");
assert.equal(result.plan.modules[0]!.support, "light", "plan decisions are not overwritten by a rule-based floor");
assert.deepEqual(result.precheck.lessons, {}, "no fake quiz scores are manufactured");
assert.equal(result.precheck.assessmentId, session.id);
assert.equal(result.precheck.activity.evidence.length, 1);
const saved = await saveSetup(user, "ai-agent", { answers: profile, supportOverride: "auto", pace: null,
  precheck: { assessmentId: session.id, activity: { lessons: { "1": 2 }, summary: "forged client assessment" } } }, () => {});
assert.equal(saved.plan?.source, "ai");
assert.equal(saved.plan?.model, "test-evaluator");
assert.notEqual(saved.precheck?.activity?.summary, "forged client assessment", "enrollment reads the verified server assessment");
assert.deepEqual(saved.precheck?.lessons, {}, "forged client quiz levels are ignored");
assert.equal(saved.precheck?.activity?.evidence?.length, 1, "observations are retained in the enrollment response");
const changedProfile = { ...profile, goal: "project", goalDetail: "Build a clinic appointment assistant" };
responses.push({ title: "Build your clinic assistant", rationale: "Your project goal shapes these prerequisites.", slides: [slide, slide, slide, slide], task: task("project-start") });
const changed = await startOnboarding(owner, "ai-agent", changedProfile);
assert.notEqual(changed.id, session.id, "a changed final profiling answer creates a new prerequisite video and activity");
assert.equal(changed.title, "Build your clinic assistant", "old video content cannot carry into the new profile");
assert.equal(JSON.parse(requests.at(-1)!.contents[0]!.parts[0]!.text).profile.goalDetail, changedProfile.goalDetail, "the video model receives the complete final goal");
assert.equal(responses.length, 0);
await deleteOnboardingData(owner);
await assert.rejects(readSession(session.id, owner), (e: unknown) => e instanceof ApiError && e.status === 404);
console.log("Adaptive onboarding: generation, ownership, persistence, adaptive turns, idempotency, model decisions, plan integrity and media cache all pass.");
