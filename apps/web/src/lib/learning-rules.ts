import type { Support } from "./setup";

export type LearningAttempt = { id: string; moduleId: string; correct: boolean; helped: boolean; at: string };
export type ReviewTicket = { id: string; moduleId: string; due: string; interval: number; completedAt?: string };

/** Performance changes scaffolding only, never assessment difficulty or course completion. */
export function recommendedSupport(attempts: LearningAttempt[], moduleId: string, starting: Support): Support {
  const recent = attempts.filter((a) => a.moduleId === moduleId).slice(-4);
  if (recent.length < 2) return starting;
  if (recent.slice(-2).every((a) => !a.correct)) return "extra";
  if (recent.length >= 3 && recent.slice(-3).every((a) => a.correct && !a.helped)) return "light";
  return recent.some((a) => !a.correct || a.helped) ? "standard" : starting;
}

export function scheduleReviews(moduleId: string, at: string): ReviewTicket[] {
  return [3, 10, 30].map((interval) => {
    const date = new Date(at);
    date.setDate(date.getDate() + interval);
    return { id: `${moduleId}:${interval}`, moduleId, interval, due: date.toISOString() };
  });
}

export function nextReview(ticket: ReviewTicket, recalled: boolean, now: string): ReviewTicket {
  if (recalled) return { ...ticket, completedAt: now };
  const due = new Date(now);
  due.setDate(due.getDate() + 1);
  return { ...ticket, due: due.toISOString(), completedAt: undefined };
}
