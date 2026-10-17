import { body, handle, ok } from "@/server/http";
import { ProfilingBody, nextProfileQuestion } from "@/server/profiling";

/**
 * POST /api/v1/profiling: the "About you" question for a slot, written live
 * from the questions and answers so far. Written by Gemini when
 * GEMINI_API_KEY is set; otherwise (and as a fallback) from a built-in bank.
 */
export const POST = handle(async (req: Request) => {
  const { courseId, slot, answers } = await body(req, ProfilingBody);
  return ok({ question: await nextProfileQuestion(courseId, slot, answers) });
});
