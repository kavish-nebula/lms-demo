import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { advanceOnboarding, OnboardingTurn } from "@/server/adaptive-onboarding";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = handle(async (request: Request) => {
  const input = await body(request, OnboardingTurn);
  const user = await getSessionUser();
  return ok({ session: await advanceOnboarding(input.id, user.id, input.response) });
});
