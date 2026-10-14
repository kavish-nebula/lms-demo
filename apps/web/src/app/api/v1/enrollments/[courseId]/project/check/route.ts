import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { checkProject } from "@/server/project";
import { ProjectCheckBody } from "@/server/validators";

/** Grades a run of the hidden tickets; the report also goes to the learner's plan. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const { files, records } = await body(req, ProjectCheckBody);
  return ok(await checkProject(await getSessionUser(), courseId, files, records, after));
});
