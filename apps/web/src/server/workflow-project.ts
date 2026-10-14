import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { workflowProjects, enrollments } from "./db/schema";
import type { SessionUser } from "./auth";
import { ApiError } from "./http";
import { checkWorkflow, type Workflow, type WorkflowView } from "@/lib/workflow-project";

async function enrollment(user: SessionUser, courseId: string) {
  if (courseId !== "ai-agent") throw new ApiError(404,"no_workflow_project","This course has no workflow mini project.");
  const d = await db();
  const row = await d.query.enrollments.findFirst({ where: and(eq(enrollments.userId,user.id),eq(enrollments.courseId,courseId)) });
  if (!row) throw new ApiError(404,"not_enrolled","Enroll in the course to save a workflow project.");
  return row;
}
export async function workflowOf(user: SessionUser, courseId: string): Promise<WorkflowView> {
  const e = await enrollment(user,courseId); const d = await db();
  const row = await d.query.workflowProjects.findFirst({ where: eq(workflowProjects.enrollmentId,e.id) });
  return { diagram: row?.diagram ?? null, report: row?.report ?? null, revision: row?.revision ?? 0, updatedAt: row?.updatedAt.toISOString() ?? null };
}
export async function saveWorkflow(user: SessionUser, courseId: string, diagram: Workflow, revision: number, check = false): Promise<WorkflowView> {
  const e = await enrollment(user,courseId); const d = await db();
  return d.transaction(async (tx) => {
    await tx.select().from(enrollments).where(eq(enrollments.id,e.id)).for("update");
    const old = await tx.query.workflowProjects.findFirst({ where: eq(workflowProjects.enrollmentId,e.id) });
    if ((old?.revision ?? 0) !== revision) throw new ApiError(409,"workflow_conflict","Another tab saved a newer diagram. Your browser draft is retained; reload the server copy before saving again.");
    const updatedAt = new Date(); const report = check ? checkWorkflow(diagram,updatedAt.toISOString()) : null;
    const record = { enrollmentId: e.id, diagram, revision: revision + 1, report, updatedAt };
    await tx.insert(workflowProjects).values(record).onConflictDoUpdate({ target: workflowProjects.enrollmentId, set: record });
    return { diagram,report,revision: record.revision,updatedAt: updatedAt.toISOString() };
  });
}
