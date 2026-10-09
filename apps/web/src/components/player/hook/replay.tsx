"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { PipelineDiagram } from "@/components/kit/pipeline";
import type { HookBlock } from "@/data/types";
import { Spoken, VoiceBadge } from "./film";
import type { Voice } from "./voice";

/**
 * What really happened, step by step on the diagram. Each caption is exactly
 * what the voice says, lit word by word, and the next step waits for the voice
 * to finish; the learner can step back and forth. Without sound, a step stays
 * up for as long as it takes to read. The last step stays until they move on.
 */
export function Replay({ block, moduleId, voice, guessed, reduce, onDone }: { block: HookBlock; moduleId: string; voice: Voice; guessed?: string; reduce: boolean; onDone: () => void }) {
  const t = useTranslations("cinema");
  const { say, progress } = voice;
  const frames = block.reveal.timeline;
  const [k, setK] = React.useState(0);
  const [told, setTold] = React.useState(false);
  const frame = frames[k]!;
  const doneRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    let alive = true;
    let timer = 0;
    const words = frames[k]!.caption.split(/\s+/).length;
    void say(`/audio/hook-${moduleId}-r${k}.mp3`).then((heard) => {
      if (!alive) return;
      timer = window.setTimeout(
        () => (k + 1 < frames.length ? setK(k + 1) : setTold(true)),
        heard ? 700 : 1200 + words * 320,
      );
    });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [k, frames, say, moduleId]);

  const go = React.useCallback(
    (j: number) => {
      if (j < 0 || j >= frames.length) return;
      setTold(false);
      setK(j);
    },
    [frames.length],
  );

  React.useEffect(() => {
    if (told) doneRef.current?.focus({ preventScroll: true });
  }, [told]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(k - 1);
      else if (e.key === "ArrowRight") {
        if (k + 1 < frames.length) go(k + 1);
        else onDone();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [k, frames.length, go, onDone]);

  return (
    <div className="hc-scene">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hc-kicker">{t("replayKicker")}</div>
        {guessed ? (
          <span className="hc-yours">
            {t("yourGuess")} <b>{guessed}</b>
          </span>
        ) : null}
      </div>
      <div className="hc-diagram">
        <PipelineDiagram pipeline={frame} label={t("diagramLabel")} center maxScale={1.35} />
      </div>
      <div className="hc-steps" role="group" aria-label={t("replaySteps")}>
        {frames.map((_, j) => (
          <button key={j} type="button" className="hc-step" aria-label={t("replayStep", { n: j + 1 })} aria-current={j === k ? "step" : undefined} data-done={j < k} onClick={() => go(j)} />
        ))}
      </div>
      <div className="hc-caption-row">
        <VoiceBadge voice={voice} />
        <div className="min-w-0 flex-1" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={k} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <Spoken text={frame.caption} progress={progress} className="hc-caption" />
            </motion.div>
          </AnimatePresence>
        </div>
        {told ? (
          <motion.button ref={doneRef} type="button" className="hc-btn" onClick={onDone} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
            {t("toVerdict")}
            <ArrowRight />
          </motion.button>
        ) : null}
      </div>
    </div>
  );
}
