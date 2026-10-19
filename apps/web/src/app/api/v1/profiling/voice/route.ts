import { handle } from "@/server/http";
import { getSessionUser } from "@/server/auth";
import { profileVoice } from "@/server/profile-voice";

export const runtime = "nodejs";
export const maxDuration = 120;
export const GET = handle(async (req: Request) => {
  const user = await getSessionUser();
  const data = await profileVoice(new URL(req.url).searchParams.get("id") ?? "", user.id);
  return new Response(new Uint8Array(data), { headers: { "content-type": "audio/wav", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
});
