"use client";

import * as React from "react";
import { api, refreshEnrollments, storeEnrollment, useLearnerData } from "@/lib/api";
import { adaptationFromPlan, type PrecheckResult, type SetupAnswers, type SupportOverride } from "@/lib/setup";
import type { EnrollmentView } from "@/lib/learner-plan";

/**
 * Enrolment and how this course is set up for the learner: the setup answers
 * (copied from the profile, then customised), the quick check, an optional
 * help override and their study pace. Stored on the server, which keeps the
 * learner's plan (the AI planner's, or the rule-based baseline) alongside.
 */
export type Enrollment = EnrollmentView;

export type SaveExtra = {
  precheck?: PrecheckResult | null;
  supportOverride?: SupportOverride;
  pace?: { sessionMinutes: number; studyDays: number[] } | null;
};

/**
 * Enrol, or update the setup of an existing enrollment. The quick check is
 * sent only when it changed (a first take or a retake), with its raw
 * answers, so the server scores it and the planner sees what was missed.
 */
export async function saveEnrollment(courseId: string, current: Enrollment | null, answers: SetupAnswers, extra: SaveExtra = {}): Promise<Enrollment> {
  const p = extra.precheck;
  const precheckChanged = p !== undefined && (p === null ? current?.precheck != null : p.at !== current?.precheck?.at);
  const body = {
    answers,
    supportOverride: extra.supportOverride ?? current?.supportOverride ?? "auto",
    pace: extra.pace !== undefined ? extra.pace : (current?.pace ?? null),
    ...(precheckChanged ? { precheck: p ? { skipped: p.skipped, isNew: p.isNew, responses: p.responses } : null } : {}),
  };
  const res = current
    ? await api<{ enrollment: Enrollment }>(`/api/v1/enrollments/${courseId}`, { method: "PATCH", body })
    : await api<{ enrollment: Enrollment }>("/api/v1/enrollments", { method: "POST", body: { courseId, ...body } });
  await storeEnrollment(res.enrollment);
  if (!current) await moveLocalProgress(courseId);
  return res.enrollment;
}

/** Topics finished while previewing (before enrolling) move to the new enrollment. */
async function moveLocalProgress(courseId: string) {
  const local: [string, string[]][] = [];
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("lms-progress:")) local.push([k, JSON.parse(localStorage.getItem(k) ?? "[]") as string[]]);
  } catch {
    return;
  }
  if (!local.length) return;
  let last: Enrollment | null = null;
  for (const [k, stages] of local) {
    const moduleId = k.slice("lms-progress:".length);
    for (const stage of stages) {
      last = await api<{ enrollment: Enrollment }>(`/api/v1/enrollments/${courseId}/progress`, { method: "POST", body: { moduleId, stage } })
        .then((r) => r.enrollment)
        .catch(() => last);
    }
    try {
      localStorage.removeItem(k);
    } catch {}
  }
  if (last) await storeEnrollment(last);
}

export function useEnrollment(courseId: string) {
  const { enrollments, ready } = useLearnerData();
  const enrollment = enrollments[courseId] ?? null;

  const save = React.useCallback((answers: SetupAnswers, extra: SaveExtra = {}) => saveEnrollment(courseId, enrollment, answers, extra), [courseId, enrollment]);

  const unenroll = React.useCallback(async () => {
    await api(`/api/v1/enrollments/${courseId}`, { method: "DELETE" });
    await refreshEnrollments();
  }, [courseId]);

  const adaptation = React.useMemo(
    () => adaptationFromPlan(enrollment?.answers, { precheck: enrollment?.precheck, override: enrollment?.supportOverride }, enrollment?.plan?.plan, enrollment?.plan?.source),
    [enrollment],
  );

  return { enrollment, enrolled: !!enrollment, ready, save, unenroll, adaptation };
}

/** Every course the learner is enrolled in, by id. */
export function useEnrollments(): Record<string, Enrollment> {
  return useLearnerData().enrollments;
}
