"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, FileCode2, ListChecks, Search, ShieldCheck } from "lucide-react";
import { cn } from "cn";
import { useCompanionStep } from "@/components/learning/course-companion";
import { Surface } from "@/components/kit/surface";
import { StageShell } from "@/components/player/stage-shell";
import { Button } from "@/components/ui/button";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import type { GuidedBlock, SolvedCaseStep } from "@/data/types";
import type { StageProps } from "./types";

type CaseSave = { started: boolean; read: number[] };
const EMPTY_CASE: CaseSave = { started: false, read: [] };

/**
 * A guided practice built around an existing, published solution. The learner
 * studies the original problem, walks through the implementation decisions in
 * order, and reviews the recorded result. There is no fictional mission,
 * branching scenario, or decorative reward layer competing with the content.
 */
export function SolvedCaseStage({ block, ...nav }: StageProps<GuidedBlock>) {
  const caseStudy = block.solved_case!;
  const key = `lms-solved-case:${block.step_id}`;
  const saved = useLocalJson<CaseSave>(key, EMPTY_CASE);
  const [view, setView] = React.useState<"overview" | "result" | number>("overview");
  const activeStep = typeof view === "number" ? caseStudy.solution_steps[view] : undefined;
  const allRead = caseStudy.solution_steps.every((_, index) => saved.read.includes(index));

  useCompanionStep({
    title: activeStep?.title ?? caseStudy.title,
    phase: "guided",
    guidance: activeStep ? `${activeStep.purpose} ${activeStep.explanation} ${activeStep.result}` : `${caseStudy.problem} ${caseStudy.solution}`,
  });

  const save = (next: CaseSave) => writeLocal(key, JSON.stringify(next));
  const openStep = (index: number) => {
    save({ ...saved, started: true });
    setView(index);
  };
  const finishStep = (index: number) => {
    const read = saved.read.includes(index) ? saved.read : [...saved.read, index];
    save({ started: true, read });
    setView(index + 1 < caseStudy.solution_steps.length ? index + 1 : "result");
  };
  const begin = () => {
    const firstUnread = caseStudy.solution_steps.findIndex((_, index) => !saved.read.includes(index));
    openStep(firstUnread < 0 ? 0 : firstUnread);
  };

  return (
    <StageShell
      stage="guided"
      title={block.title}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={allRead || nav.done}
      completeHint={`${caseStudy.solution_steps.filter((_, index) => !saved.read.includes(index)).length} solution steps left`}
      {...nav}
    >
      {view === "overview" ? (
        <CaseOverview block={block} onBegin={begin} />
      ) : view === "result" ? (
        <CaseResult block={block} onReview={() => openStep(0)} />
      ) : (
        <CaseStep
          step={caseStudy.solution_steps[view]!}
          index={view}
          total={caseStudy.solution_steps.length}
          read={new Set(saved.read)}
          allSteps={caseStudy.solution_steps}
          onSelect={openStep}
          onBack={() => setView(view === 0 ? "overview" : view - 1)}
          onNext={() => finishStep(view)}
        />
      )}
    </StageShell>
  );
}

function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-brand-ink underline-offset-4 hover:underline">
      {label}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function CaseOverview({ block, onBegin }: { block: GuidedBlock; onBegin: () => void }) {
  const cs = block.solved_case!;
  return (
    <div className="flex flex-col gap-5">
      <Surface pad="lg" className="border-stage-guided-line">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] text-stage-guided uppercase">
          <BookOpen className="size-4" aria-hidden />
          {cs.label}
          <span className="rounded-full border border-line px-2 py-1 font-medium normal-case tracking-normal text-ink-muted">Source-backed</span>
        </div>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight md:text-3xl">{cs.title}</h2>
        <p className="mt-3 max-w-4xl leading-relaxed text-ink-muted">{cs.source_note}</p>
        <div className="mt-4 text-sm"><SourceLink label={cs.source_label} url={cs.source_url} /></div>
      </Surface>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface pad="md" className="border-danger-line bg-danger-soft/30">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-danger uppercase"><Search className="size-4" aria-hidden />The documented problem</div>
          <p className="mt-3 text-lg leading-relaxed">{cs.problem}</p>
        </Surface>
        <Surface pad="md" className="border-ok-line bg-ok-soft/30">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ok uppercase"><ShieldCheck className="size-4" aria-hidden />The published solution</div>
          <p className="mt-3 text-lg leading-relaxed">{cs.solution}</p>
        </Surface>
      </div>

      <Surface pad="md" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><ListChecks className="size-4 text-stage-guided" aria-hidden />How this walkthrough works</h3>
            <p className="mt-1 text-sm text-ink-muted">Study the finished implementation in order: decision, code pattern, and verified result.</p>
          </div>
          <span className="text-sm text-ink-muted">{cs.solution_steps.length} solution decisions</span>
        </div>
        <ol className="grid gap-2 md:grid-cols-5">
          {cs.solution_steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-line bg-panel-2/40 p-3">
              <span className="font-mono text-xs text-stage-guided">{String(index + 1).padStart(2, "0")}</span>
              <div className="mt-2 text-sm font-semibold leading-snug">{step.title}</div>
            </li>
          ))}
        </ol>
        <Button size="lg" variant="brand" className="self-start" onClick={onBegin}>
          Open the solved implementation
          <ArrowRight data-icon="inline-end" />
        </Button>
      </Surface>
    </div>
  );
}

function CaseStep({
  step,
  index,
  total,
  read,
  allSteps,
  onSelect,
  onBack,
  onNext,
}: {
  step: SolvedCaseStep;
  index: number;
  total: number;
  read: Set<number>;
  allSteps: SolvedCaseStep[];
  onSelect: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Surface pad="sm" className="h-fit">
        <div className="px-2 pb-2 text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">Solution contents</div>
        <ol className="flex flex-col gap-1">
          {allSteps.map((item, itemIndex) => (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => onSelect(itemIndex)}
                aria-current={itemIndex === index ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                  itemIndex === index ? "bg-stage-guided-soft font-semibold text-stage-guided" : "text-ink-muted hover:bg-panel-2",
                )}
              >
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]", read.has(itemIndex) ? "border-ok bg-ok text-on-ok" : "border-line")}>{read.has(itemIndex) ? <Check className="size-3" aria-hidden /> : itemIndex + 1}</span>
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4">
        <Surface pad="lg" className="border-stage-guided-line">
          <div className="text-xs font-semibold tracking-[0.14em] text-stage-guided uppercase">Solution step {index + 1} of {total}</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{step.title}</h2>
          <div className="mt-4 rounded-xl border border-stage-guided-line bg-stage-guided-soft/40 p-4">
            <div className="text-xs font-semibold text-stage-guided uppercase">Why this decision exists</div>
            <p className="mt-2 leading-relaxed">{step.purpose}</p>
          </div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold">How the published solution handles it</h3>
            <p className="mt-2 leading-7 text-ink-muted">{step.explanation}</p>
          </div>
        </Surface>

        {step.code ? (
          <Surface pad="none" className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-3 text-sm font-semibold"><FileCode2 className="size-4 text-stage-guided" aria-hidden />Implementation pattern</div>
            <pre className="overflow-x-auto p-5 text-sm leading-7"><code>{step.code}</code></pre>
          </Surface>
        ) : null}

        <Surface pad="md" className="border-ok-line bg-ok-soft/30">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            <div><h3 className="font-semibold">What this step accomplishes</h3><p className="mt-1 leading-relaxed text-ink-muted">{step.result}</p></div>
          </div>
        </Surface>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft data-icon="inline-start" />Back</Button>
          <Button size="lg" variant="brand" onClick={onNext}>{index + 1 === total ? "Review the verified result" : "I understand—next decision"}<ArrowRight data-icon="inline-end" /></Button>
        </div>
      </div>
    </div>
  );
}

function CaseResult({ block, onReview }: { block: GuidedBlock; onReview: () => void }) {
  const cs = block.solved_case!;
  return (
    <div className="flex flex-col gap-4">
      <Surface pad="lg" className="border-ok-line bg-ok-soft/20">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ok uppercase"><Check className="size-4" aria-hidden />Verified result from the published notebook</div>
        <h2 className="mt-3 text-2xl font-semibold">The support agent completes all three jobs</h2>
        <p className="mt-3 max-w-4xl text-lg leading-relaxed text-ink-muted">{cs.result}</p>
      </Surface>
      <div className="grid gap-3 md:grid-cols-3">
        {cs.evidence.map((item, index) => (
          <Surface key={item} pad="md">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ok-soft font-mono text-xs font-bold text-ok">{index + 1}</span>
            <p className="mt-3 leading-relaxed">{item}</p>
          </Surface>
        ))}
      </div>
      <Surface pad="md" className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm"><span className="mr-2 text-ink-muted">Inspect the complete implementation:</span><SourceLink label={cs.source_label} url={cs.source_url} /></div>
        <Button variant="outline" onClick={onReview}>Review from step 1</Button>
      </Surface>
    </div>
  );
}
