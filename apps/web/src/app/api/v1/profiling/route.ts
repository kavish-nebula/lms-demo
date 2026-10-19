import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { discardDraft, profilingState } from "@/server/profiling/service";

/** GET /api/v1/profiling: "About you" as it stands (a draft in progress, else the saved profile), with the questions to ask. */
export const GET = handle(async () => ok({ profiling: await profilingState((await getSessionUser()).id) }));

/** DELETE /api/v1/profiling: discards the draft in progress ("start over"); a saved profile is kept. */
export const DELETE = handle(async () => {
  await discardDraft((await getSessionUser()).id);
  return ok({ discarded: true });
});

import { body } from "@/server/http";
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
