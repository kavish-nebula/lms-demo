import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { recordSignals } from "@/server/planner/service";
import { SignalsBody } from "@/server/validators";

/** Answers from lessons: in-video checks, recall, final check, capstone checks. Idempotent by signal id. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const { signals } = await body(req, SignalsBody);
  const result = await recordSignals(
    await getSessionUser(),
    courseId,
    signals.map((s) => ({ key: s.id, kind: s.kind, moduleId: s.moduleId, lesson: s.lesson, payload: s.payload })),
    after,
  );
  return ok(result, 202);
});
