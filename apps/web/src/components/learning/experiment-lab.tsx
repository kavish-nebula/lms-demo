"use client";
import * as React from "react";
import { ArrowRight, FlaskConical, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXPERIMENTS } from "@/data/experiments";
import { recordLearning, useLearning } from "@/lib/learning-state";
import { useCompanionStep } from "./course-companion";

export function ExperimentLab({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const ex = EXPERIMENTS[moduleId];
  const [choice, setChoice] = React.useState(0);
  const [edge, setEdge] = React.useState(false);
  const [result, setResult] = React.useState<{ choice: number; edge: boolean } | null>(null);
  const [prediction, setPrediction] = React.useState("");
  const { state, update } = useLearning(courseId);
  useCompanionStep({ title: ex?.title ?? "Experiment", guidance: ex?.brief ?? "", hint: "Change one setting, predict its effect, then run both the normal case and the unexpected case. Compare the evidence in each response." });
  if (!ex) return null;
  const noteKey = `experiment:${moduleId}`;
  const stale = result && (result.choice !== choice || result.edge !== edge);
  return <section className="experiment" aria-label="Interactive experiment">
    <header className="experiment-head"><div><div className="journey-kicker"><FlaskConical className="size-4" />Your turn to explore</div><h2 className="mt-2 text-xl font-semibold">{ex.title}</h2><p className="mt-2 text-sm text-ink-muted">{ex.brief}</p></div><span className="rounded-full border border-line px-2 py-1 text-[10px] whitespace-nowrap text-ink-muted">Safe simulation</span></header>
    <div className="experiment-grid">
      <div className="experiment-controls">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">The incoming request</p><p className="my-3 text-sm leading-relaxed">“{ex.customer}”</p>
        <fieldset><legend className="text-sm font-semibold">{ex.control}</legend>{ex.choices.map((label, i) => <label key={label} className="experiment-choice"><input type="radio" name={`experiment-${moduleId}`} checked={choice === i} onChange={() => setChoice(i)} className="accent-[var(--accent-deep)]" />{label}</label>)}</fieldset>
        <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={edge} onChange={(e) => setEdge(e.target.checked)} className="mt-0.5" /><span><strong className="block">Add a twist</strong>{ex.twist}</span></label>
        <label htmlFor={`prediction-${moduleId}`} className="mt-5 block text-xs font-medium">Before you run: {ex.prediction}</label>
        <textarea id={`prediction-${moduleId}`} value={prediction} onChange={(e) => setPrediction(e.target.value)} placeholder="I think Scout will… (optional)" rows={2} maxLength={500} className="pip-notes mt-2" />
        <Button className="mt-4 w-full" variant="brand" onClick={() => { setResult({ choice, edge }); recordLearning(courseId, { id: `experiment:${moduleId}:${edge ? "edge" : "normal"}`, moduleId, correct: choice === 2, helped: false }); }}><Play className="size-4" />{result ? "Run again" : "Run experiment"}</Button>
      </div>
      <div className="experiment-result" aria-live="polite">
        <div className="experiment-trace">{ex.trace.map((label, i) => <React.Fragment key={label}>{i > 0 && <ArrowRight className="size-3 text-ink-muted" />}<span>{label}</span></React.Fragment>)}</div>
        {result ? <>
          <div className="flex items-center justify-between text-xs text-ink-muted"><span>Scout’s response · {result.edge ? "unexpected case" : "normal case"}</span><RotateCcw className="size-3.5" /></div>
          <blockquote>{(result.edge ? ex.edge : ex.outcomes)[result.choice]}</blockquote>
          {stale && <p className="text-xs text-warn">Settings changed. Run again to update this result.</p>}
          <div className="rounded-xl border border-brand-line bg-brand-soft p-4"><strong className="text-sm">What changed, and why</strong><p className="mt-2 text-sm leading-relaxed text-ink-muted">{ex.explanations[result.choice]}</p></div>
          {prediction && <p className="text-xs text-ink-muted"><strong>Your prediction:</strong> {prediction}</p>}
          <label htmlFor={`transfer-${moduleId}`} className="text-sm font-medium">Take it one step further: {ex.transfer}</label>
          <textarea id={`transfer-${moduleId}`} value={state.reflections[noteKey] ?? ""} onChange={(e) => update((s) => ({ ...s, reflections: { ...s.reflections, [noteKey]: e.target.value.slice(0, 2000) } }))} rows={3} maxLength={2000} className="pip-notes" placeholder="Write your reasoning…" /><span className="text-xs text-ink-muted">Saved to this course in your browser.</span>
        </> : <div className="flex flex-1 flex-col items-center justify-center py-10 text-center"><FlaskConical className="size-10 text-brand-ink" /><h3 className="mt-4 font-semibold">Small changes. Visible consequences.</h3><p className="mt-2 max-w-xs text-sm text-ink-muted">Choose a behaviour and run it. Then change one thing and compare what Scout does.</p></div>}
      </div>
    </div>
  </section>;
}
