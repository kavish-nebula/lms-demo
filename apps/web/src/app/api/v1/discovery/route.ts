import { getSessionUser } from "@/server/auth";
import { DiscoveryBody, discoveryTurn } from "@/server/discovery";
import { body, handle, ok } from "@/server/http";

/**
 * POST /api/v1/discovery: the next turn of the Discovery conversation that
 * replaces the quick check. Stateless: the transcript and evidence so far come
 * with every request. Answered by Gemini when GEMINI_API_KEY is set, otherwise
 * by a short built-in script.
 */
export const POST = handle(async (req: Request) => {
  const { courseId, answers, messages, evidence, signals } = await body(req, DiscoveryBody);
  const user = await getSessionUser();
  return ok({ turn: await discoveryTurn(courseId, user.name, answers, messages, evidence, signals) });
});
