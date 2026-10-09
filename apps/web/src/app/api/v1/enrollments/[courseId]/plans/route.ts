import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { planHistory } from "@/server/planner/service";

/** Every version of the learner's plan, newest first: the adaptation log. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  return ok({ plans: await planHistory(await getSessionUser(), courseId) });
});
