import "server-only";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";

/**
 * Kokoro, a small open text-to-speech model (82M parameters, Apache 2.0),
 * run on this machine's CPU through kokoro-js, in a worker process: free,
 * no account, no limits.
 * The model (about 90 MB) is downloaded from Hugging Face on first use and
 * kept in apps/web/.data/models. A line of speech takes roughly two thirds of
 * its own length to make.
 *
 * Lines are made one at a time (generation is CPU-heavy), in two lanes:
 * "now" for what a learner is waiting to hear, "later" for recording ahead
 * (the rest of a Mission story, the companion's fixed lines). A "now" request
 * always goes before anything waiting in "later", and asking "now" for a line
 * already waiting in "later" moves it up.
 *
 *   KOKORO_MODEL   default onnx-community/Kokoro-82M-v1.0-ONNX
 *   KOKORO_DTYPE   default q8 (smaller and faster; fp32 for the best quality)
 */

export type Lane = "now" | "later";
type Job = { key: string; text: string; voice: string; lane: Lane; promise: Promise<Buffer>; resolve: (b: Buffer) => void; reject: (e: unknown) => void };
type Reply = { id: number; wav?: string; error?: string };

// one worker and one queue per server process, shared across route bundles (the dev server may load this module per route)
const g = globalThis as { __kokoroWorkerV2?: ChildProcess; __kokoroJobsV2?: Job[]; __kokoroBusyV2?: boolean; __kokoroSeqV2?: number };
const jobs = (g.__kokoroJobsV2 ??= []);

/**
 * The model runs in its own Node process (scripts/kokoro-worker.mjs): inside
 * Next.js it ran about four times slower, and a separate process keeps heavy
 * CPU work off the web server. Started on first use; restarted if it stops.
 */
function worker(): ChildProcess {
  const w = g.__kokoroWorkerV2;
  if (w && w.connected && w.exitCode === null) return w;
  const script = path.join(process.cwd(), "scripts", "kokoro-worker.mjs");
  const next = fork(script, [], { stdio: ["ignore", "ignore", "inherit", "ipc"], env: process.env });
  next.on("exit", () => {
    if (g.__kokoroWorkerV2 === next) g.__kokoroWorkerV2 = undefined;
  });
  g.__kokoroWorkerV2 = next;
  return next;
}

/** One line from the worker. */
function generate(text: string, voice: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const w = worker();
    const id = (g.__kokoroSeqV2 = (g.__kokoroSeqV2 ?? 0) + 1);
    const onMessage = (m: Reply) => {
      if (m.id !== id) return;
      cleanup();
      if (m.wav) resolve(Buffer.from(m.wav, "base64"));
      else reject(new Error(m.error ?? "Kokoro failed"));
    };
    const onExit = () => {
      cleanup();
      reject(new Error("The Kokoro worker stopped"));
    };
    const cleanup = () => {
      w.off("message", onMessage);
      w.off("exit", onExit);
    };
    w.on("message", onMessage);
    w.on("exit", onExit);
    w.send({ id, text, voice });
  });
}

/** Runs the queue: always the oldest "now" job first, else the oldest "later" one. */
async function pump() {
  if (g.__kokoroBusyV2) return;
  g.__kokoroBusyV2 = true;
  try {
    for (;;) {
      const i = jobs.findIndex((j) => j.lane === "now");
      const job = jobs.splice(i >= 0 ? i : 0, 1)[0];
      if (!job) break;
      try {
        job.resolve(await generate(job.text, job.voice));
      } catch (e) {
        job.reject(e);
      }
    }
  } finally {
    g.__kokoroBusyV2 = false;
  }
}

/** At most this many lines wait in the "later" lane, so recording ahead can never pile up in front of anyone. */
const MAX_LATER = 4;

/** One line as WAV, spoken by a Kokoro voice (e.g. af_heart, am_michael, bf_emma). */
export function kokoroSpeech(text: string, voice: string, lane: Lane = "now"): Promise<Buffer> {
  const key = `${voice}|${text}`;
  const waiting = jobs.find((j) => j.key === key);
  if (waiting) {
    if (lane === "now") waiting.lane = "now"; // someone is waiting for it now: move it up
    return waiting.promise;
  }
  // recording ahead is full: skip this one; it is made when someone actually asks for it
  if (lane === "later" && jobs.filter((j) => j.lane === "later").length >= MAX_LATER) return Promise.reject(new SkippedAhead());
  let resolve!: (b: Buffer) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Buffer>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  jobs.push({ key, text, voice, lane, promise, resolve, reject });
  void pump();
  return promise;
}

/** Recording ahead was skipped because the "later" lane was full (not an error). */
export class SkippedAhead extends Error {
  constructor() {
    super("recording ahead is full");
  }
}

/** Moves a line that is still waiting into the "now" lane (no effect once it is being made). */
export function kokoroPromote(text: string, voice: string) {
  const waiting = jobs.find((j) => j.key === `${voice}|${text}`);
  if (waiting) waiting.lane = "now";
}

/** Off only when VOICE_PROVIDER says so; Kokoro needs no key. */
export const kokoroEnabled = () => (process.env.VOICE_PROVIDER?.trim() || "kokoro") === "kokoro";
