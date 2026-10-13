"use client";
import { useSignal } from "@/lib/signals";
import * as React from "react";
import { CalendarClock, Check, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureReviews, rateReview, useLearning } from "@/lib/learning-state";
import { useLearningContext } from "./course-companion";
import { useHydrated, useLocalJson } from "@/lib/local-store";

export function ReflectionReview() {
  const ctx = useLearningContext();
  const { state, update } = useLearning(ctx?.courseId ?? "");
  const prediction = useLocalJson<{ label: string } | null>(`lms-prediction:v1:${ctx?.courseId ?? ""}:${ctx?.moduleId ?? ""}`, null);
  const hydrated = useHydrated();
  React.useEffect(() => { if (ctx?.courseId && ctx.moduleId) ensureReviews(ctx.courseId, ctx.moduleId); }, [ctx?.courseId, ctx?.moduleId]);
  if (!ctx) return null;
  const tickets = state.reviews.filter((r) => r.moduleId === ctx.moduleId);
  return <div className="learning-reflection"><div className="flex items-center gap-2"><NotebookPen className="size-5 text-stage-reflection" /><h2 className="font-semibold">Pause. Notice what changed.</h2></div>{prediction?.label && <blockquote className="mt-4 rounded-xl border border-line bg-panel p-3 text-sm"><span className="mb-1 block text-xs text-ink-muted">Your prediction at the start</span>“{prediction.label}”</blockquote>}<label htmlFor="module-reflection" className="mt-3 block text-sm text-ink-muted">What can you explain or do now that you couldn’t at the start? Give one example.</label><textarea id="module-reflection" rows={3} maxLength={3000} value={state.reflections[ctx.moduleId] ?? ""} onChange={(e) => update((s) => ({ ...s, reflections: { ...s.reflections, [ctx.moduleId]: e.target.value } }))} placeholder="At first I thought… Now I would…" /><p className="mt-1 text-xs text-ink-muted">Saved in this browser. Reflection is for you; it isn’t graded.</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4" />Your return visits</div><div className="mt-3 grid gap-2 sm:grid-cols-3">{tickets.map((r) => <div key={r.id} className="rounded-xl border border-line bg-panel p-3 text-xs"><strong>{r.completedAt ? "✓ Recalled" : hydrated && new Date(r.due) <= new Date() ? "Ready to revisit" : `${r.interval}-day review`}</strong><p className="mt-1 text-ink-muted">{hydrated ? new Date(r.due).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Scheduled"}</p></div>)}</div></div>;
}

export function ReviewRecall({ interval, correct }: { interval: number; correct: boolean }) {
  const signal = useSignal();
  const ctx = useLearningContext();
  const { state } = useLearning(ctx?.courseId ?? "");
  const [rating, setRating] = React.useState<string | null>(null);
  if (!ctx) return null;
  function rate(got: boolean) {
    if (!ctx) return;
    ensureReviews(ctx.courseId, ctx.moduleId);
    rateReview(ctx.courseId, `${ctx.moduleId}:${interval}`, got && correct);
    signal({ kind: "recall_answer",moduleId: ctx.moduleId,payload: { variantId: `${ctx.moduleId}:${interval}`,rating: got && correct ? "got" : "not_yet" } });
    const future = state.reviews.find((r) => r.id === `${ctx.moduleId}:${interval}`)?.due;
    setRating(got && correct ? future && new Date(future) > new Date() ? "Good practice. Your future review stays scheduled." : "Saved. This review is complete." : "Saved. We’ll bring this back tomorrow.");
  }
  return <div className="flex flex-wrap items-center gap-2 text-xs"><span>How did recall feel?</span><Button size="sm" variant="outline" disabled={!correct} onClick={() => rate(true)}><Check />I recalled it</Button><Button size="sm" variant="outline" onClick={() => rate(false)}>Practise again tomorrow</Button>{rating && <span role="status" className="text-brand-ink">{rating}</span>}</div>;
}
