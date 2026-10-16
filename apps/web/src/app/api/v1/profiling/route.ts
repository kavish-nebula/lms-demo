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
