import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { projectOf, saveProject } from "@/server/project";
import { ProjectSaveBody } from "@/server/validators";

type Ctx = { params: Promise<{ courseId: string }> };

/** The learner's mini project: their files (null before the first save) and the last test report. */
export const GET = handle(async (_req: Request, { params }: Ctx) => ok(await projectOf(await getSessionUser(), (await params).courseId)));

/** Saves the files the learner edits (the workspace autosaves). */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { courseId } = await params;
  const { files } = await body(req, ProjectSaveBody);
  return ok(await saveProject(await getSessionUser(), courseId, files));
});
