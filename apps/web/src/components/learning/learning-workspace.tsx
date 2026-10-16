"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useLearning } from "@/lib/learning-state";
import type { Support } from "@/lib/setup";
import type { StageId } from "@/lib/stages";

const PHASES = [{ id: "hook", label: "Problem & hook" }, { id: "explainer", label: "Concept" }, { id: "worked", label: "Worked example" }, { id: "guided", label: "Guided practice" }, { id: "lab", label: "Scenarios" }, { id: "gate", label: "Module quiz" }];

export function LearningWorkspace({ courseId, moduleId, stage, support, done, children }: { courseId: string; moduleId: string; stage: StageId; support: Support; done: StageId[]; children: React.ReactNode }) {
  const { state, update } = useLearning(courseId);
  const phases = stage === "review" ? [...PHASES, { id: "review", label: "Spaced review" }] : PHASES;
  const supportCopy = support === "extra" ? "Hints appear early" : support === "light" ? "Explore with fewer prompts" : "Hints after your first try";
  return <div className="learning-workspace">
    <div className="learning-toolbar">
      <nav className="journey-phase-strip" aria-label="Learning phases">{phases.map((p) => <Link key={p.id} href={`/learn/courses/${courseId}/${moduleId}/${p.id}`} aria-current={stage === p.id ? "step" : undefined}>{done.includes(p.id as StageId) && <Check className="size-3" />}{p.label}</Link>)}</nav>
      <div className="learning-focus-controls">
        <div className="adaptive-pulse" title={state.attempts.some((a) => a.moduleId === moduleId) ? "Adjusted from your recent practice" : "Based on your learner profile"}><Sparkles className="size-3.5" /><span><strong>Adaptive mode</strong><small>{supportCopy}</small></span></div>
        {stage !== "gate" && <label className="flex items-center gap-2 text-xs text-ink-muted"><span className="sr-only">Guidance</span><select aria-label="Guidance level" value={state.support[moduleId] ?? "auto"} onChange={(e) => update((s) => ({ ...s, support: { ...s.support, [moduleId]: e.target.value as Support | "auto" } }))}><option value="auto">Adapt to me</option><option value="extra">More guidance</option><option value="standard">Balanced</option><option value="light">Let me explore</option></select></label>}
      </div>
    </div>
    {children}
  </div>;
}
