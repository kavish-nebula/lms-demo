import { body, handle, ok } from "@/server/http";
import { MissionFinishBody, finishMission } from "@/server/mission";

/**
 * POST /api/v1/mission/finish: the learner's choices (and their one "why")
 * in, levels per module and the ideas they showed out. Scored here, against
 * the key that never left the server.
 */
export const POST = handle(async (req: Request) => {
  const { id, answers, why } = await body(req, MissionFinishBody);
  return ok({ result: await finishMission(id, answers, why) });
});
