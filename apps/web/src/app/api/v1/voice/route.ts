import * as z from "zod/v4";
import { getSessionUser } from "@/server/auth";
import { body, handle } from "@/server/http";
import { speak } from "@/server/voice";

const VoiceBody = z.object({
  text: z.string().trim().min(1).max(400),
  /** recording ahead (the companion's fixed lines): waits behind anything a learner is waiting for */
  ahead: z.boolean().default(false),
});

/**
 * POST /api/v1/voice: one line from the companion (the learner's agent) as
 * WAV, spoken by the local Kokoro voice and kept on disk, so a line is made
 * once. 404 when no voice is available; the browser then reads it itself.
 */
export const POST = handle(async (req: Request) => {
  await getSessionUser(); // signed-in learners only
  const { text, ahead } = await body(req, VoiceBody);
  const audio = await speak(text, "companion", ahead ? "later" : "now");
  if (!audio) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "content-type": "audio/wav", "content-length": String(audio.length), "cache-control": "private, max-age=86400" } });
});
