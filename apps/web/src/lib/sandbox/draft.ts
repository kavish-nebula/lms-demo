"use client";

import { useLocalJson, writeLocal } from "@/lib/local-store";
import type { CapstoneReport } from "@/data/mock-capstone-grader";
import type { Workflow } from "./types";

/**
 * The learner's capstone workflow and its latest check, saved in the browser
 * per course until the API exists. The project takes about an hour, so every
 * change is kept. Writers read the stored draft when they run, so autosave
 * never depends on a stale copy.
 */
export type CapstoneDraft = {
  workflow: Workflow;
  startedAt: string;
  savedAt: string;
  report?: CapstoneReport;
  /** checks run so far */
  checks: number;
};

export const DRAFT_PREFIX = "lms-capstone:";
export const draftKey = (courseId: string) => `${DRAFT_PREFIX}${courseId}`;

export const blankWorkflow = (): Workflow => ({ name: "My workflow", nodes: [], edges: [] });

export function readDraft(courseId: string): CapstoneDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(courseId));
    return raw ? (JSON.parse(raw) as CapstoneDraft) : null;
  } catch {
    return null;
  }
}

function write(courseId: string, patch: Partial<CapstoneDraft> & { workflow: Workflow }) {
  const prev = readDraft(courseId);
  const now = new Date().toISOString();
  const next: CapstoneDraft = { checks: 0, ...prev, ...patch, startedAt: prev?.startedAt ?? now, savedAt: now };
  writeLocal(draftKey(courseId), JSON.stringify(next));
}

export const persistWorkflow = (courseId: string, workflow: Workflow) => write(courseId, { workflow });

export function persistReport(courseId: string, workflow: Workflow, report: CapstoneReport) {
  write(courseId, { workflow, report, checks: (readDraft(courseId)?.checks ?? 0) + 1 });
}

export const resetDraft = (courseId: string) => writeLocal(draftKey(courseId), null);

export const useCapstoneDraft = (courseId: string) => useLocalJson<CapstoneDraft | null>(draftKey(courseId), null);
