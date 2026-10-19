import { missionVoice } from "@/server/mission";

/**
 * GET /api/v1/mission/voice?id=…&line=scene-0: one narration line as WAV,
 * spoken by Gemini (started in the background when the story was written,
 * so usually ready). 404 when the voice is unavailable; the player then reads
 * the line with the browser's voice.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const line = url.searchParams.get("line") ?? "";
  // ahead=1: the player recording the next line while the current one plays (waits behind anything urgent)
  const audio = id && line ? await missionVoice(id, line, url.searchParams.get("ahead") ? "later" : "now") : null;
  if (!audio) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "content-type": "audio/wav", "content-length": String(audio.length), "cache-control": "private, max-age=86400" } });
}
