import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { profilingStep } from "@/server/profiling/service";
import { ProfilingNextIn } from "@/server/validators";

/**
 * POST /api/v1/profiling/next: saves "About you" so far and returns it
 * normalised, with the questions as they now stand. A newly typed field is
 * analysed first (a keyword match, refined by the language model when one is
 * configured), which can bring that field's questions and follow-ups.
 */
export const POST = handle(async (req: Request) => {
  const input = await body(req, ProfilingNextIn);
  return ok({ profiling: await profilingStep((await getSessionUser()).id, input) });
});
