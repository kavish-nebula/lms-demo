import { getCourse } from "@/data";
import { getSessionUser } from "@/server/auth";
import { ApiError, body, handle, ok } from "@/server/http";
import { courseTurn } from "@/server/profiling/interview";
import { CourseFitIn } from "@/server/validators";

/**
 * POST /api/v1/courses/:courseId/fit: one turn of the enrolment questions for
 * this course (what the learner wants from it, what they already know of it,
 * what they would use it for). The profile is read from the server; the reply
 * carries only the course answers, which the client keeps until the
 * enrolment is saved. Nothing is stored here.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await params;
  const input = await body(req, CourseFitIn);
  const course = await getCourse(courseId);
  if (!course) throw new ApiError(404, "not_found", "Unknown course.");
  return ok({ interview: await courseTurn((await getSessionUser()).id, course, input) });
});
