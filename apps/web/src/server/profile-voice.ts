import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { geminiSpeech, ttsChain } from "@/server/ai/gemini-tts";
import { ApiError } from "@/server/http";
import { appRoot } from "@/server/db/client";

const directory = () => path.join(appRoot(), ".data", "profile-voice");
const pending = ((globalThis as { __profileSpeech?: Map<string, Promise<Buffer>> }).__profileSpeech ??= new Map());

/** Only server-produced conversation lines can be spoken by the media endpoint. */
export async function registerProfileVoice(owner: string, text: string): Promise<string | null> {
  if (!text) return null;
  const id = createHash("sha256").update(JSON.stringify([owner, text, ttsChain(), process.env.GEMINI_TTS_VOICE ?? "Kore"])).digest("hex");
  await mkdir(directory(), { recursive: true });
  await writeFile(path.join(directory(), `${id}.json`), JSON.stringify({ owner, text, at: Date.now() }));
  return `/api/v1/profiling/voice?id=${id}`;
}

export async function profileVoice(id: string, owner: string): Promise<Buffer> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(404, "not_found", "Voice not found.");
  const record = await readFile(path.join(directory(), `${id}.json`), "utf8").then((s) => JSON.parse(s) as { owner: string; text: string; at: number }).catch(() => null);
  if (!record || record.owner !== owner || Date.now() - record.at > 7 * 86400_000) throw new ApiError(404, "not_found", "Voice not found.");
  const file = path.join(directory(), `${id}.wav`);
  const cached = await readFile(file).catch(() => null);
  if (cached) return cached;
  const existing = pending.get(id);
  if (existing) return existing;
  const job = (async () => {
    const speech = await geminiSpeech({ text: record.text, voice: "Kore" });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, speech.data);
    await rename(temporary, file);
    return speech.data;
  })();
  pending.set(id, job);
  try { return await job; } finally { pending.delete(id); }
}

export async function deleteProfileVoice(owner: string) {
  for (const name of await readdir(directory()).catch(() => [] as string[])) {
    if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
    const record = await readFile(path.join(directory(), name), "utf8").then((s) => JSON.parse(s) as { owner?: string }).catch(() => null);
    if (record?.owner === owner) {
      await unlink(path.join(directory(), name));
      await unlink(path.join(directory(), name.replace(/\.json$/, ".wav"))).catch(() => {});
    }
  }
}
