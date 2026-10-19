import "server-only";
import { googleGenerateContent } from "./google-transport";
import { GeminiError, geminiChain, geminiConfigured } from "@/server/ai/gemini";
import { matchesTranscript } from "@/lib/transcript";

/**
 * Spoken narration from Gemini's text-to-speech models, for the Mission.
 * Kept apart from gemini.ts (like gemini-image.ts) but sharing its cool-down
 * list. The newest models return a WAV file; older ones return raw 16-bit
 * PCM, which is wrapped in a WAV header here so any browser can play it.
 *
 *   GEMINI_TTS_MODEL   comma-separated chain (default below)
 *   GEMINI_TTS_VOICE   one prebuilt voice for everything (default: chosen per audience)
 */

const DEFAULT_CHAIN = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];

const coolingUntil: Map<string, number> = ((globalThis as { __geminiCooling?: Map<string, number> }).__geminiCooling ??= new Map());
const ready = (model: string) => (coolingUntil.get(model) ?? 0) <= Date.now();

export const ttsChain = () => {
  const override = process.env.GEMINI_TTS_MODEL?.split(",").map((m) => m.trim()).filter(Boolean);
  return override?.length ? override : DEFAULT_CHAIN;
};
/** True when a voice model may be tried. */
export const geminiVoiceReady = () => geminiConfigured() && ttsChain().some(ready);

type AudioResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
  error?: { message?: string; details?: { retryDelay?: string }[] };
};

/** Raw 16-bit mono PCM → a playable WAV file. */
function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/**
 * One spoken line as WAV, checked to say exactly the given text. The models
 * sometimes answer a line instead of reading it, so each recording is
 * transcribed by a fast text model and compared (lib/transcript.ts). On a
 * mismatch the line is recorded once more, framed as text to read word for
 * word; if that fails too, it is refused and the caller falls back to the
 * browser's voice. When the check itself can't run (quota), the recording
 * is kept. No delivery notes are added: on short lines the models read them
 * out loud.
 */
export async function geminiSpeech(req: { text: string; voice: string; deadlineMs?: number }): Promise<{ data: Buffer; model: string }> {
  const voice = process.env.GEMINI_TTS_VOICE?.trim() || req.voice;
  const deadline = Date.now() + (req.deadlineMs ?? 45_000);
  const prompts = [req.text, `Read the following text aloud exactly as written, word for word, and say nothing else:\n\n${req.text}`];
  for (const prompt of prompts) {
    const out = await synthesize(prompt, voice, deadline);
    const heard = await transcribe(out.data).catch(() => null);
    if (heard === null || matchesTranscript(req.text, heard)) return out;
    console.warn(`[tts] ${out.model} said "${heard.slice(0, 80)}" instead of "${req.text.slice(0, 80)}"`);
  }
  throw new GeminiError("The voice did not read the line as written", 422);
}

/** Speech for one prompt from the first voice model that answers. */
async function synthesize(prompt: string, voice: string, deadline: number): Promise<{ data: Buffer; model: string }> {
  if (!geminiConfigured()) throw new GeminiError("Google AI is not configured");
  const chain = ttsChain().filter(ready);
  if (!chain.length) throw new GeminiError("Voice models are paused", 429);
  let lastError: GeminiError | null = null;
  for (const model of chain) {
    const left = deadline - Date.now();
    if (left < 2000) break;
    try {
      const res = await googleGenerateContent(model, {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: model.startsWith("gemini-3.8-") ? { voice } : { prebuiltVoiceConfig: { voiceName: voice } } } },
        }, AbortSignal.timeout(left));
      const data = (await res.json().catch(() => ({}))) as AudioResponse;
      if (!res.ok) {
        const message = data.error?.message ?? `Gemini HTTP ${res.status}`;
        const delay = data.error?.details?.find((d) => d.retryDelay)?.retryDelay;
        // no quota at all: 10 minutes; out of requests for now: Google's delay (a minute by default); overloaded: 20 seconds
        if (res.status === 429) coolingUntil.set(model, Date.now() + (/limit: 0\b/.test(message) ? 10 * 60_000 : Math.min((parseFloat(delay ?? "60") || 60) * 1000, 10 * 60_000)));
        else if (res.status >= 500) coolingUntil.set(model, Date.now() + 20_000);
        throw new GeminiError(message, res.status, model);
      }
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!part) throw new GeminiError("Gemini returned no audio", null, model);
      const bytes = Buffer.from(part.data, "base64");
      if (bytes.subarray(0, 4).toString("ascii") === "RIFF") return { data: bytes, model };
      const rate = Number(/rate=(\d+)/i.exec(part.mimeType)?.[1]) || 24_000;
      return { data: wav(bytes, rate), model };
    } catch (e) {
      lastError = e instanceof GeminiError ? e : new GeminiError(e instanceof Error ? e.message : String(e), null, model);
      // a bad key or a refused text fails the same way on every model
      if (lastError.status !== null && lastError.status !== 404 && lastError.status !== 429 && lastError.status < 500) break;
    }
  }
  throw lastError ?? new GeminiError("No voice model answered");
}

/** What a recording says, from the first fast text model that answers; throws when none can. */
async function transcribe(wavData: Buffer): Promise<string> {
  if (!geminiConfigured()) throw new GeminiError("Google AI is not configured");
  for (const model of geminiChain("fast").filter(ready)) {
    const res = await googleGenerateContent(model, {
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wavData.toString("base64") } }, { text: "Transcribe this audio word for word. Reply with only the words spoken." }] }],
        generationConfig: { temperature: 0 },
      }, AbortSignal.timeout(15_000)).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    if (text) return text;
  }
  throw new GeminiError("No model could transcribe the recording");
}
