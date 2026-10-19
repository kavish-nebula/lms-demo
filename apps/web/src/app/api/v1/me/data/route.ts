import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { deleteUserData } from "@/server/repo";
import { deleteEngagement } from "@/server/engagement";
import { deleteOnboardingData } from "@/server/adaptive-onboarding";
import { deleteProfileVoice } from "@/server/profile-voice";

/** Deletes the learner's profile, enrollments, plans, signals and progress (Settings › Reset). */
export const DELETE = handle(async () => {
  const userId = (await getSessionUser()).id;
  await deleteUserData(userId);
  await deleteEngagement(userId);
  await deleteOnboardingData(userId);
  await deleteProfileVoice(userId);
  return ok({ deleted: true });
});
