// Adapted-lesson tests: node tests/backend/run.mjs adapt. In-memory database, stand-ins for the language model and the voice.
import fs from "node:fs";
import path from "node:path";
import { mergeShape, acceptable, skeletonOf } from "@/server/adapt/shape";
import { writePiece, AdaptError, type PieceBrief } from "@/server/adapt/write";
import { piecesOf, authoredWorld } from "@/server/adapt/pieces";
import { adaptedAudioFile, adaptedModule, adaptNextModule, ensureModule } from "@/server/adapt/service";
import { audioRoot, gemini, retryDelayMs, spoken, withFallback, type Voicer } from "@/server/adapt/tts";
import { getSessionUser } from "@/server/auth";
import { deleteUserData, findEnrollment, saveProfile, upsertEnrollment, adaptedFor } from "@/server/repo";
import { getModule } from "@/data";
import { getBlock } from "@/data/client";
import type { ConceptVideo, HookBlock } from "@/data/types";
import type { ChatRequest, ChatResponse, LlmTransport } from "@/server/ai/llm";

let failures = 0;
const check = (label: string, cond: unknown, extra?: unknown) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};
const reply = (body: unknown): ChatResponse => ({ model: "stub", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(body) } }] });

const mod = (await getModule("ai-agent", "m1"))!;
const hook = getBlock(mod, "hook")!;
const video = getBlock(mod, "explainer")!.videos![0]!;
const story = authoredWorld("ai-agent");

/** The stand-in "rewrites" every string into a dental clinic, keeping the shape. */
const rewrite = (x: unknown): unknown =>
  typeof x === "string" ? `${x.replace(new RegExp(story.banned.source, "gi"), "Harbour")} at Harbour Dental`.trim() : Array.isArray(x) ? x.map(rewrite) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, rewrite(v)])) : x;
const skeletonIn = (r: ChatRequest) => JSON.parse(r.messages[1]!.content.split("\n").at(-1)!);
const WORLD = { organisation: "Harbour Dental", whatItDoes: "a two-chair dental clinic", learnerRole: "practice manager", customers: "patients booking check-ups", people: [{ name: "Dr Anika Rao", role: "dentist" }], problem: "patients keep phoning to ask about appointments" };

/* ================================================================ the shape */
const twisted = rewrite(skeletonOf(video, story.banned)) as Record<string, unknown> & { slides: Record<string, unknown>[] };
twisted.slides[0]!.kind = "bullets"; // the model changing a slide's kind
twisted.quizAfter = 99;
const m = mergeShape(video, twisted, { banned: story.banned });
check("shape: ids, kinds and numbers stay authored", m.value.id === video.id && m.value.slides[0]!.kind === video.slides[0]!.kind && m.value.quizAfter === video.quizAfter);
const quizzes = [...video.midQuiz, ...video.endQuiz];
const merged = [...m.value.midQuiz, ...m.value.endQuiz];
const story_ = new RegExp(story.banned.source, "i");
check("shape: quizzes stay authored unless they name the old story", quizzes.some((q) => !story_.test(JSON.stringify(q))) && quizzes.every((q, i) => (story_.test(JSON.stringify(q)) ? merged[i]!.q !== q.q : merged[i]!.q === q.q)));
check("shape: a reworded quiz keeps its right answer", quizzes.every((q, i) => merged[i]!.correct === q.correct && merged[i]!.options.length === q.options.length));
check("shape: a slide's narration is its rewritten sentences", m.value.slides[1]!.narration === m.value.slides[1]!.sentences.join(" ") && m.value.slides[1]!.narration.includes("Harbour Dental"));
check("shape: the rewrite is acceptable", acceptable(m).ok && !m.problems.length, m.problems.slice(0, 3));
const sk = skeletonOf(video, story.banned) as { slides: object[]; midQuiz?: unknown[]; endQuiz?: unknown[] };
check("shape: the model sees only the quizzes it may reword, and no derived narration", [...(sk.midQuiz ?? []), ...(sk.endQuiz ?? [])].some((q) => q === null) && !("narration" in sk.slides[0]!));
const short = rewrite(skeletonOf(video, story.banned)) as { slides: unknown[] };
short.slides.pop();
const ms = mergeShape(video, short, { banned: story.banned });
check("shape: a slide missing is a problem, and the authored slides stay", ms.problems.some((p) => p.includes("slides")) && ms.value.slides.length === video.slides.length && !acceptable(ms).ok);
const leak = mergeShape(hook, { ...(rewrite(skeletonOf(hook)) as object), title: "Orbit Outdoor again" }, { banned: story.banned });
check("shape: the authored story's names are refused", leak.problems.some((p) => p.startsWith("$.title") && p.includes("Orbit")));
check("voice: codes and snake_case are spoken as words", spoken("Track ORB-10482 with track_parcel → status") === "Track O R B 1 0 4 8 2 with track parcel returns status");

/* ================================================================ writing a piece */
const brief: PieceBrief = { courseTitle: "Build Your First AI Agent", authoredWorld: story.text, banned: story.banned, moduleTitle: mod.title, lessons: ["1.1 What is an agent"], label: "the hook", planNote: null };
let calls: ChatRequest[] = [];
let respond: (r: ChatRequest, n: number) => ChatResponse = (r) => reply({ world: WORLD, piece: rewrite(skeletonIn(r)) });
const stub: LlmTransport = async (r) => {
  calls.push(r);
  return respond(r, calls.length);
};
const w = await writePiece(brief, ["- Field: dentistry"], null, hook, stub);
check("write: a new story in the learner's world, and their world invented", w.world?.organisation === "Harbour Dental" && w.content.title.includes("Harbour Dental") && w.content.hunches.map((h) => h.id).join() === hook.hunches.map((h) => h.id).join());
check("write: the prompt asks for their world and carries the learner and the skeleton", calls[0]!.messages[1]!.content.includes("THEIR WORLD: not set yet") && calls[0]!.messages[1]!.content.includes("- Field: dentistry"));
calls = [];
respond = (r, n) => {
  const p = rewrite(skeletonIn(r)) as { slides: unknown[] };
  if (n === 1) p.slides.pop();
  return reply({ piece: p });
};
const fixed = await writePiece({ ...brief, label: "a video" }, [], WORLD, video, stub);
check("write: a reply that doesn't fit gets one round to fix it", calls.length === 2 && calls[1]!.messages.at(-1)!.content.includes("did not fit") && fixed.content.slides.length === video.slides.length);
check("write: a set world is kept, not reinvented", calls[0]!.messages[1]!.content.includes("THEIR WORLD (already set") && fixed.world?.organisation === "Harbour Dental");
calls = [];
respond = (r) => reply(rewrite(skeletonIn(r)));
const bare = await writePiece({ ...brief, label: "an unwrapped video" }, [], WORLD, video, stub);
check("write: a reply that is the piece itself (no wrapper) is still used", calls.length === 1 && bare.content.slides[0]!.title.includes("Harbour Dental"));
respond = (r) => reply({ piece: { ...(rewrite(skeletonIn(r)) as object), why: "Orbit Outdoor again" } });
let threw = false;
try {
  await writePiece({ ...brief, label: "a leaky hook" }, [], WORLD, hook, stub);
} catch (e) {
  threw = e instanceof AdaptError;
}
check("write: a rewrite that keeps the authored story is not used", threw);
const kept = mergeShape(hook, { ...(rewrite(skeletonOf(hook, story.banned)) as object), narration: 42 }, { banned: story.banned });
check("shape: an authored text kept where the rewrite failed can't bring the old story back", !acceptable(kept).ok || !story_.test(hook.narration));

/* ================================================================ the module, for one learner */
const user = await getSessionUser();
await deleteUserData(user.id);
await saveProfile(user.id, { domain: "healthcare", role: "admin", interview: [{ slot: "domain", q: "Your field?", a: "I run a dental clinic" }] }, []);
await upsertEnrollment(user.id, "ai-agent", { answers: { goal: "work", expect: "Show me how it handles bookings" }, supportOverride: "auto", pace: null, precheck: null });
calls = [];
respond = (r) => reply({ world: WORLD, piece: rewrite(skeletonIn(r)) });
const voiced: string[][] = [];
const voice: Voicer = async (_dir, clips) => {
  voiced.push(clips.map((c) => c.key));
  return new Set(clips.map((c) => c.key));
};
const tasks: Promise<void>[] = [];
const schedule = (t: () => Promise<void>) => void tasks.push(t());
const started = await ensureModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
await Promise.all(tasks);
const pieces = piecesOf(mod).map((p) => p.piece);
const rows = await adaptedFor((await findEnrollment(user.id, "ai-agent"))!.id, "m1");
check("module: every piece written and voiced, in the order they are met", started && pieces[0] === "hook" && pieces.at(-1) === "worked" && rows.filter((r) => r.status === "ready").length === pieces.length, rows.map((r) => `${r.piece}:${r.status}:${r.error}`));
check("module: the learner and their course answers reach the model", calls[0]!.messages[1]!.content.includes("I run a dental clinic") && calls[0]!.messages[1]!.content.includes("Show me how it handles bookings"));
check("module: the world is invented once, then reused by later pieces", calls[0]!.messages[1]!.content.includes("not set yet") && calls.slice(1).every((c) => c.messages[1]!.content.includes("Harbour Dental")));
check("module: hook clips are the opening, each scene's lines and each replay step", voiced[0]!.includes("open") && voiced[0]!.includes("s0") && voiced[0]!.some((k) => k.startsWith("r")));
check("module: no clips for the worked examples (they have no narration audio)", voiced.length === pieces.length - 1);

calls = [];
tasks.length = 0;
const again = await ensureModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
check("module: asking again writes nothing new", !again && !calls.length);

const view = await adaptedModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
const vh = view.hook as HookBlock & { audio: Record<string, string> };
check("view: the hook with its clip urls, for this learner only", vh.title.includes("Harbour Dental") && vh.audio.open?.startsWith(`/api/v1/adapted-audio/`) && vh.audio.open.endsWith("/hook/open.wav"));
const vv = view.videos[video.id] as ConceptVideo & { audio: string[] };
check("view: each video with a clip per slide, the quizzes' answers unchanged", vv.audio.length === video.slides.length && vv.audio[0]!.endsWith(`/video-${video.id}/s0.wav`) && vv.midQuiz.every((q, i) => q.correct === video.midQuiz[i]!.correct));
check("view: the worked examples and their world", !!view.worked && view.world?.organisation === "Harbour Dental");

// a changed setup rewrites the module next time it is asked for
await upsertEnrollment(user.id, "ai-agent", { answers: { goal: "career", expect: "More code please" }, supportOverride: "auto", pace: null, precheck: null });
calls = [];
tasks.length = 0;
const redo = await ensureModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
await Promise.all(tasks);
check("module: changed answers rewrite it (and a new world is invented)", redo && calls[0]!.messages[1]!.content.includes("More code please") && calls[0]!.messages[1]!.content.includes("not set yet"));

// a piece the model can't write stays authored; the others still go live
calls = [];
tasks.length = 0;
respond = (r) => (r.messages[1]!.content.includes("PIECE: the worked examples") ? reply({ piece: { nope: true } }) : reply({ world: WORLD, piece: rewrite(skeletonIn(r)) }));
await upsertEnrollment(user.id, "ai-agent", { answers: { goal: "curious" }, supportOverride: "auto", pace: null, precheck: null });
await ensureModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
await Promise.all(tasks);
const v2 = await adaptedModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
check("module: a failed piece stays authored, the rest go live", !v2.worked && v2.pieces.worked?.status === "failed" && !!v2.hook);

// the next module is written once this one is finished
calls = [];
tasks.length = 0;
const next = await adaptNextModule(user, "ai-agent", "m1", schedule, { transport: stub, voice });
await Promise.all(tasks);
check("next module: written when the one before is finished", next && calls.some((c) => c.messages[1]!.content.includes("MODULE: ")) && !calls[0]!.messages[1]!.content.includes(mod.title));

// without a model nothing is rewritten
check("no model: nothing to rewrite", !(await ensureModule(user, "ai-agent", "m3", schedule)));

/* ================================================================ the Gemini voice */
const vdir = path.join(audioRoot(), "voice-test");
fs.rmSync(vdir, { recursive: true, force: true });
const pcm = Buffer.alloc(4800); // 0.1 s of silence
const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(40), pcm]);
const audioReply = (b: Buffer) => new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: b.toString("base64") }] }] }), { status: 200 });
let sent: { model: string; voice: string; text: string; style: string }[] = [];
let answer: (n: number) => Response = () => audioReply(wav);
const fakeFetch = (async (_url: string, init: RequestInit) => {
  const b = JSON.parse(String(init.body));
  sent.push({ model: b.model, voice: b.generation_config.speech_config[0].voice, text: b.input[0].content[0].text, style: b.input[0].content[0].annotations[0].style });
  return answer(sent.length);
}) as typeof fetch;
const clips = [
  { key: "s0", text: "Track ORB-10482 first." },
  { key: "s1", text: "Then reply to the patient." },
  { key: "s2", text: "" },
];
const g = gemini({ key: "test", model: "tts-model", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1 });
const got = await g(vdir, clips);
check("gemini voice: one request per spoken line, with the voice, the model and a narrator style", sent.length === 2 && sent.every((x) => x.model === "tts-model" && x.voice === "Charon" && x.style.length > 10));
check("gemini voice: lines are said as words (codes digit by digit)", sent.some((x) => x.text.includes("O R B 1 0 4 8 2")));
check("gemini voice: each clip saved as a WAV file", got.size === 2 && fs.readFileSync(path.join(vdir, "s0.wav")).subarray(0, 4).toString() === "RIFF");
sent = [];
answer = () => audioReply(pcm);
await gemini({ key: "test", model: "tts-raw", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1 })(vdir, [clips[0]!]);
const raw = fs.readFileSync(path.join(vdir, "s0.wav"));
check("gemini voice: raw PCM gets a WAV header (24 kHz)", raw.subarray(0, 4).toString() === "RIFF" && raw.readUInt32LE(24) === 24000 && raw.length === pcm.length + 44);
sent = [];
answer = (n) => (n === 1 ? new Response("overloaded", { status: 503 }) : audioReply(wav));
const busy = await gemini({ key: "test", model: "tts-busy", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1, concurrency: 1 })(vdir, [clips[0]!]);
check("gemini voice: an overloaded API is tried again", busy.size === 1 && sent.length === 2);
sent = [];
answer = (n) => (n === 1 ? new Response(JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for metric: requests per minute. Please retry in 0.01s.", details: [{ retryDelay: "0.01s" }] } }), { status: 429 }) : audioReply(wav));
const limited = await gemini({ key: "test", model: "tts-rpm", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1, concurrency: 1 })(vdir, [clips[0]!]);
check("gemini voice: a per-minute limit waits and goes on (not a used-up quota)", limited.size === 1 && sent.length === 2);
check("gemini voice: the wait the API asks for is read", retryDelayMs('{"retryDelay": "23s"}') === 23000 && retryDelayMs("Please retry in 1m2.5s.") === 62500 && retryDelayMs("", "7") === 7000 && retryDelayMs("nothing") === null);
sent = [];
answer = () => new Response(JSON.stringify([{ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota. Please retry in 2m0s." } }]), { status: 429 });
let backupGot: string[] = [];
const backup: Voicer = async (_d, cs) => {
  backupGot = cs.map((c) => c.key);
  return new Set(cs.map((c) => c.key));
};
const fb = await withFallback(gemini({ key: "test", model: "tts-quota", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1, concurrency: 1 }), backup)(vdir, clips);
check("gemini voice: out of quota, Kokoro speaks the whole piece (one voice throughout)", fb.size === 2 && backupGot.join() === "s0,s1" && sent.length === 1);
sent = [];
await gemini({ key: "test", model: "tts-quota", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1 })(vdir, clips);
check("gemini voice: a model out of quota is not asked again until it resets", sent.length === 0);
sent = [];
answer = () => new Response("bad key", { status: 403 });
const denied = await gemini({ key: "bad", model: "tts-denied", voice: "Charon", fetchImpl: fakeFetch, backoffMs: 1, concurrency: 1 })(vdir, clips);
check("gemini voice: a rejected key stops at once", denied.size === 0 && sent.length === 1);
fs.rmSync(vdir, { recursive: true, force: true });

/* ================================================================ clips are private */
const e = (await findEnrollment(user.id, "ai-agent"))!;
const dir = path.join(audioRoot(), e.id, "m1", "hook");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "open.wav"), "RIFF");
check("audio: the learner's own clip is served", !!(await adaptedAudioFile(user, [e.id, "m1", "hook", "open.wav"])));
check("audio: another enrollment's clip is not", !(await adaptedAudioFile(user, ["00000000-0000-0000-0000-000000000000", "m1", "hook", "open.wav"])));
check("audio: no way out of the folder", !(await adaptedAudioFile(user, [e.id, "..", "hook", "open.wav"])) && !(await adaptedAudioFile(user, [e.id, "m1", "hook", "open.txt"])));
fs.rmSync(path.join(audioRoot(), e.id), { recursive: true, force: true });

console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
