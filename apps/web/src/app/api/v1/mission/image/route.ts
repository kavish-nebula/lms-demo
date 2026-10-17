import { missionImage } from "@/server/mission";

/**
 * GET /api/v1/mission/image?id=…&scene=0: one scene's picture, generated on
 * first request and kept. 404 when pictures are unavailable (image models
 * need billing); the player then keeps its designed backdrop.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const scene = Number(url.searchParams.get("scene"));
  const img = id && Number.isInteger(scene) ? await missionImage(id, scene) : null;
  if (!img) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(img.data), { headers: { "content-type": img.mimeType, "cache-control": "private, max-age=86400" } });
}
