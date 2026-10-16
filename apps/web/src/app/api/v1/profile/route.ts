import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { getProfile } from "@/server/repo";
import { finishProfile } from "@/server/profiling/service";
import { ProfileIn } from "@/server/validators";

const view = (p: NonNullable<Awaited<ReturnType<typeof getProfile>>>) => ({ answers: p.answers, needs: p.needs, derived: p.derived ?? null, at: p.updatedAt.toISOString() });

/** The profile answers, asked once ("About you") and reused by every course, with what the model worked out from a typed field. */
export const GET = handle(async () => {
  const p = await getProfile((await getSessionUser()).id);
  return ok({ profile: p ? view(p) : null });
});

export const PUT = handle(async (req: Request) => {
  const user = await getSessionUser();
  const { answers, needs } = await body(req, ProfileIn);
  // finishing "About you": the draft becomes the profile
  return ok({ profile: view(await finishProfile(user.id, { answers, needs })) });
});
