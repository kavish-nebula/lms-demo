import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { geminiSpeech, geminiVoiceReady } from "@/server/ai/gemini-tts";
import { SkippedAhead, kokoroEnabled, kokoroPromote, kokoroSpeech, type Lane } from "@/server/ai/kokoro";

/**
 * Spoken lines for the companion and the Mission. Kokoro (local, free) by
 * default; VOICE_PROVIDER=gemini uses Gemini's voices instead (needs a key
 * and has daily limits on the free plan). Every line is made once and kept
 * on disk by provider, voice and text, so repeats cost nothing.
 */

export type VoiceProvider = "kokoro" | "gemini";
export const voiceProvider = (): VoiceProvider => (process.env.VOICE_PROVIDER?.trim() === "gemini" ? "gemini" : "kokoro");
export const voiceReady = () => (voiceProvider() === "gemini" ? geminiVoiceReady() : kokoroEnabled());

/** Voices by role. Kokoro names its voices by accent and gender (af = American female, bm = British male…). */
export const VOICES = {
  kokoro: { companion: "af_heart", learner: "af_bella", professional: "am_michael", executive: "bf_emma" },
  gemini: { companion: "Aoede", learner: "Puck", professional: "Charon", executive: "Kore" },
} as const;
export type VoiceRole = keyof (typeof VOICES)["kokoro"];

const DIR = path.join(process.cwd(), ".data", "voice");
const g = globalThis as { __voicePending?: Map<string, Promise<Buffer | null>> };
const pending = (g.__voicePending ??= new Map());

/**
 * One line as WAV in a role's voice; null when no voice is available.
 * `lane`: "now" when a learner is waiting to hear it, "later" when recording
 * ahead (asking "now" for a line already waiting moves it up).
 */
export function speak(text: string, role: VoiceRole, lane: Lane = "now"): Promise<Buffer | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!clean || !voiceReady()) return Promise.resolve(null);
  const provider = voiceProvider();
  const voice = VOICES[provider][role];
  const key = createHash("sha1").update(`${provider}|${voice}|${clean}`).digest("hex").slice(0, 24);
  let p = pending.get(key);
  if (p && lane === "now" && provider === "kokoro") kokoroPromote(clean, voice);
  if (!p) {
    p = make(key, clean, provider, voice, lane)
      .catch((e: unknown) => {
        if (!(e instanceof SkippedAhead)) console.error(`[voice] ${provider}:`, e instanceof Error ? e.message.slice(0, 200) : e);
        return null;
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

async function make(key: string, text: string, provider: VoiceProvider, voice: string, lane: Lane): Promise<Buffer> {
  const file = path.join(DIR, `${key}.wav`);
  const cached = await readFile(file).catch(() => null);
  if (cached) return cached;
  const data = provider === "gemini" ? (await geminiSpeech({ text, voice })).data : await kokoroSpeech(text, voice, lane);
  await mkdir(DIR, { recursive: true });
  await writeFile(file, data).catch(() => undefined);
  return data;
}
