"use client";

import * as React from "react";
import { useLocalJson, writeLocal } from "./local-store";
import type { Support } from "./setup";
import { nextReview, scheduleReviews, type LearningAttempt, type ReviewTicket } from "./learning-rules";

export type LearningState = {
  version: 2;
  support: Record<string, Support | "auto">;
  attempts: LearningAttempt[];
  reflections: Record<string, string>;
  notes: string;
  reviews: ReviewTicket[];
  /** Local calendar days with a meaningful learning action; bounded for streaks. */
  activityDays: string[];
  resume?: { href: string; title: string };
};
export const EMPTY_LEARNING: LearningState = { version: 2, support: {}, attempts: [], reflections: {}, notes: "", reviews: [], activityDays: [] };
const key = (courseId: string) => `lms-learning:v1:${courseId}`;

function dayStamp(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function withDay(state: LearningState, at = new Date()): LearningState {
  const day = dayStamp(at);
  return { ...state, activityDays: [...state.activityDays.filter((value) => value !== day), day].slice(-400) };
}

/** V1 is migrated in memory and written as V2 on the learner's next action. */
function normalizeLearning(value: Partial<LearningState> & { version?: number } | null): LearningState {
  if (!value || ![1, 2].includes(value.version ?? -1)) return EMPTY_LEARNING;
  const attempts = Array.isArray(value.attempts) ? value.attempts : [];
  const reviews = Array.isArray(value.reviews) ? value.reviews : [];
  const migratedDays = [
    ...attempts.map((attempt) => attempt.at?.slice(0, 10)),
    ...reviews.map((review) => review.completedAt?.slice(0, 10)),
  ].filter((day): day is string => !!day);
  return {
    ...EMPTY_LEARNING,
    ...value,
    version: 2,
    attempts,
    reviews,
    activityDays: Array.isArray(value.activityDays) ? value.activityDays : [...new Set(migratedDays)],
  };
}

/** Separate versioned, course-scoped store leaves all existing progress intact. */
export function readLearning(courseId: string): LearningState {
  try {
    const value = JSON.parse(localStorage.getItem(key(courseId)) ?? "null");
    return normalizeLearning(value);
  } catch { return EMPTY_LEARNING; }
}

export function updateLearning(courseId: string, update: (state: LearningState) => LearningState) {
  writeLocal(key(courseId), JSON.stringify(update(readLearning(courseId))));
}

export function recordLearning(courseId: string, attempt: Omit<LearningAttempt, "at">) {
  const now = new Date();
  updateLearning(courseId, (s) => withDay({ ...s, attempts: [...s.attempts.filter((a) => a.id !== attempt.id), { ...attempt, at: now.toISOString() }].slice(-200) }, now));
}

export function recordActivity(courseId: string, at = new Date()) {
  updateLearning(courseId, (state) => withDay(state, at));
}

export function ensureReviews(courseId: string, moduleId: string) {
  updateLearning(courseId, (s) => s.reviews.some((r) => r.moduleId === moduleId) ? s : { ...s, reviews: [...s.reviews, ...scheduleReviews(moduleId, new Date().toISOString())] });
}

export function rateReview(courseId: string, id: string, recalled: boolean) {
  const now = new Date().toISOString();
  // Practising ahead does not replace a future spaced recall opportunity.
  updateLearning(courseId, (s) => withDay({ ...s, reviews: s.reviews.map((r) => r.id === id && (!recalled || r.due <= now) ? nextReview(r, recalled, now) : r) }, new Date(now)));
}

export function useLearning(courseId: string) {
  const raw = useLocalJson<LearningState>(key(courseId), EMPTY_LEARNING);
  const state = React.useMemo(() => normalizeLearning(raw), [raw]);
  const update = React.useCallback((fn: (s: LearningState) => LearningState) => updateLearning(courseId, fn), [courseId]);
  return { state, update };
}
