"use client";

import * as React from "react";
import { useLearnerData } from "@/lib/api";
import { useLocalJson, useLocalPrefix, writeLocal } from "@/lib/local-store";
import { FINALE_PREFIX, type FinaleState } from "@/lib/finale";
import { courseUnits, DEFAULT_PLAN, type PlanState, type PlanUnit } from "@/lib/plan";
import type { Course } from "@/data/types";
import type { StageId } from "@/lib/stages";

const KEY = "lms-plan";
const PROGRESS = "lms-progress:";

/**
 * The learner's plan (sessions + preferences), kept locally until the plan
 * endpoint exists (GET/PUT /v1/enrollments/{id}/plan).
 */
export function usePlanState() {
  const stored = useLocalJson<Partial<PlanState>>(KEY, {});
  const plan: PlanState = React.useMemo(() => ({ ...DEFAULT_PLAN, ...stored }), [stored]);
  const setPlan = React.useCallback((next: PlanState) => writeLocal(KEY, JSON.stringify(next)), []);
  return { plan, setPlan };
}

/** Units for each course, with stages finished in the player marked done. */
export function useCourseUnits(courses: Course[]) {
  const { enrollments } = useLearnerData();
  const raw = useLocalPrefix<StageId[]>(PROGRESS);
  const finales = useLocalPrefix<FinaleState>(FINALE_PREFIX);
  return React.useMemo(() => {
    const preview: Record<string, StageId[]> = {};
    for (const [k, v] of Object.entries(raw)) preview[k.slice(PROGRESS.length)] = v;
    const byCourse = new Map<string, PlanUnit[]>();
    const all = new Map<string, PlanUnit>();
    for (const c of courses) {
      const e = enrollments[c.course_id];
      const stored = e ? (e.progress as Record<string, StageId[]>) : preview;
      const units = courseUnits(c, stored, finales[`${FINALE_PREFIX}${c.course_id}`]?.done ?? []);
      byCourse.set(c.course_id, units);
      for (const u of units) all.set(u.id, u);
    }
    return { byCourse, all };
  }, [courses, enrollments, raw, finales]);
}

/** UTC-noon Date for a day key, so formatting in any time zone shows that day. */
export const keyDate = (key: string) => new Date(`${key}T12:00:00Z`);
