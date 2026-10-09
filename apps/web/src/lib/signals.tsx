"use client";

import * as React from "react";
import { api, refreshEnrollments } from "@/lib/api";

/**
 * Learning signals: answers from inside lessons (in-video checks, recall
 * questions, the final check, capstone checks) sent to the server, which
 * may revise the learner's plan. Sent in small batches; each signal has its
 * own id, so a resend is harmless. Nothing is sent while only previewing.
 */

export type SignalKind = "video_check" | "recall_answer" | "final_check" | "capstone_check";
export type Signal = { kind: SignalKind; moduleId?: string | null; lesson?: string | null; payload: Record<string, unknown> };
type Queued = Signal & { id: string };

const queues = new Map<string, Queued[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function flush(courseId: string, keepalive = false) {
  const batch = queues.get(courseId) ?? [];
  queues.set(courseId, []);
  clearTimeout(timers.get(courseId));
  timers.delete(courseId);
  if (!batch.length) return;
  try {
    const res = await api<{ accepted: number; replanning: boolean }>(`/api/v1/enrollments/${courseId}/signals`, {
      method: "POST",
      keepalive,
      body: { signals: batch.map((s) => ({ id: s.id, kind: s.kind, moduleId: s.moduleId ?? null, lesson: s.lesson ?? null, payload: s.payload })) },
    });
    // a revision (or a rule change) may have happened: pick up the new plan
    if (res.replanning) await refreshEnrollments();
  } catch {
    // dropped: signals refine the plan; losing one never blocks the learner
  }
}

function enqueue(courseId: string, s: Signal) {
  const q = queues.get(courseId) ?? [];
  q.push({ ...s, id: crypto.randomUUID() });
  queues.set(courseId, q);
  if (q.length >= 20) return void flush(courseId);
  if (!timers.has(courseId)) timers.set(courseId, setTimeout(() => void flush(courseId), 1500));
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const id of queues.keys()) void flush(id, true);
  });
}

const SignalContext = React.createContext<{ courseId: string; enabled: boolean } | null>(null);

/** Wrap a lesson or the finale so the components inside can report answers. */
export function SignalProvider({ courseId, enabled, children }: { courseId: string; enabled: boolean; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ courseId, enabled }), [courseId, enabled]);
  return <SignalContext.Provider value={value}>{children}</SignalContext.Provider>;
}

/** Report an answer from inside a lesson. A no-op outside a provider or while previewing. */
export function useSignal() {
  const ctx = React.useContext(SignalContext);
  return React.useCallback(
    (s: Signal) => {
      if (ctx?.enabled) enqueue(ctx.courseId, s);
    },
    [ctx],
  );
}

/** Queue a signal outside a provider (the capstone sandbox, the finale). The caller checks enrolment. */
export const queueSignal = (courseId: string, s: Signal) => enqueue(courseId, s);

/** Send now (e.g. right before navigating away from the finale). */
export const flushSignals = (courseId: string) => flush(courseId);
