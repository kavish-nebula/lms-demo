import { body, handle, ok } from "@/server/http";
import { getSessionUser } from "@/server/auth";
import { ProfileConversationBody, profileConversationTurn } from "@/server/profiling";
import { registerProfileVoice } from "@/server/profile-voice";

export const runtime = "nodejs";
export const POST = handle(async (req: Request) => {
  const input = await body(req, ProfileConversationBody);
  const user = await getSessionUser();
  const turn = await profileConversationTurn(input);
  const [questionAudio, replyAudio] = await Promise.all([
    registerProfileVoice(user.id, turn.question?.text ?? ""), registerProfileVoice(user.id, turn.reply),
  ]);
  return ok({ ...turn, questionAudio, replyAudio });
});
