"use client";

import * as React from "react";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import type { FinaleStepId } from "@/data/types";

/**
 * The course finale (capstone, final check, wrap-up), kept locally per course
 * until the enrolment events API exists.
 */
export type FinaleState = {
  done: FinaleStepId[];
  /** best final-check attempt */
  score?: number;
  total?: number;
  passed?: boolean;
  capstoneAt?: string;
  completedAt?: string;
};

export const FINALE_PREFIX = "lms-finale:";
export const finaleKey = (courseId: string) => `${FINALE_PREFIX}${courseId}`;
export const EMPTY_FINALE: FinaleState = { done: [] };

export function useFinale(courseId: string) {
  const state = useLocalJson<FinaleState>(finaleKey(courseId), EMPTY_FINALE);

  const update = React.useCallback(
    (patch: Partial<FinaleState>) => writeLocal(finaleKey(courseId), JSON.stringify({ ...state, ...patch })),
    [courseId, state],
  );

  const markDone = React.useCallback(
    (step: FinaleStepId, patch: Partial<FinaleState> = {}) =>
      update({ ...patch, done: state.done.includes(step) ? state.done : [...state.done, step] }),
    [state.done, update],
  );

  /** Keep the best attempt; a pass is never undone by a later retake. */
  const recordFinal = React.useCallback(
    (score: number, total: number, passed: boolean) => {
      const better = state.score == null || score / total > state.score / (state.total || 1);
      update({
        ...(better ? { score, total } : {}),
        passed: state.passed || passed,
        done: passed && !state.done.includes("final-check") ? [...state.done, "final-check"] : state.done,
      });
    },
    [state, update],
  );

  return { state, markDone, recordFinal };
}
