import "server-only";
import { z } from "zod/v4";
import { getSessionUser } from "./auth";
import { handle, ok, body, ApiError } from "./http";
import { requireEngagement, readEngagement, changeEngagement, reconcileEngagement, assertLogDate, applyGrace, setTarget } from "./engagement";
import { validZone, dateInZone } from "@/lib/engagement";
import { getCourses } from "@/data";

async function user() { requireEngagement(); return (await getSessionUser()).id; }
const logSchema = z.object({ id: z.string().uuid(), date: z.string(), courseId: z.string().nullable(), minutes: z.number().int().min(1).max(240), reflection: z.string().max(500).default("") }).strict();
const patchLogSchema = logSchema.omit({ id: true });
const prefsSchema = z.object({ weeklyTarget: z.number().int().min(1).max(7).optional(), timezone: z.string().refine(validZone,"Choose a valid timezone.").optional(), showRewards: z.boolean().optional(), celebrations: z.boolean().optional(), cosmetic: z.enum(["default","orbit","constellation","nebula"]).optional() }).strict();
type ItemContext = { params: Promise<{ id: string }> };
export const getEngagement = handle(async (req: Request) => {
  const id = await user(); const zone = new URL(req.url).searchParams.get("timezone") ?? "UTC";
  if (!validZone(zone)) throw new ApiError(400,"invalid_timezone","Choose a valid timezone.");
  return ok(await readEngagement(id,zone));
});
export const preferences = handle(async (req: Request) => {
  const id = await user(); const p = await body(req,prefsSchema);
  await reconcileEngagement(id);
  return ok(await changeEngagement(id,(s) => {
    if (p.weeklyTarget !== undefined) setTarget(s,p.weeklyTarget);
    if (p.timezone !== undefined && p.timezone !== s.timezone) { s.timezone = p.timezone; s.timezoneHistory.push({ at: new Date().toISOString(),zone: p.timezone }); }
    if (p.showRewards !== undefined) s.showRewards = p.showRewards;
    if (p.celebrations !== undefined) s.celebrations = p.celebrations;
    if (p.cosmetic !== undefined) {
      if (p.cosmetic !== "default" && !s.unlocked.includes(p.cosmetic)) throw new ApiError(409,"reward_locked","Earn this dashboard frame before selecting it.");
      s.cosmetic = p.cosmetic;
    }
  }));
});
async function checkCourse(courseId: string | null) { if (courseId && !(await getCourses()).some((c) => c.course_id === courseId)) throw new ApiError(400,"invalid_course","Choose an available course or independent study."); }
export const createLog = handle(async (req: Request) => {
  const id = await user(); const log = await body(req,logSchema); await checkCourse(log.courseId);
  return ok(await changeEngagement(id,(s) => {
    if (s.deletedLogs.includes(log.id)) throw new ApiError(409,"deleted_log","This session was removed. Discard the old draft and create a new session.");
    const existing = s.logs.find((l) => l.id === log.id);
    if (existing) {
      if (existing.date !== log.date || existing.minutes !== log.minutes || existing.courseId !== log.courseId || existing.reflection !== log.reflection) throw new ApiError(409,"id_conflict","This session ID already exists. Refresh your activity before editing it.");
      return;
    }
    assertLogDate(s,log.date);
    s.logs.push({ ...log, timezone: s.timezone, createdAt: new Date().toISOString() });
  }),201);
});
export const patchLog = handle(async (req: Request, ctx: ItemContext) => {
  const id = await user(); const { id: logId } = await ctx.params; const log = await body(req,patchLogSchema); await checkCourse(log.courseId);
  return ok(await changeEngagement(id,(s) => {
    const index = s.logs.findIndex((l) => l.id === logId);
    if (index < 0) throw new ApiError(404,"not_found","Study session not found.");
    assertLogDate(s,log.date);
    s.logs[index] = { ...s.logs[index]!, ...log }; // retain the timezone captured when the log was created
  }));
});
export const deleteLog = handle(async (_req: Request, ctx: ItemContext) => {
  const id = await user(); const { id: logId } = await ctx.params;
  return ok(await changeEngagement(id,(s) => { s.logs = s.logs.filter((l) => l.id !== logId); s.deletedLogs = [...new Set([...s.deletedLogs,logId])]; }));
});
export const reconcile = handle(async () => ok(await reconcileEngagement(await user())));
export const grace = handle(async () => ok(await changeEngagement(await user(),applyGrace)));
export const notice = handle(async (req: Request, ctx: ItemContext) => {
  const id = await user(); const { id: noticeId } = await ctx.params;
  const patch = await body(req,z.object({ read: z.boolean().optional(), dismissed: z.boolean().optional() }).strict());
  return ok(await changeEngagement(id,(s) => {
    const existing = s.notifications[noticeId];
    if (!existing && !noticeId.startsWith("session:")) throw new ApiError(404,"not_found","Notification not found.");
    if (existing) Object.assign(existing,patch);
    else s.noticeStates[noticeId] = { ...(s.noticeStates[noticeId] ?? { read: false, dismissed: false }), ...patch };
  }));
});
async function saved(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const id = await user(); const { courseId } = await ctx.params; await checkCourse(courseId);
  return ok(await changeEngagement(id,(s) => { s.savedCourses = [...s.savedCourses.filter((c) => c !== courseId), ...(req.method === "PUT" ? [courseId] : [])]; }));
}
export const saveCourse = handle(saved);
/** Only enumerated platform interactions are accepted; never reflection content. */
export const metric = handle(async (req: Request) => {
  const id = await user();
  const event = await body(req,z.object({ id: z.string().uuid(),kind: z.enum(["visit","planner_action","reward_details","sync_recovered"]) }).strict());
  await changeEngagement(id,(s) => {
    const m = s.metrics ?? { ids: [],counts: {},visitDays: [] };
    if (!m.ids.includes(event.id)) {
      m.ids = [...m.ids,event.id].slice(-1000); m.counts[event.kind] = (m.counts[event.kind] ?? 0)+1;
      if (event.kind==="visit") { const day = dateInZone(new Date(),s.timezone); m.visitDays = [...new Set([...m.visitDays,day])]; }
    }
    s.metrics = m;
  });
  return ok({ recorded: true });
});
