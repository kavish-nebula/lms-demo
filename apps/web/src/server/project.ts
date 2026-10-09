import "server-only";
import agentProject from "@lms/fixtures/project-ai-agent.json";
import agentTests from "@lms/fixtures/project-ai-agent-tests.json";
import { REQUIREMENT_LESSON, gradeProject, type ProjectReport, type ProjectTicket, type RunRecord, type TicketExpect } from "@/lib/project-grade";
import type { SessionUser } from "@/server/auth";
import { ApiError } from "@/server/http";
import * as repo from "@/server/repo";
import type { ProjectReportRow } from "@/server/db/schema";
import { recordSignals, type Schedule } from "@/server/planner/service";
import type { PlannerTransport } from "@/server/planner/llm";

/**
 * The mini project on the server: the learner's files, and the hidden
 * tickets. The browser runs the learner's code (Python, in a sandbox) on the
 * tickets and sends back what happened; the server grades it against
 * expectations the browser never sees, keeps the report, and sends the
 * result to the learner's plan as a capstone_check signal.
 */

type TestsFile = { course_id: string; runs: number; tickets: (ProjectTicket & { expect: TicketExpect })[] };
type ProjectFile = { course_id: string; files: { path: string; editable?: boolean }[] };

const TESTS: TestsFile[] = [agentTests as TestsFile];
const PROJECTS: ProjectFile[] = [agentProject as ProjectFile];

function testsFor(courseId: string) {
  const t = TESTS.find((x) => x.course_id === courseId);
  if (!t) throw new ApiError(404, "no_project", `"${courseId}" has no mini project.`);
  return t;
}

async function mustFind(user: SessionUser, courseId: string) {
  const e = await repo.findEnrollment(user.id, courseId);
  if (!e) throw new ApiError(404, "not_enrolled", `You are not enrolled in "${courseId}".`);
  return e;
}

/** Only the files the learner edits are stored. */
function editable(courseId: string, files: Record<string, string>) {
  const allowed = new Set(PROJECTS.find((p) => p.course_id === courseId)?.files.filter((f) => f.editable).map((f) => f.path) ?? []);
  const unknown = Object.keys(files).filter((p) => !allowed.has(p));
  if (unknown.length) throw new ApiError(400, "unknown_file", `These files can't be saved: ${unknown.join(", ")}.`);
  return files;
}

export async function projectOf(user: SessionUser, courseId: string) {
  testsFor(courseId);
  const row = await repo.projectFor((await mustFind(user, courseId)).id);
  return { files: row?.files ?? null, report: row?.report ?? null, updatedAt: row?.updatedAt.toISOString() ?? null };
}

export async function saveProject(user: SessionUser, courseId: string, files: Record<string, string>) {
  testsFor(courseId);
  const e = await mustFind(user, courseId);
  await repo.saveProjectFiles(e.id, editable(courseId, files));
  return { savedAt: new Date().toISOString() };
}

/** The hidden tickets, without what Scout should do with them. */
export async function projectTickets(user: SessionUser, courseId: string) {
  const t = testsFor(courseId);
  await mustFind(user, courseId);
  return { runs: t.runs, tickets: t.tickets.map(({ id, from, subject, body }) => ({ id, from, subject, body })) };
}

/** Grades a test run, keeps the report with the files it graded, and tells the plan. */
export async function checkProject(
  user: SessionUser,
  courseId: string,
  files: Record<string, string>,
  records: RunRecord[],
  schedule: Schedule,
  api?: PlannerTransport,
): Promise<{ report: ProjectReportRow; replanning: boolean }> {
  const t = testsFor(courseId);
  const e = await mustFind(user, courseId);
  const known = new Set(t.tickets.map((x) => x.id));
  const report: ProjectReport = gradeProject(Object.fromEntries(t.tickets.map((x) => [x.id, x.expect])), records.filter((r) => known.has(r.ticket)));
  const row: ProjectReportRow = { ...report, at: new Date().toISOString() };
  await repo.saveProjectReport(e.id, editable(courseId, files), row);
  const { replanning } = await recordSignals(
    user,
    courseId,
    [
      {
        key: `project-${row.at}`,
        kind: "capstone_check",
        moduleId: null,
        lesson: null,
        payload: {
          score: report.score,
          total: report.total,
          passed: report.passed,
          criticalFailed: report.criticalFailed,
          failing: report.weak,
          // a weak requirement adds help to the lesson it practises
          missedLessons: [...new Set(report.weak.map((r) => REQUIREMENT_LESSON[r]))],
        },
      },
    ],
    schedule,
    api,
  );
  return { report: row, replanning };
}
