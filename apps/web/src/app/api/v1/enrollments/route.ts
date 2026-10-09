import { after } from "next/server";
import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import { enrollmentsOf, saveSetup } from "@/server/planner/service";
import { EnrolBody } from "@/server/validators";

/** Every course the learner is enrolled in, each with its current plan. */
export const GET = handle(async () => ok({ enrollments: await enrollmentsOf(await getSessionUser()) }));

/** Enrol: a baseline plan is stored at once; the AI plan follows in the background. */
export const POST = handle(async (req: Request) => {
  const user = await getSessionUser();
  const { courseId, ...setup } = await body(req, EnrolBody);
  return ok({ enrollment: await saveSetup(user, courseId, setup, after) }, 201);
});
