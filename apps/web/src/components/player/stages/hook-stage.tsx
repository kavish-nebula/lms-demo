"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { Play, RotateCcw, Target, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/kit/chip";
import { Surface } from "@/components/kit/surface";
import { PipelineDiagram } from "@/components/kit/pipeline";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { ChoiceList, Feedback } from "@/components/player/items";
import { ROLE_HOOK } from "@/lib/world";
import { planModule } from "@/lib/learner-plan";
import type { Adaptation } from "@/lib/setup";
import type { HookBlock, Objective } from "@/data/types";
import type { StageProps } from "./types";

/**
 * Stage 1. A real failure before any theory (ch13 T1 hook): the incident,
 * the team's messages, a committed guess, then the run replayed node by node.
 */
export function HookStage({
  block,
  objectives,
  moduleIndex,
  adaptation,
  ...nav
}: StageProps<HookBlock> & { objectives: Objective[]; moduleIndex: number; adaptation: Adaptation }) {
  const t = useTranslations("player");
  const reduce = useReducedMotionConfig() ?? false;
  const [guess, setGuess] = React.useState<string[]>([]);
  const [frame, setFrame] = React.useState(-1); // -1 = not started
  const [finished, setFinished] = React.useState(nav.done);
  const timeline = block.reveal.timeline;
  const playing = frame >= 0 && !finished;
  const planScene = planModule(adaptation.plan, block.step_id.split(".")[0] ?? "")?.hookScene;
  const roleText = planScene || (adaptation.roleKey ? ROLE_HOOK[moduleIndex]?.[adaptation.roleKey as keyof (typeof ROLE_HOOK)[1]] : undefined);

  // play the run on its own clock; reduced motion jumps straight to the end
  function start() {
    if (reduce) {
      setFrame(timeline.length - 1);
      setFinished(true);
    } else {
      setFinished(false);
      setFrame(0);
    }
  }

  React.useEffect(() => {
    if (frame < 0 || finished) return;
    if (frame >= timeline.length - 1) {
      const done = setTimeout(() => setFinished(true), 700);
      return () => clearTimeout(done);
    }
    const gap = Math.max(250, (timeline[frame + 1]!.t - timeline[frame]!.t) * 0.9);
    const id = setTimeout(() => setFrame((f) => f + 1), gap);
    return () => clearTimeout(id);
  }, [frame, finished, timeline]);

  const current = frame >= 0 ? timeline[frame]! : null;
  const pipeline = current ?? block.pipeline;
  const correct = guess[0] === block.correct;

  return (
    <StageShell
      stage="hook"
      title={block.title}
      intro={block.kicker}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={finished}
      completeHint={t("hookWatchFirst")}
      completeLabel={t("hookCta")}
      {...nav}
    >
      <p className="text-xl leading-relaxed text-pretty">{block.why}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="err" dot>
          {block.stat}
        </Chip>
      </div>

      <Surface pad="md" className="flex flex-col gap-3" aria-label={t("messagesLabel")}>
        {block.messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.25 }}
            className="flex items-start gap-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-sm font-semibold">{m.av}</span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold">{m.who}</span>
                <span className="font-mono text-xs text-ink-faint">{m.at}</span>
              </div>
              <p className="text-ink">{m.text}</p>
            </div>
          </motion.div>
        ))}
      </Surface>

      {roleText ? (
        <Callout label={adaptation.roleLabel ? t("roleCard", { role: adaptation.roleLabel }) : t("forYouCard")} icon={<UserRound />}>
          <p>{roleText}</p>
        </Callout>
      ) : null}

      <Surface pad="md" className="flex flex-col gap-4">
        <PipelineDiagram pipeline={pipeline} label={t("pipelineLabel")} />
        <AnimatePresence mode="wait">
          {current?.caption ? (
            <motion.p
              key={current.caption}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg bg-panel-2 px-3 py-2 font-mono text-sm"
              aria-live="polite"
            >
              {current.caption}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </Surface>

      <div className="flex flex-col gap-3">
        <p id="hunch-q" className="font-medium">
          {block.prompt.replace(" Click the node.", "")}
        </p>
        <ChoiceList
          name="hunch"
          labelledBy="hunch-q"
          options={block.hunches.map((h) => ({ id: h.id, text: h.label }))}
          value={guess}
          onChange={setGuess}
          disabled={frame >= 0}
          marks={finished && guess[0] ? { [guess[0]]: correct ? "correct" : "incorrect" } : undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" disabled={!guess.length || playing || frame >= 0} onClick={start}>
            <Play data-icon="inline-start" />
            {frame < 0 ? t("showRun") : t("playing")}
          </Button>
          {finished && frame >= 0 ? (
            <Button variant="ghost" onClick={start}>
              <RotateCcw data-icon="inline-start" />
              {t("replayRun")}
            </Button>
          ) : null}
        </div>
        {finished && frame >= 0 && guess[0] ? (
          <Feedback ok={correct} title={correct ? t("calledIt") : t("notQuite")}>
            {correct ? block.wrap_correct : block.wrap_wrong} <span className="text-ink-muted">{block.wrap_point}</span>
          </Feedback>
        ) : null}
      </div>

      {objectives.length ? (
        <Callout label={t("inThisModule")} icon={<Target />}>
          <ul className={cn("flex flex-col gap-1")}>
            {objectives.map((o) => (
              <li key={o.id}>
                <span className="mr-2 font-mono text-xs text-ink-faint">{o.lesson}</span>
                {o.text}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
    </StageShell>
  );
}
