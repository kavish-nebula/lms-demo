"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { PipelineDiagram } from "@/components/kit/pipeline";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StageShell } from "@/components/player/stage-shell";
import { McQuestion } from "@/components/player/items";
import { DEMO_OPEN } from "@/lib/demo";
import type { WorkedBlock, WorkedExample } from "@/data/types";
import type { StageProps } from "./types";

/**
 * Stage 3. Predict, then watch: the learner commits to what will happen, then
 * steps through the run caption by caption while the pipeline shows each
 * node's state (worked-example effect, temporal contiguity).
 */
export function WorkedStage({ block, ...nav }: StageProps<WorkedBlock>) {
  const t = useTranslations("player");
  const [index, setIndex] = React.useState(0);
  const [finished, setFinished] = React.useState<Record<string, boolean>>({});
  const ex = block.examples[index]!;
  const all = block.examples.every((e) => finished[e.step_id]);

  return (
    <StageShell
      stage="worked"
      title={t("workedTitle")}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={all || nav.done}
      completeHint={t("watchAllRuns")}
      completeLabel={t("workedCta")}
      {...nav}
    >
      <nav aria-label={t("examples")} className="flex flex-wrap gap-2">
        {block.examples.map((e, i) => (
          <button
            key={e.step_id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? "step" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-2 rounded-pill border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              i === index ? "border-transparent text-on-stage" : "border-line bg-panel text-ink-muted hover:border-stage-worked-line",
            )}
          >
            {i === index ? (
              <motion.span layoutId="worked-pill" className="absolute inset-0 -z-0 rounded-pill bg-stage-worked" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            ) : null}
            <span className="relative font-mono text-xs">{e.lesson}</span>
            <span className="relative">{finished[e.step_id] ? "✓" : null}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={ex.step_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <ExampleView
            example={ex}
            onFinished={() => setFinished((f) => ({ ...f, [ex.step_id]: true }))}
            onNext={index < block.examples.length - 1 ? () => setIndex(index + 1) : undefined}
          />
        </motion.div>
      </AnimatePresence>
    </StageShell>
  );
}

function ExampleView({
  example,
  onFinished,
  onNext,
}: {
  example: WorkedExample;
  onFinished: () => void;
  onNext?: () => void;
}) {
  const t = useTranslations("player");
  const reduce = useReducedMotionConfig() ?? false;
  const [predicted, setPredicted] = React.useState(!example.predict);
  // predicting first is asked for, not required: the demo lets the run start straight away
  const canRun = predicted || DEMO_OPEN;
  const [frame, setFrame] = React.useState(-1);
  const [playing, setPlaying] = React.useState(false);
  const frames = example.frames;
  const lastFrame = frames.length - 1;
  const current = frame >= 0 ? frames[frame]! : null;

  React.useEffect(() => {
    if (!playing || frame >= lastFrame) return;
    const id = setTimeout(() => {
      const next = frame + 1;
      setFrame(next);
      if (next >= lastFrame) {
        setPlaying(false);
        onFinished();
      }
    }, 2400);
    return () => clearTimeout(id);
  }, [playing, frame, lastFrame, onFinished]);

  const go = (f: number) => {
    const next = Math.max(0, Math.min(lastFrame, f));
    setFrame(next);
    if (next === lastFrame) {
      setPlaying(false);
      onFinished();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">{example.title}</h2>
        <p className="mt-1 text-ink-muted">{example.intro}</p>
      </div>

      {example.predict ? (
        <Surface pad="md" className="flex flex-col gap-3 border-stage-worked-line">
          <div className="text-sm font-semibold text-stage-worked">{t("predictFirst")}</div>
          <McQuestion
            id={example.predict.step_id}
            stem={example.predict.stem}
            options={example.predict.options}
            checkLabel={t("lockPrediction")}
            onAnswered={() => setPredicted(true)}
          />
        </Surface>
      ) : null}

      <Surface pad="md" className={cn("flex flex-col gap-4 transition-opacity", !canRun && "pointer-events-none opacity-50")} aria-disabled={!canRun}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">{t("watchRun")}</div>
          {frame >= 0 ? (
            <span className="font-mono text-xs text-ink-faint">{t("stepOf", { index: frame + 1, total: frames.length })}</span>
          ) : null}
        </div>

        <PipelineDiagram
          pipeline={current ?? { nodes: [], edges: [] }}
          label={example.title}
          className={cn(frame < 0 && "hidden")}
        />
        {frame < 0 ? (
          <div className="grid-texture flex h-32 items-center justify-center rounded-lg border border-dashed border-line">
            <Button
              variant="brand"
              disabled={!canRun}
              onClick={() => {
                go(0);
                setPlaying(!reduce);
              }}
            >
              <Play data-icon="inline-start" />
              {t("runIt")}
            </Button>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {current?.caption ? (
            <motion.p
              key={frame}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-live="polite"
              className="rounded-lg bg-panel-2 px-3 py-2.5 leading-relaxed"
            >
              {current.caption}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {frame >= 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => go(frame - 1)} disabled={frame === 0} aria-label={t("prevStep")}>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlaying((p) => !p)}
              disabled={frame >= lastFrame || reduce}
              aria-pressed={playing}
            >
              {playing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {playing ? t("pause") : t("play")}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => go(frame + 1)} disabled={frame >= lastFrame} aria-label={t("nextStep")}>
              <ChevronRight />
            </Button>
            <ol className="ml-2 flex items-center gap-1" aria-hidden>
              {frames.map((_, i) => (
                <li key={i} className={cn("h-1.5 rounded-pill transition-all", i === frame ? "w-5 bg-stage-worked" : i < frame ? "w-1.5 bg-stage-worked/60" : "w-1.5 bg-chart-track")} />
              ))}
            </ol>
            {frame >= lastFrame && onNext ? (
              <Button size="sm" className="ml-auto" onClick={onNext}>
                {t("nextExample")}
                <ChevronRight data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </Surface>

      <Narration text={example.narration} />
    </div>
  );
}

function Narration({ text }: { text: string }) {
  const t = useTranslations("player");
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-card border border-line bg-panel">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        {open ? t("hideTranscript") : t("showTranscript")}
        <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="prose-max px-4 pb-4 leading-relaxed text-ink-muted">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
