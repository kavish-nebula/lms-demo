// Kokoro voice worker: a plain Node process that the web server starts
// (src/server/ai/kokoro.ts) and talks to over IPC. Running the model here,
// outside Next.js, keeps it on the fast native ONNX runtime and keeps heavy
// CPU work off the web server. One line at a time: { id, text, voice } in,
// { id, wav } (base64, 16-bit mono WAV) or { id, error } out.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "package.json"));
const { KokoroTTS } = require("kokoro-js");
const { env } = require("@huggingface/transformers");

env.cacheDir = path.join(here, "..", ".data", "models");
const model = process.env.KOKORO_MODEL?.trim() || "onnx-community/Kokoro-82M-v1.0-ONNX";
const dtype = process.env.KOKORO_DTYPE?.trim() || "q8";
const ready = KokoroTTS.from_pretrained(model, { dtype, device: "cpu" });

/** 32-bit float samples → a 16-bit mono WAV file. */
function wav16(samples, rate) {
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + samples.length * 2, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return out;
}

process.on("message", async ({ id, text, voice }) => {
  try {
    const tts = await ready;
    const v = voice in tts.voices ? voice : "af_heart";
    const { audio, sampling_rate } = await tts.generate(text, { voice: v });
    process.send({ id, wav: wav16(audio, sampling_rate).toString("base64") });
  } catch (e) {
    process.send({ id, error: e instanceof Error ? e.message : String(e) });
  }
});

// the server went away: so do we
process.on("disconnect", () => process.exit(0));
