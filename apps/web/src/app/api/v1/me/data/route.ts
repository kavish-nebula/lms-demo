import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { deleteUserData } from "@/server/repo";

/** Deletes the learner's profile, enrollments, plans, signals and progress (Settings › Reset). */
export const DELETE = handle(async () => {
  await deleteUserData((await getSessionUser()).id);
  return ok({ deleted: true });
});
