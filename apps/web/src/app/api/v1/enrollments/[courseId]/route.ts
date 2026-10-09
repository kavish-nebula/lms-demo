import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { ApiError, body, handle, ok } from "@/server/http";
import { deleteEnrollment, findEnrollment } from "@/server/repo";
import { enrollmentOf, saveSetup } from "@/server/planner/service";
import { SetupBody } from "@/server/validators";

type Ctx = { params: Promise<{ courseId: string }> };

/** The enrollment, its current plan, and any plan being written. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { courseId } = await params;
  return ok({ enrollment: await enrollmentOf(await getSessionUser(), courseId) });
});

/** Changed setup (Customise, a retaken quick check, profile answers applied to the course). Re-plans. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { courseId } = await params;
  const user = await getSessionUser();
  const setup = await body(req, SetupBody);
  if (!(await findEnrollment(user.id, courseId))) throw new ApiError(404, "not_enrolled", `You are not enrolled in "${courseId}".`);
  return ok({ enrollment: await saveSetup(user, courseId, setup, after) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { courseId } = await params;
  await deleteEnrollment((await getSessionUser()).id, courseId);
  return ok({ deleted: true });
});
