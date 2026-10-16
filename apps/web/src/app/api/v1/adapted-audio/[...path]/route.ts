import fs from "node:fs";
import { getSessionUser } from "@/server/auth";
import { ApiError, handle } from "@/server/http";
import { adaptedAudioFile } from "@/server/adapt/service";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET: one narration clip of a rewritten lesson piece, only to the learner it
 * was made for. Byte ranges are honoured, so the player can seek and browsers
 * read the clip's length without loading it all.
 */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { path } = await params;
  const file = await adaptedAudioFile(await getSessionUser(), path);
  if (!file) throw new ApiError(404, "not_found", "No such clip.");
  const data = await fs.promises.readFile(file);
  const headers = { "Content-Type": "audio/wav", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = data.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
});
