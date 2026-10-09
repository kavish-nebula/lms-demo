import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { getProfile, saveProfile } from "@/server/repo";
import { ProfileIn } from "@/server/validators";

const view = (p: NonNullable<Awaited<ReturnType<typeof getProfile>>>) => ({ answers: p.answers, needs: p.needs, at: p.updatedAt.toISOString() });

/** The seven profile answers, asked once and reused by every course. */
export const GET = handle(async () => {
  const p = await getProfile((await getSessionUser()).id);
  return ok({ profile: p ? view(p) : null });
});

export const PUT = handle(async (req: Request) => {
  const user = await getSessionUser();
  const { answers, needs } = await body(req, ProfileIn);
  return ok({ profile: view((await saveProfile(user.id, answers, needs))!) });
});
