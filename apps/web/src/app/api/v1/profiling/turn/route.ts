import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { interviewTurn } from "@/server/profiling/interview";
import { InterviewTurnIn } from "@/server/validators";

/**
 * POST /api/v1/profiling/turn: one turn of the "About you" interview. Stores
 * the last answer (the learner's field on the first turn), then returns Pip's
 * next question, written by the language model for this learner, or `done`.
 * The answers so far are saved as a draft each turn.
 */
export const POST = handle(async (req: Request) => {
  const input = await body(req, InterviewTurnIn);
  return ok({ interview: await interviewTurn((await getSessionUser()).id, input) });
});
