import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { OnboardingStart, startOnboarding } from "@/server/adaptive-onboarding";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = handle(async (request: Request) => {
  const input = await body(request, OnboardingStart);
  const user = await getSessionUser();
  return ok({ session: await startOnboarding(user.id, input.courseId, input.answers) });
});
