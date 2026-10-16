import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getCourse, getModule } from "@/data";
import type { ConceptVideo, HookBlock, WorkedBlock } from "@/data/types";
import { planModule } from "@/lib/learner-plan";
import { interviewLines, profileLines, type SetupAnswers } from "@/lib/setup";
import type { SessionUser } from "@/server/auth";
import type { AdaptedStatus } from "@/server/db/schema";
import * as repo from "@/server/repo";
import { aiConfigured, type LlmTransport } from "../ai/llm";
import { authoredWorld, pieceDir, piecesOf, type PieceDef } from "./pieces";
import { audioRoot, defaultVoicer, type Voicer } from "./tts";
import { ADAPT_PROMPT_VERSION, AdaptError, writePiece, type World } from "./write";

/**
 * Lessons rewritten for each learner. From their profile and their answers
 * when enrolling, the language model writes each piece of a module (the
 * problem hook, the concept videos, the worked examples) as a new story in
 * their own world, in the authored shape; Kokoro then voices its narration.
 *
 * When: module 1 right after enrolling; every other module when the learner
 * finishes the one before it, or first opens it. Pieces are written in the
 * order they are met, and each goes live on its own once its text and voice
 * are both ready, so the opening is personal within minutes while later
 * videos follow. Until then, or if writing fails, the authored piece plays.
 * A changed profile or setup rewrites a module the next time it is asked for.
 * Without a language model key nothing is rewritten.
 */

export type Schedule = (task: () => Promise<void>) => void;
export type AdaptDeps = { transport?: LlmTransport; voice?: Voicer };

/** A piece left writing or voicing longer than this was interrupted (a restart). */
const STALE_MS = 45 * 60_000;
/** A failed piece (an overloaded model, say) is tried again after this. */
const RETRY_MS = 3 * 60_000;
const WORLD = "world" as const;

/** What a rewrite depends on: the learner's answers (profile and this course), and the prompt. */
async function inputsOf(user: SessionUser, e: repo.EnrollmentRow): Promise<{ hash: string; learner: string[] }> {
  const profile = await repo.getProfile(user.id);
  const answers: SetupAnswers = { ...(profile?.answers ?? {}), ...e.answers };
  const derived = profile?.derived ?? null;
  const learner = [
    ...profileLines(answers, derived)
      .filter((l) => l.answer)
      .map((l) => `- ${l.label}: ${l.answer}`),
    ...(derived?.vocab ? [`- In their field: a ${derived.vocab.trigger}; items are ${derived.vocab.items}; the team is the ${derived.vocab.team}`] : []),
    ...interviewLines(answers),
    ...((answers.known ?? []).length ? [`- Modules of this course they already know: ${answers.known!.join(", ")}`] : []),
    ...(answers.expect ? [`- What they want from this course: ${answers.expect}`] : []),
    ...interviewLines(answers, "courseInterview"),
  ];
  const hash = createHash("sha1").update(JSON.stringify({ v: ADAPT_PROMPT_VERSION, learner })).digest("hex").slice(0, 16);
  return { hash, learner };
}

/** When this server process started: work claimed before it was cut off by a restart. */
const boot = globalThis as unknown as { __adaptBoot?: number };
boot.__adaptBoot ??= Date.now();
const isLive = (r: repo.AdaptedRow) =>
  (r.status === "writing" || r.status === "voicing") && r.updatedAt.getTime() >= boot.__adaptBoot! && Date.now() - r.updatedAt.getTime() < STALE_MS;
const needsWork = (r: repo.AdaptedRow | undefined, hash: string) =>
  !r || r.inputs !== hash || (r.status === "failed" ? Date.now() - r.updatedAt.getTime() > RETRY_MS : (r.status === "writing" || r.status === "voicing") && !isLive(r));

/**
 * Makes sure a module is (being) rewritten for this learner. Cheap when it
 * already is: no model call happens here, the work runs through `schedule`.
 */
export async function ensureModule(user: SessionUser, courseId: string, moduleId: string, schedule: Schedule, deps: AdaptDeps = {}): Promise<boolean> {
  if (!deps.transport && !aiConfigured()) return false;
  const e = await repo.findEnrollment(user.id, courseId);
  const mod = await getModule(courseId, moduleId);
  if (!e || !mod) return false;
  const defs = piecesOf(mod);
  if (!defs.length) return false;
  const { hash, learner } = await inputsOf(user, e);
  const rows = await repo.adaptedFor(e.id, moduleId);
  const todo = defs.filter((d) => needsWork(rows.find((r) => r.piece === d.piece), hash));
  if (!todo.length) return false;
  // claim the pieces now, so a second request doesn't start them again
  const claimed = await Promise.all(todo.map(async (d) => ({ def: d, row: await repo.startAdapted(e.id, moduleId, d.piece, hash) })));
  schedule(() => serial(e.id, () => runModule(user, e, courseId, moduleId, hash, learner, claimed, deps)));
  return true;
}

/** One learner's rewrites run one after another, so two never invent two different worlds. */
const chains = ((globalThis as unknown as { __adaptChains?: Map<string, Promise<void>> }).__adaptChains ??= new Map());
function serial(key: string, task: () => Promise<void>): Promise<void> {
  const run = (chains.get(key) ?? Promise.resolve()).then(task, task);
  const tail = run.catch(() => undefined);
  chains.set(key, tail);
  void tail.then(() => chains.get(key) === tail && chains.delete(key));
  return run;
}

/** Module 1 (the first with lesson content), right after enrolling. */
export async function adaptFirstModule(user: SessionUser, courseId: string, schedule: Schedule, deps: AdaptDeps = {}) {
  const course = await getCourse(courseId);
  const first = course?.modules.find((m) => m.authored?.length);
  return first ? ensureModule(user, courseId, first.module_id, schedule, deps) : false;
}

/** The module after this one, once this one is finished. */
export async function adaptNextModule(user: SessionUser, courseId: string, moduleId: string, schedule: Schedule, deps: AdaptDeps = {}) {
  const course = await getCourse(courseId);
  const mods = course?.modules.filter((m) => m.authored?.length) ?? [];
  const next = mods[mods.findIndex((m) => m.module_id === moduleId) + 1];
  return next ? ensureModule(user, courseId, next.module_id, schedule, deps) : false;
}

async function worldOf(enrollmentId: string, hash: string): Promise<World | null> {
  const row = (await repo.adaptedFor(enrollmentId, "*")).find((r) => r.piece === WORLD && r.status === "ready" && r.inputs === hash);
  return (row?.content as World | null) ?? null;
}

async function runModule(
  user: SessionUser,
  e: repo.EnrollmentRow,
  courseId: string,
  moduleId: string,
  hash: string,
  learner: string[],
  claimed: { def: PieceDef; row: repo.AdaptedRow }[],
  deps: AdaptDeps,
) {
  const course = await getCourse(courseId);
  const mod = course?.modules.find((m) => m.module_id === moduleId);
  if (!course || !mod) return;
  const plan = (await repo.plansFor(e.id)).find((p) => p.status === "ready")?.plan ?? null;
  const pm = planModule(plan, moduleId);
  const story = authoredWorld(courseId);
  let world = await worldOf(e.id, hash);
  const voice = deps.voice ?? defaultVoicer();

  for (const { def, row } of claimed) {
    world ??= await worldOf(e.id, hash);
    try {
      const written = await writePiece(
        {
          courseTitle: course.title,
          authoredWorld: story.text,
          banned: story.banned,
          moduleTitle: mod.title,
          lessons: mod.lessons.map((l) => `${l.id} ${l.title}`),
          label: def.label,
          planNote: pm ? `${pm.emphasis === "skim" ? "they know this module already; keep it brisk" : pm.emphasis === "deep" ? "this module matters most to them" : "standard depth"}; ${pm.support} help.${pm.hookScene ? ` The planner framed the stakes as: ${pm.hookScene}` : ""}` : null,
        },
        learner,
        world,
        def.authored,
        deps.transport,
      );
      if (!world && written.world) {
        world = written.world;
        const w = await repo.startAdapted(e.id, "*", WORLD, hash);
        await repo.updateAdapted(w.id, { status: "ready", content: world as unknown as Record<string, unknown>, model: written.model });
      }
      await repo.updateAdapted(row.id, { status: "voicing", content: written.content as Record<string, unknown>, model: written.model });
      const clips = def.clips(written.content).filter((c) => c.text.trim());
      let audio: Record<string, string> = {};
      if (voice && clips.length) {
        const dir = path.join(audioRoot(), e.id, moduleId, pieceDir(def.piece));
        const done = await voice(dir, clips);
        audio = Object.fromEntries(clips.filter((c) => done.has(c.key)).map((c) => [c.key, `/api/v1/adapted-audio/${e.id}/${moduleId}/${pieceDir(def.piece)}/${c.key}.wav`]));
        if (done.size < clips.length) console.warn(`[adapt] ${moduleId} ${def.piece}: ${clips.length - done.size} of ${clips.length} clips not voiced`);
      }
      await repo.updateAdapted(row.id, { status: "ready", audio });
      console.info(`[adapt] ${user.id} ${moduleId} ${def.piece} ready (${written.merge.changed}/${written.merge.free} texts, ${Object.keys(audio).length} clips)`);
    } catch (err) {
      const detail = err instanceof AdaptError ? err.detail : err instanceof Error ? err.message : String(err);
      console.warn(`[adapt] ${moduleId} ${def.piece} failed: ${detail}`);
      await repo.updateAdapted(row.id, { status: "failed", error: detail.slice(0, 500) });
    }
  }
}

/* ---------------------------------------------------------------- what the player gets */

export type AdaptedModuleView = {
  /** each piece's state, for "being written for you" notes */
  pieces: Record<string, { status: AdaptedStatus }>;
  hook: (HookBlock & { audio: Record<string, string> }) | null;
  videos: Record<string, ConceptVideo & { audio: string[] }>;
  worked: WorkedBlock | null;
  /** the learner's world, once set: the organisation every rewritten piece is set in */
  world: { organisation: string } | null;
};

/** The ready pieces of a module for this learner, with their clip urls; asks for the module to be rewritten if it isn't. */
export async function adaptedModule(user: SessionUser, courseId: string, moduleId: string, schedule: Schedule, deps: AdaptDeps = {}): Promise<AdaptedModuleView> {
  const empty: AdaptedModuleView = { pieces: {}, hook: null, videos: {}, worked: null, world: null };
  const e = await repo.findEnrollment(user.id, courseId);
  if (!e) return empty;
  await ensureModule(user, courseId, moduleId, schedule, deps);
  const { hash } = await inputsOf(user, e);
  const rows = (await repo.adaptedFor(e.id, moduleId)).filter((r) => r.inputs === hash);
  const view = { ...empty, pieces: Object.fromEntries(rows.map((r) => [r.piece, { status: r.status }])) };
  const world = await worldOf(e.id, hash);
  if (world) view.world = { organisation: world.organisation };
  for (const r of rows) {
    if (r.status !== "ready" || !r.content) continue;
    const audio = r.audio ?? {};
    if (r.piece === "hook") view.hook = { ...(r.content as unknown as HookBlock), audio, ...(world ? { brand: { name: world.organisation, short: world.organisation.split(/\s+/)[0]! } } : {}) };
    else if (r.piece === "worked") view.worked = r.content as unknown as WorkedBlock;
    else if (r.piece.startsWith("video:")) {
      const v = r.content as unknown as ConceptVideo;
      view.videos[v.id] = { ...v, audio: v.slides.map((_, i) => audio[`s${i}`] ?? "") };
    }
  }
  return view;
}

/** A clip file, if it belongs to one of this learner's enrollments. */
export async function adaptedAudioFile(user: SessionUser, parts: string[]): Promise<string | null> {
  const [enrollmentId, moduleId, dir, file] = parts;
  if (parts.length !== 4 || !enrollmentId || !moduleId || !dir || !file) return null;
  if (![moduleId, dir, file].every((p) => /^[\w.-]+$/.test(p)) || !file.endsWith(".wav")) return null;
  const mine = (await repo.listEnrollments(user.id)).some((e) => e.id === enrollmentId);
  if (!mine) return null;
  const full = path.join(audioRoot(), enrollmentId, moduleId, dir, file);
  return full.startsWith(audioRoot()) && fs.existsSync(full) ? full : null;
}
