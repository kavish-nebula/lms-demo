import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { MissionBody, createMission, missionPictures } from "@/server/mission";

/**
 * POST /api/v1/mission: a new Mission story for this learner's profile, the
 * two-minute activity that replaces the quick check. Written by Gemini when
 * GEMINI_API_KEY is set, otherwise a ready-made story. No answer key is sent.
 */
export const POST = handle(async (req: Request) => {
  const { courseId, answers } = await body(req, MissionBody);
  const user = await getSessionUser();
  const mission = await createMission(courseId, user.name, answers);
  // in development, also what each scene's picture shows, to check it fits the profile
  return ok({ mission, ...(process.env.NODE_ENV !== "production" ? { pictures: missionPictures(mission.id) } : {}) });
});
