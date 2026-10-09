import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { recordProgress } from "@/server/planner/service";
import { ProgressBody } from "@/server/validators";

/** Marks a topic done and returns the enrollment, so the client updates in one step. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const { moduleId, stage } = await body(req, ProgressBody);
  return ok({ enrollment: await recordProgress(await getSessionUser(), courseId, moduleId, stage, after) });
});
