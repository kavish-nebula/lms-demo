import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { askCompanion } from "@/server/companion/service";
import { CompanionBody } from "@/server/validators";

/** POST /api/v1/courses/:courseId/companion: Pip answers one message, within this course only. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const input = await body(req, CompanionBody);
  const user = await getSessionUser();
  return ok(await askCompanion(user.id, courseId, input));
});
