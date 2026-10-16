import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appRoot } from "@/server/db/client";

/**
 * Narration for adapted pieces. Two voices:
 *  - Gemini text-to-speech (AUDIO_PROVIDER=gemini, AUDIO_API_KEY): a few clips
 *    at a time over the API, so a module is voiced in minutes;
 *  - Kokoro in a worker process (scripts/tts-worker.mjs), one job at a time on
 *    the CPU (fp32, about 4× real time; KOKORO_DEVICE picks a GPU where one can
 *    run it): the fallback when the API is busy or out of quota, and the voice
 *    when no audio key is set.
 * A piece is spoken by one voice throughout: if Gemini can't finish it,
 * Kokoro speaks all of it again. Clips are 24 kHz WAV files under
 * .data/adapted-audio, served to their learner by /api/v1/adapted-audio.
 * AUDIO=off skips voicing (adapted pieces then play with captions only);
 * KOKORO=off leaves Kokoro out.
 */

export type Clip = { key: string; text: string };
/** Speaks the clips into `dir`; resolves with the keys that were written. */
export type Voicer = (dir: string, clips: Clip[]) => Promise<Set<string>>;

export const audioRoot = () => path.join(appRoot(), ".data", "adapted-audio");
export const voiceOn = () => process.env.AUDIO !== "off";
const kokoroOn = () => process.env.KOKORO !== "off";
const VOICE = () => process.env.KOKORO_VOICE ?? "am_michael";

let queue: Promise<unknown> = Promise.resolve();

export const kokoro: Voicer = (dir, clips) => {
  const run = () => speak(dir, clips);
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
};

function speak(dir: string, clips: Clip[]): Promise<Set<string>> {
  const todo = clips.filter((c) => c.text.trim());
  if (!todo.length) return Promise.resolve(new Set());
  const outOf = (key: string) => path.join(dir, `${key}.wav`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(appRoot(), "scripts", "tts-worker.mjs")], { cwd: appRoot(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const written = new Set<string>();
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
      let nl: number;
      while ((nl = out.indexOf("\n")) >= 0) {
        const line = out.slice(0, nl).trim();
        out = out.slice(nl + 1);
        const done = todo.find((c) => line === `ok ${outOf(c.key)}`);
        if (done) written.add(done.key);
        else if (line.startsWith("fail ")) console.warn(`[adapt] voice: ${line}`);
      }
    });
    let err = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => (err = (err + c).slice(-2000)));
    child.on("error", (e) => {
      console.warn(`[adapt] voice worker did not start: ${e.message}`);
      resolve(written);
    });
    child.on("close", (code) => {
      if (code) console.warn(`[adapt] voice worker exited with ${code}: ${err.trim().split("\n").at(-1) ?? ""}`);
      resolve(written);
    });
    fs.mkdirSync(dir, { recursive: true });
    child.stdin.end(JSON.stringify({ voice: VOICE(), clips: todo.map((c) => ({ text: spoken(c.text), out: outOf(c.key) })) }));
  });
}

/** The voice for this server: Gemini (with Kokoro behind it) when an audio key is set, else Kokoro; null when voicing is off. */
export function defaultVoicer(): Voicer | null {
  if (!voiceOn()) return null;
  const key = process.env.AUDIO_API_KEY;
  const provider = process.env.AUDIO_PROVIDER ?? (key ? "gemini" : "kokoro");
  const backup = kokoroOn() ? kokoro : null;
  if (provider === "gemini" && key) {
    const primary = gemini({ key, model: process.env.AUDIO_MODEL ?? "gemini-3.8-flash-lite-tts", voice: process.env.AUDIO_VOICE ?? "Charon", style: process.env.AUDIO_STYLE });
    return backup ? withFallback(primary, backup) : primary;
  }
  return backup;
}

/** The primary voice, and the backup speaking the whole piece again when the primary couldn't finish it. */
export function withFallback(primary: Voicer, backup: Voicer): Voicer {
  return async (dir, clips) => {
    const todo = clips.filter((c) => c.text.trim());
    const done = await primary(dir, todo);
    if (done.size >= todo.length) return done;
    console.warn(`[adapt] voice: ${todo.length - done.size} of ${todo.length} clips not spoken by the API; Kokoro speaks this piece instead`);
    return backup(dir, todo);
  };
}

export type GeminiVoice = { key: string; model: string; voice: string; style?: string; concurrency?: number; fetchImpl?: typeof fetch; backoffMs?: number };

const DEFAULT_STYLE = "A warm, clear course narrator explaining a lesson to an adult learner, at a steady, unhurried pace.";
/** Until when a model's quota is used up (per process). */
const spent = new Map<string, number>();

/** Gemini text-to-speech (the Interactions API): each clip is one request, a few at a time. */
export function gemini(o: GeminiVoice): Voicer {
  const f = o.fetchImpl ?? fetch;
  const backoff = o.backoffMs ?? 2000;
  return async (dir, clips) => {
    const written = new Set<string>();
    const todo = clips.filter((c) => c.text.trim());
    if ((spent.get(o.model) ?? 0) > Date.now()) return written;
    fs.mkdirSync(dir, { recursive: true });
    let stop = false;
    let next = 0;
    const one = async (clip: Clip) => {
      let why = "";
      for (let attempt = 0; attempt < 6 && !stop; attempt++) {
        let res: Response;
        try {
          res = await f("https://generativelanguage.googleapis.com/v1beta/interactions", {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": o.key },
            body: JSON.stringify({
              model: o.model,
              input: [{ type: "user_input", content: [{ type: "text", text: spoken(clip.text), annotations: [{ type: "speech_metadata", style: o.style ?? DEFAULT_STYLE }] }] }],
              response_format: { type: "audio" },
              generation_config: { speech_config: [{ voice: o.voice }] },
            }),
            signal: AbortSignal.timeout(90_000),
          });
        } catch (e) {
          why = e instanceof Error ? e.message : String(e);
          await sleep(backoff * (attempt + 1));
          continue;
        }
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as { steps?: { content?: { data?: string }[] }[] } | null;
          const part = (json?.steps ?? []).flatMap((s) => s.content ?? []).find((c) => c.data);
          if (!part?.data) {
            why = "no audio in the reply";
            continue;
          }
          const bytes = Buffer.from(part.data, "base64");
          const file = path.join(dir, `${clip.key}.wav`);
          fs.writeFileSync(`${file}.part`, bytes.subarray(0, 4).toString("ascii") === "RIFF" ? bytes : wavOf(bytes, 24_000));
          fs.renameSync(`${file}.part`, file);
          written.add(clip.key);
          return;
        }
        const body = await res.text().catch(() => "");
        const retryIn = retryDelayMs(body, res.headers.get("retry-after"));
        if (res.status === 429) {
          // a per-minute limit says to retry in seconds: wait and go on; a used-up daily quota hands over to the backup voice
          if (retryIn !== null && retryIn <= 90_000) {
            why = `rate limited (retry in ${Math.round(retryIn / 1000)} s)`;
            await sleep(Math.max(retryIn, backoff));
            continue;
          }
          if (/quota|RESOURCE_EXHAUSTED|billing/i.test(body)) {
            const ms = retryIn ?? 15 * 60_000;
            spent.set(o.model, Date.now() + ms);
            console.warn(`[adapt] voice (${o.model}): quota used up; the backup voice speaks for ${Math.round(ms / 60_000)} min`);
            stop = true;
            return;
          }
        }
        if (res.status === 429 || res.status >= 500) {
          why = `HTTP ${res.status} ${body.slice(0, 120)}`;
          await sleep(backoff * 2 ** attempt);
          continue;
        }
        console.warn(`[adapt] voice (${o.model}) ${clip.key}: HTTP ${res.status} ${body.slice(0, 200)}`);
        stop = res.status === 401 || res.status === 403 || res.status === 404;
        return;
      }
      if (!written.has(clip.key) && !stop) console.warn(`[adapt] voice (${o.model}) ${clip.key}: gave up (${why || "no reply"})`);
    };
    const lanes = Array.from({ length: Math.min(o.concurrency ?? 2, todo.length) }, async () => {
      while (!stop && next < todo.length) await one(todo[next++]!);
    });
    await Promise.all(lanes);
    return written;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How long the API asks us to wait: its RetryInfo ("retryDelay": "23s"), "retry in 1m2s", or a Retry-After header. */
export function retryDelayMs(body: string, header?: string | null): number | null {
  const info = /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(body);
  if (info) return Math.round(Number(info[1]) * 1000);
  const text = /retry in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/i.exec(body);
  if (text && (text[1] || text[2] || text[3])) return Math.round(((+(text[1] ?? 0) * 60 + +(text[2] ?? 0)) * 60 + +(text[3] ?? 0)) * 1000);
  if (header && /^\d+$/.test(header.trim())) return Number(header.trim()) * 1000;
  return null;
}

/** Raw 16-bit mono PCM as a WAV file. */
function wavOf(pcm: Buffer, rate: number): Buffer {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** A line as the voice should say it: codes digit by digit, snake_case and symbols as words. */
export function spoken(text: string): string {
  return text
    .replace(/\b([A-Z]{2,5})-(\d{2,})\b/g, (_, p: string, d: string) => `${p.split("").join(" ")} ${d.split("").join(" ")}`)
    .replace(/\b(\w+)_(\w+)\b/g, "$1 $2")
    .replace(/→/g, " returns ")
    .replace(/(\w)@(\w+)\.com/g, "$1 at $2 dot com")
    .replace(/\s+/g, " ")
    .trim();
}
