import { getSessionUser } from "@/server/auth";
import { ApiError, handle } from "@/server/http";
import { onboardingMedia } from "@/server/adaptive-onboarding";
export const runtime = "nodejs";
export const maxDuration = 120;
export const GET = handle(async (request: Request) => {
  const query = new URL(request.url).searchParams;
  const kind = query.get("kind");
  const rawIndex = query.get("index");
  const task = query.get("task") ?? undefined;
  if ((kind !== "audio" && kind !== "image") || (task ? !/^[a-zA-Z0-9-]{1,40}$/.test(task) : !rawIndex || !/^[0-4]$/.test(rawIndex))) throw new ApiError(400, "invalid_media", "Choose a valid scene.");
  const user = await getSessionUser();
  const media = await onboardingMedia(query.get("id") ?? "", user.id, kind, Number(rawIndex), task);
  return new Response(new Uint8Array(media.data), { headers: { "content-type": media.mimeType, "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
});
