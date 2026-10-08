"use client";

import * as React from "react";
import { useLocalJson, useLocalPrefix, writeLocal } from "@/lib/local-store";
import { adaptationOf, type PrecheckResult, type SetupAnswers, type SupportOverride } from "@/lib/setup";

/**
 * Enrolment and how this course is set up for the learner: the setup answers
 * (copied from the profile, then customised), the pre-check result and an
 * optional support override. Kept locally until POST /v1/enrollments and
 * PUT /v1/me/profile exist.
 */
export type Enrollment = {
  courseId: string;
  enrolledAt: string;
  answers: SetupAnswers;
  precheck?: PrecheckResult | null;
  supportOverride?: SupportOverride;
  version: 1 | 2;
};

const PREFIX = "lms-enrollment:";
const key = (courseId: string) => `${PREFIX}${courseId}`;

export function useEnrollment(courseId: string) {
  const enrollment = useLocalJson<Enrollment | null>(key(courseId), null);

  const save = React.useCallback(
    (answers: SetupAnswers, extra: Pick<Enrollment, "precheck" | "supportOverride"> = {}) => {
      const next: Enrollment = {
        courseId,
        enrolledAt: enrollment?.enrolledAt ?? new Date().toISOString(),
        answers,
        precheck: extra.precheck !== undefined ? extra.precheck : (enrollment?.precheck ?? null),
        supportOverride: extra.supportOverride ?? enrollment?.supportOverride ?? "auto",
        version: 2,
      };
      writeLocal(key(courseId), JSON.stringify(next));
    },
    [courseId, enrollment],
  );

  const unenroll = React.useCallback(() => writeLocal(key(courseId), null), [courseId]);

  const adaptation = React.useMemo(
    () => adaptationOf(enrollment?.answers, { precheck: enrollment?.precheck, override: enrollment?.supportOverride }),
    [enrollment],
  );

  return { enrollment, enrolled: !!enrollment, save, unenroll, adaptation };
}

/** Every course the learner is enrolled in, by id. */
export function useEnrollments(): Record<string, Enrollment> {
  const raw = useLocalPrefix<Enrollment>(PREFIX);
  return React.useMemo(() => {
    const out: Record<string, Enrollment> = {};
    for (const [k, v] of Object.entries(raw)) out[k.slice(PREFIX.length)] = v;
    return out;
  }, [raw]);
}
