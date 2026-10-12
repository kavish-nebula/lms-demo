import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { deleteUserData } from "@/server/repo";
import { deleteEngagement } from "@/server/engagement";

/** Deletes the learner's profile, enrollments, plans, signals and progress (Settings › Reset). */
export const DELETE = handle(async () => {
  const userId = (await getSessionUser()).id;
  await deleteUserData(userId);
  await deleteEngagement(userId);
  return ok({ deleted: true });
});
