import { getSessionUser } from "@/server/auth";
import { body, handle, ok } from "@/server/http";
import * as repo from "@/server/repo";
import { courseContext } from "@/server/planner/context";
import { baselinePlan } from "@/server/planner/baseline";
import { ImportBody } from "@/server/validators";

/**
 * One-time import of what the browser stored before the backend existed:
 * profile, enrollments and topics done. Existing server data wins. Imported
 * enrollments get a baseline plan; the AI plan arrives with the next setup change.
 */
export const POST = handle(async (req: Request) => {
  const user = await getSessionUser();
  const data = await body(req, ImportBody);
  let imported = 0;
  if (data.profile && !(await repo.getProfile(user.id))) {
    await repo.saveProfile(user.id, data.profile.answers, data.profile.needs);
    imported++;
  }
  for (const en of data.enrollments) {
    if (await repo.findEnrollment(user.id, en.courseId)) continue;
    const ctx = await courseContext(en.courseId).catch(() => null);
    if (!ctx) continue;
    const e = await repo.upsertEnrollment(user.id, en.courseId, {
      answers: en.answers,
      supportOverride: en.supportOverride,
      pace: null,
      precheck: en.precheck,
      enrolledAt: en.enrolledAt ? new Date(en.enrolledAt) : undefined,
    });
    const plan = baselinePlan({ name: user.name, answers: e.answers, supportOverride: e.supportOverride, pace: null, precheck: e.precheck ?? null }, ctx);
    await repo.insertPlan(e.id, { status: "ready", source: "baseline", trigger: "enrol", plan, changes: [], completedAt: new Date() });
    for (const [moduleId, stages] of Object.entries(data.progress)) {
      const m = ctx.modules.find((x) => x.id === moduleId);
      for (const s of stages) if (m?.stages.includes(s)) await repo.addProgress(e.id, moduleId, s);
    }
    imported++;
  }
  return ok({ imported });
});
