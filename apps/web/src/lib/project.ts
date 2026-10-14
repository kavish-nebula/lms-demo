"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { api, refreshEnrollments } from "@/lib/api";
import type { ProjectReport, ProjectTicket, RunRecord } from "@/lib/project-grade";

/**
 * The mini project on the server: the learner's saved files and the last
 * test report (enrolled learners only), saving as they type, and grading a
 * run of the hidden tickets.
 */

export type SavedReport = ProjectReport & { at: string };
export type ProjectView = { files: Record<string, string> | null; report: SavedReport | null; updatedAt: string | null };

export const projectKey = (courseId: string) => `/api/v1/enrollments/${courseId}/project`;

export function useProjectWork(courseId: string, enrolled: boolean) {
  const { data, error, isLoading } = useSWR<ProjectView>(enrolled ? projectKey(courseId) : null, (url: string) => api<ProjectView>(url));
  return { work: data ?? null, loading: enrolled && isLoading, error: error as Error | undefined };
}

export type SaveState = "saved" | "saving" | "unsaved" | "failed" | "local";

/** Saves the files a moment after the last keystroke, and right away when the page closes. */
export function useAutosave(courseId: string, enrolled: boolean, files: Record<string, string> | null) {
  const [state, setState] = React.useState<SaveState>("saved");
  const last = React.useRef<string | null>(null);
  const latest = React.useRef(files);
  React.useEffect(() => {
    latest.current = files;
  }, [files]);

  const save = React.useCallback(
    async (keepalive = false) => {
      const f = latest.current;
      if (!enrolled || !f) return;
      const json = JSON.stringify(f);
      if (json === last.current) return;
      setState("saving");
      try {
        await api(projectKey(courseId), { method: "PUT", body: { files: f }, keepalive });
        last.current = json;
        setState("saved");
      } catch {
        setState("failed");
      }
    },
    [courseId, enrolled],
  );

  // the first files seen are the saved ones
  React.useEffect(() => {
    if (files && last.current === null) last.current = JSON.stringify(files);
  }, [files]);

  React.useEffect(() => {
    if (!enrolled || !files || JSON.stringify(files) === last.current) return;
    setState("unsaved");
    const id = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(id);
  }, [files, enrolled, save]);

  React.useEffect(() => {
    const flush = () => void save(true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [save]);

  // not enrolled (or not known yet): nothing is saved on the server
  return enrolled ? state : "local";
}

export async function fetchHiddenTickets(courseId: string) {
  return api<{ runs: number; tickets: ProjectTicket[] }>(`${projectKey(courseId)}/tests`);
}

/** Sends a run of the hidden tickets for grading; the report is saved and goes to the learner's plan. */
export async function submitRun(courseId: string, files: Record<string, string>, records: RunRecord[]) {
  const res = await api<{ report: SavedReport; replanning: boolean }>(`${projectKey(courseId)}/check`, {
    method: "POST",
    body: { files, records: records.map(({ ticket, seed, step, decision, error, where }) => ({ ticket, seed, step, decision, error, where })) },
  });
  await mutate(projectKey(courseId), (v?: ProjectView) => ({ ...v, files, updatedAt: res.report.at, report: res.report }), { revalidate: false });
  void refreshEnrollments();
  return res;
}
