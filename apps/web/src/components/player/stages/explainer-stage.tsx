"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Globe2, Lightbulb, ListChecks } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { Surface } from "@/components/kit/surface";
import { PipelineDiagram, nodeKind } from "@/components/kit/pipeline";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { McQuestion } from "@/components/player/items";
import { WORLD } from "@/lib/world";
import { analogyOpenFor, type Adaptation } from "@/lib/setup";
import { VideoExplainer } from "@/components/player/video/video-explainer";
import type { Beat, ExplainerBlock, Segment } from "@/data/types";
import type { StageProps } from "./types";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Stage 2. One lesson at a time (segmenting), each made of short narrated
 * beats with a quick check after each (retrieval every few minutes). The
 * learner's setup decides whether checks come first ("try it first"), whether
 * the analogy is open, and which field the "In your world" card speaks to.
 */
function BeatsExplainer({ block, adaptation, ...nav }: StageProps<ExplainerBlock> & { adaptation: Adaptation }) {
  const t = useTranslations("player");
  const [index, setIndex] = React.useState(0);
  const [seen, setSeen] = React.useState(1);
  const [answered, setAnswered] = React.useState<Record<string, boolean>>({});

  const seg = block.segments[index]!;
  const checks = seg.beats.filter((b) => b.check).map((b) => b.check!.step_id);
  const segDone = checks.every((id) => answered[id] != null);
  const last = index === block.segments.length - 1;
  const allSeen = seen >= block.segments.length && segDone;

  return (
    <StageShell
      stage="explainer"
      title={t("explainerTitle")}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={allSeen || nav.done}
      completeHint={t("finishSegments")}
      {...nav}
    >
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-ink-muted">{t("keyTerms")}</div>
        <ul className="flex flex-wrap gap-2">
          {block.concepts.map((c) => (
            <li key={c}>
              <Chip tone="explainer" className="font-mono">
                {c}
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      <SegmentTrack segments={block.segments} index={index} seen={seen} onSelect={setIndex} />

      <AnimatePresence mode="wait">
        <motion.section
          key={seg.step_id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          aria-labelledby={`${seg.step_id}-title`}
          className="flex flex-col gap-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`${seg.step_id}-title`} className="text-xl font-semibold">
              <span className="mr-2 font-mono text-sm text-ink-faint">{seg.lesson}</span>
              {seg.title}
            </h2>
            <span className="shrink-0 font-mono text-sm text-ink-faint">{formatDuration(seg.duration_sec)}</span>
          </div>

          {seg.pipeline ? (
            <Surface pad="md">
              <PipelineDiagram pipeline={seg.pipeline} label={seg.title} />
            </Surface>
          ) : null}

          {seg.beats.map((beat, bi) => (
            <BeatView
              key={beat.id}
              beat={beat}
              index={bi}
              nodes={seg.pipeline?.nodes ?? []}
              checkFirst={adaptation.order[0] === "try"}
              onAnswered={(id, ok) => setAnswered((a) => ({ ...a, [id]: ok }))}
            />
          ))}

          {adaptation.domain && WORLD[seg.lesson] ? (
            <Callout tone="worked" label={t("inYourWorld", { field: adaptation.domain.label })} icon={<Globe2 />}>
              <p className="leading-relaxed">{WORLD[seg.lesson]!(adaptation.domain)}</p>
            </Callout>
          ) : null}

          {seg.alt ? <AltTake key={`${seg.step_id}-alt`} alt={seg.alt} defaultOpen={analogyOpenFor(adaptation, seg.lesson)} /> : null}

          <Surface pad="md" className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="size-4 text-stage-explainer" aria-hidden />
              {t("keyIdeas")}
            </div>
            <ul className="flex flex-col gap-1.5">
              {seg.notes.map((n) => (
                <li key={n} className="flex gap-2.5">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-stage-explainer" />
                  {n}
                </li>
              ))}
            </ul>
          </Surface>
        </motion.section>
      </AnimatePresence>

      {!last ? (
        <Button
          variant="outline"
          className="w-fit"
          disabled={!segDone}
          onClick={() => {
            setIndex(index + 1);
            setSeen((s) => Math.max(s, index + 2));
          }}
        >
          {t("nextSegment")}
        </Button>
      ) : null}
    </StageShell>
  );
}

function BeatView({
  beat,
  index,
  nodes,
  checkFirst,
  onAnswered,
}: {
  beat: Beat;
  index: number;
  nodes: { id: string; label: string; kind: string }[];
  checkFirst: boolean;
  onAnswered: (id: string, ok: boolean) => void;
}) {
  const t = useTranslations("player");
  const why = Object.entries(beat.why);
  const check = beat.check ? (
    <Surface pad="md" className="flex flex-col gap-3 border-stage-explainer-line">
      <div className="flex items-center gap-2">
        <Chip size="sm" tone="explainer">
          {checkFirst ? t("tryItFirst") : t("conceptCheck")}
        </Chip>
        <span className="text-xs text-ink-faint">{t("notGraded")}</span>
      </div>
      <McQuestion
        id={beat.check.step_id}
        stem={beat.check.stem}
        options={beat.check.options}
        onAnswered={(ok) => onAnswered(beat.check!.step_id, ok)}
      />
    </Surface>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {checkFirst ? check : null}
      <div className="flex gap-4">
        <span className="mt-1 font-mono text-xs text-ink-faint tabular-nums">{String(index + 1).padStart(2, "0")}</span>
        <p className="prose-max text-lg leading-relaxed">{beat.narration}</p>
      </div>
      {why.length ? (
        <dl className="ml-8 flex flex-col gap-2">
          {why.map(([id, text]) => {
            const n = nodes.find((x) => x.id === id);
            const k = nodeKind(n?.kind ?? "");
            const Icon = k.icon;
            return (
              <div key={id} className="flex gap-3 rounded-lg border border-line bg-panel-2/50 p-3 text-sm">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md border", k.tone)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div>
                  <dt className="font-semibold">{n?.label ?? id}</dt>
                  <dd className="text-ink-muted">{text}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      ) : null}
      {!checkFirst ? check : null}
    </div>
  );
}

function AltTake({ alt, defaultOpen }: { alt: NonNullable<Segment["alt"]>; defaultOpen: boolean }) {
  const t = useTranslations("player");
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-card border border-stage-review-line bg-stage-review-soft">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        <span className="inline-flex items-center gap-2 text-stage-review">
          <Lightbulb className="size-4" aria-hidden />
          {t("anotherWay")}: {alt.title}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 px-4 pb-4">
        <p className="leading-relaxed">{alt.text}</p>
        <p className="text-sm text-ink-muted italic">{alt.prompt}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Lesson markers; lessons unlock in order. */
function SegmentTrack({
  segments,
  index,
  seen,
  onSelect,
}: {
  segments: Segment[];
  index: number;
  seen: number;
  onSelect: (i: number) => void;
}) {
  const t = useTranslations("player");
  const total = segments.reduce((s, x) => s + x.duration_sec, 0);
  return (
    <nav aria-label={t("segments")} className="flex gap-1.5">
      {segments.map((s, i) => {
        const reachable = i < seen;
        return (
          <button
            key={s.step_id}
            type="button"
            disabled={!reachable}
            onClick={() => onSelect(i)}
            aria-current={i === index ? "step" : undefined}
            style={{ flexGrow: s.duration_sec / total }}
            className={cn(
              "group flex min-w-0 basis-0 flex-col gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              !reachable && "cursor-not-allowed",
            )}
          >
            <span className="relative h-1.5 w-full overflow-hidden rounded-pill bg-chart-track">
              {i <= index ? (
                <motion.span
                  layoutId={i === index ? "seg-fill" : undefined}
                  className="absolute inset-0 rounded-pill bg-stage-explainer"
                />
              ) : null}
            </span>
            <span
              className={cn(
                "truncate text-xs",
                i === index ? "font-medium text-ink" : reachable ? "text-ink-muted" : "text-ink-faint",
              )}
            >
              {s.lesson} · {s.title}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The concept topic: taught by narrated slide videos when the module has
 * them (every module does now), one video per part of the module; otherwise
 * by the narrated beats.
 */
export function ExplainerStage({
  videoId,
  nextTitle,
  ...props
}: StageProps<ExplainerBlock> & { adaptation: Adaptation; videoId?: string; nextTitle?: string }) {
  return props.block.videos?.length ? <VideoExplainer {...props} videoId={videoId} nextTitle={nextTitle} /> : <BeatsExplainer {...props} />;
}
