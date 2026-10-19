import assert from "node:assert/strict";
import { ProfileConversation, type ProfileTurn } from "@/lib/profile-conversation";
import { ProfileVoice } from "@/lib/profile-voice";
import { bankQuestion, profileFromAnswers, SLOTS, type ProfileAnswer, type ProfileSlot } from "@/lib/profiling";
import { profileConversationTurn } from "@/server/profiling";
import { deleteProfileVoice, profileVoice, registerProfileVoice } from "@/server/profile-voice";
import { profileFingerprint } from "@/server/adaptive-onboarding";
import { responses, requests, mediaCalls } from "./adaptive-ai-fixture";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
class VoiceGate {
  calls: string[] = [];
  resolve: (() => void) | null = null;
  reject: ((error: Error) => void) | null = null;
  say(_url: string | null, text: string) { this.calls.push(text); return new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
  end() { const resolve = this.resolve; this.resolve = null; this.reject = null; resolve?.(); }
  cancel() { this.reject?.(new Error("Cancelled")); this.resolve = null; this.reject = null; }
}
const answer = (slot: ProfileSlot, label: string, tag: string): ProfileAnswer => ({ slot, label, tag, question: `Question about ${slot}` });
const makeTurn = (slot: ProfileSlot | null, answers: ProfileAnswer[]): ProfileTurn => ({
  question: slot ? { ...bankQuestion(slot, answers), text: `Question about ${slot}` } : null,
  reply: slot === SLOTS[0] ? "" : `I heard ${answers.at(-1)?.label ?? "your skip"}.`,
  questionAudio: slot ? `/${slot}.wav` : null, replyAudio: slot === SLOTS[0] ? null : "/reply.wav",
});
const voice = new VoiceGate();
const sent: { slot: ProfileSlot | null; answers: ProfileAnswer[] }[] = [];
let latest: ProfileAnswer[] = [];
const chat = new ProfileConversation(async (input) => { sent.push(input); return makeTurn(input.slot, input.answers); }, voice, (list) => { latest = list; });
void chat.start(); await tick();
assert.equal(chat.getSnapshot().phase, "question");
chat.answer(answer("field", "Premature", "domain:other"));
assert.equal(sent.length, 1, "answers are blocked until the question finishes");
voice.end(); await tick();
assert.equal(chat.getSnapshot().phase, "listening");
const profileAnswers = [answer("context", "Working professional", "context:workplace"), answer("field", "Healthcare", "domain:healthcare"), answer("experience", "New to agents", "level:beginner"), answer("subrole", "Outpatient doctor", "subrole:doctor"), answer("usecase", "Route appointment requests", "usecase:appointments"), answer("goal", "Build my clinic assistant", "goal:build-a-project")];
for (let at = 0; at < SLOTS.length; at++) {
  void chat.answer(profileAnswers[at]!);
  void chat.answer(profileAnswers[at]!);
  assert.equal(chat.getSnapshot().phase, "preparing");
  await tick();
  assert.equal(sent.length, at + 2, "double-clicking makes only one turn request");
  assert.equal(chat.getSnapshot().phase, "reply");
  assert.equal(chat.getSnapshot().at, at, "the current question stays visible throughout its reply");
  const before = voice.calls.length;
  await tick();
  assert.equal(voice.calls.length, before, "time alone never advances a reply");
  voice.end(); await tick();
  if (at < SLOTS.length - 1) {
    assert.equal(chat.getSnapshot().at, at + 1);
    assert.equal(chat.getSnapshot().phase, "question");
    assert.equal(voice.calls.at(-1), `Question about ${SLOTS[at + 1]}`);
    voice.end(); await tick();
    assert.equal(chat.getSnapshot().phase, "listening");
  }
}
assert.equal(chat.getSnapshot().phase, "complete", "completion waits for the final spoken reply");
const complete = profileFromAnswers(latest).setup;
assert.equal(complete.learningContext, "workplace");
assert.equal(complete.learningContextDetail, "Working professional");
assert.equal(complete.goalDetail, "Build my clinic assistant", "the final spoken answer is in the profile snapshot");
assert.notEqual(profileFingerprint("ai-agent", complete), profileFingerprint("ai-agent", { ...complete, goalDetail: "Qualify for certification" }), "a changed final goal selects a different prerequisite video");
void chat.back(); await tick();
assert.equal(chat.getSnapshot().at, SLOTS.length - 2);
assert.equal(chat.getSnapshot().phase, "question");
voice.reject?.(new Error("Test playback failure")); await tick();
assert.equal(chat.getSnapshot().phase, "error");
void chat.retry(); await tick(); voice.end(); await tick();
assert.equal(chat.getSnapshot().phase, "listening", "voice retry resumes the failed stage");

// A late response from the previous branch must never speak over Back.
let release: ((value: ProfileTurn) => void) | null = null;
const otherVoice = new VoiceGate();
let calls = 0;
const other = new ProfileConversation(async (input) => ++calls === 3 ? new Promise<ProfileTurn>((resolve) => { release = resolve; }) : makeTurn(input.slot, input.answers), otherVoice, () => {});
void other.start(); await tick(); otherVoice.end(); await tick();
void other.answer(profileAnswers[0]!); await tick(); otherVoice.end(); await tick(); otherVoice.end(); await tick();
void other.answer(profileAnswers[1]!); await tick();
void other.back(); await tick();
const spokenBeforeLateResponse = otherVoice.calls.length;
assert.ok(release);
(release as (value: ProfileTurn) => void)(makeTurn("subrole", profileAnswers.slice(0, 2))); await tick();
assert.equal(other.getSnapshot().at, 0);
assert.equal(otherVoice.calls.length, spokenBeforeLateResponse, "stale response is discarded after Back");
other.dispose(); chat.dispose();

// Exercise actual audio event handling with a controllable browser surface.
class FakeAudio {
  static last: FakeAudio;
  static blocked = false;
  src = ""; paused = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  constructor() { FakeAudio.last = this; }
  pause() { this.paused = true; }
  async play() { if (FakeAudio.blocked) throw new DOMException("Tap to play", "NotAllowedError"); this.paused = false; this.onplaying?.(); }
}
class FakeUtterance { constructor(public text: string) {} lang = ""; rate = 1; onstart?: () => void; onend?: () => void; onerror?: (event: { error: string }) => void; }
let utterance: FakeUtterance | null = null;
const synthesis = { speak: (value: FakeUtterance) => { utterance = value; value.onstart?.(); }, cancel: () => {}, pause: () => {}, resume: () => {} };
Object.assign(globalThis, { Audio: FakeAudio, window: { speechSynthesis: synthesis }, document: { documentElement: { lang: "en" } }, SpeechSynthesisUtterance: FakeUtterance, speechSynthesis: synthesis });
let failFetch = false;
globalThis.fetch = async () => {
  const response = new Response(null, { status: failFetch ? 503 : 200 });
  response.blob = async () => new Blob(["wave"], { type: "audio/wav" });
  return response;
};
let status = "idle";
let browserFallback = false;
const player = new ProfileVoice((value, browser) => { status = value; browserFallback = browser; });
player.unlock();
let finished = false;
const playback = player.say("/test.wav", "Read this exact question").then(() => { finished = true; });
await tick(); assert.equal(status, "playing");
player.pause(); await tick(); assert.equal(status, "paused"); assert.equal(finished, false);
player.resume(); await tick(); assert.equal(status, "playing"); assert.equal(finished, false);
FakeAudio.last.onended?.(); await playback; assert.equal(finished, true);
FakeAudio.blocked = true;
finished = false;
const blocked = player.say("/test.wav", "Blocked question").then(() => { finished = true; });
await tick(); assert.equal(status, "blocked"); assert.equal(finished, false);
FakeAudio.blocked = false; player.resume(); await tick(); FakeAudio.last.onended?.(); await blocked;
failFetch = true;
const fallback = player.say("/test.wav", "Exact fallback words"); await tick();
assert.equal(browserFallback, true); assert.equal((utterance as FakeUtterance | null)?.text, "Exact fallback words");
(utterance as FakeUtterance | null)?.onend?.(); await fallback;
failFetch = false;
const muted = player.say("/test.wav", "Optional speech"); await tick(); player.setMuted(true); await muted;
await player.say("/test.wav", "Muted speech does not stall the conversation");
player.setMuted(false);
const cancelled = player.say("/test.wav", "Cancelled speech"); player.cancel();
await assert.rejects(cancelled, (error: unknown) => error instanceof DOMException && error.name === "AbortError");

// Live generation contracts, owner-scoped voice and content caching with AI fixtures.
const first = await profileConversationTurn({ courseId: "ai-agent", slot: "context", answers: [], skipped: false });
assert.equal(first.reply, "");
responses.push({ ack: "Your clinic work gives us a useful starting point.", question: "How familiar are you with clinic automation?", why: "So we start at your level.", options: ["None", "A little", "I use tools", "I build agents"].map((label, i) => ({ label, value: ["beginner", "some-exposure", "working-with-it", "advanced"][i] })) });
const next = await profileConversationTurn({ courseId: "ai-agent", slot: "experience", answers: profileAnswers.slice(0, 2), skipped: false });
assert.match(next.reply, /clinic/);
responses.push({ reply: "We’ll build toward your clinic assistant, using appointment examples in your prerequisites." });
const closing = await profileConversationTurn({ courseId: "ai-agent", slot: null, answers: profileAnswers, skipped: false });
assert.equal(closing.question, null);
assert.match(requests.at(-1)!.contents[0]!.parts[0]!.text, /Build my clinic assistant/);
responses.push({ reply: "We can leave that open and use the context you shared." });
await profileConversationTurn({ courseId: "ai-agent", slot: null, answers: profileAnswers.slice(0, -1), skipped: true });
assert.match(requests.at(-1)!.contents[0]!.parts[0]!.text, /"skipped":true/);
const owner = `test-profile-${Date.now()}`;
const url = await registerProfileVoice(owner, closing.reply);
const id = new URL(url!, "http://test").searchParams.get("id")!;
await assert.rejects(profileVoice(id, "someone-else"));
await assert.rejects(profileVoice("../../private", owner));
const before = mediaCalls.audio;
await Promise.all([profileVoice(id, owner), profileVoice(id, owner)]);
await profileVoice(id, owner);
assert.equal(mediaCalls.audio - before, 1, "simultaneous speech generation and replay share the cached recording");
await deleteProfileVoice(owner);
await assert.rejects(profileVoice(id, owner));
console.log("Profiling: ordered narration, answer locking, contextual replies, final profile, Back cancellation, voice retry, pause, autoplay recovery, device fallback and media ownership/cache all pass.");

// School and company learners keep their current context throughout the conversation.
responses.push({ ack: "We can use examples from your school subjects.", question: "Which school subject interests you most?", why: "For familiar examples.", options: ["Science", "Mathematics", "Languages", "Arts"].map((label) => ({ label, value: label })) });
const school = await profileConversationTurn({ courseId: "ai-agent", slot: "field", answers: [answer("context", "School student", "context:school")], skipped: false });
assert.match(school.question!.text, /school subject/);
assert.match(requests.at(-1)!.contents[0]!.parts[0]!.text, /School student/);
responses.push({ ack: "We can practise with your current responsibilities.", question: "What would help you in this course?", why: "", options: ["Understand the ideas", "Apply it in my team", "Practise a workflow", "Build a small project"].map((label) => ({ label, value: label })) });
const workplaceGoal = await profileConversationTurn({ courseId: "ai-agent", slot: "goal", answers: profileAnswers.slice(0, -1), skipped: false });
assert.doesNotMatch(JSON.stringify(workplaceGoal.question!.options), /get a job|career switch|new role|transition/i);
assert.match(requests.at(-1)!.system, /employers/);
assert.match(requests.at(-1)!.contents[0]!.parts[0]!.text, /Never offer getting a new job/);
const openGoal = workplaceGoal.question!.options[1]!;
assert.equal(profileFromAnswers([answer("goal", openGoal.label, openGoal.tag)]).setup.goalDetail, "Apply it in my team");
console.log("Inclusive profiling: school subjects, current workplace goals and saved learning context pass.");
