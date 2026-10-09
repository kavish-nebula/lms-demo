"use client";

import "./film.css";
import * as React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FastForward, MousePointerClick, SendHorizontal, Volume2 } from "lucide-react";
import type { FilmShot, HookBlock } from "@/data/types";
import { Shot, actLabel, trackOf } from "./shots";
import type { Sfx } from "./sfx";
import type { Voice } from "./voice";

const clip = (moduleId: string, i: number, then = false) => `/audio/hook-${moduleId}-s${i}${then ? "-then" : ""}.mp3`;

/**
 * A line of narration whose words light up as the voice reaches them, so the
 * eye follows the ear instead of racing it. All lit when nothing is speaking.
 */
export function Spoken({ text, progress, className }: { text: string; progress: number | null; className?: string }) {
  const words = text.split(" ");
  const starts: number[] = [];
  words.forEach((w, i) => starts.push(i === 0 ? 0 : starts[i - 1]! + words[i - 1]!.length + 1));
  // a few characters ahead of the voice: a word lights as it begins, not after it ends
  const reach = progress == null ? Number.POSITIVE_INFINITY : progress * text.length + 4;
  return (
    <p className={className}>
      {words.map((w, i) => (
        <span key={i} className="hf-w" data-said={starts[i]! <= reach}>
          {i < words.length - 1 ? `${w} ` : w}
        </span>
      ))}
    </p>
  );
}

/**
 * Shows that the narrator is speaking (so a silent device is noticed at once),
 * or, when the browser refused to play sound, a button that plays it.
 */
export function VoiceBadge({ voice }: { voice: Voice }) {
  const t = useTranslations("cinema");
  if (voice.blocked)
    return (
      <button type="button" className="hf-voice-blocked" onClick={voice.retry}>
        <Volume2 aria-hidden />
        {t("voiceBlocked")}
      </button>
    );
  return (
    <span className="hf-voice" data-on={voice.progress !== null} role="img" aria-label={voice.progress !== null ? t("voiceOn") : undefined} aria-hidden={voice.progress === null}>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * The hook's opening as a short film the learner moves through at their own
 * pace: one scene at a time, one spoken line on screen at a time, and in most
 * scenes something to do (send the message, open the inbox, hold to make the
 * weekend pass) before the scene pays off. Nothing leaves the screen until the
 * learner chooses to continue.
 */
export function FilmPlayer({ block, moduleId, reduce, sfx, voice, onDone }: { block: HookBlock; moduleId: string; reduce: boolean; sfx: Sfx; voice: Voice; onDone: () => void }) {
  const shots = block.film?.shots ?? [];
  const [i, setI] = React.useState(0);
  const next = React.useCallback(() => (i + 1 < shots.length ? setI(i + 1) : onDone()), [i, shots.length, onDone]);
  const shot = shots[i];
  if (!shot) return null;
  return <FilmScene key={i} block={block} moduleId={moduleId} shot={shot} index={i} total={shots.length} reduce={reduce} sfx={sfx} voice={voice} onNext={next} />;
}

function FilmScene({
  block,
  moduleId,
  shot,
  index,
  total,
  reduce,
  sfx,
  voice,
  onNext,
}: {
  block: HookBlock;
  moduleId: string;
  shot: FilmShot;
  index: number;
  total: number;
  reduce: boolean;
  sfx: Sfx;
  voice: Voice;
  onNext: () => void;
}) {
  const t9 = useTranslations("cinema");
  const { say, progress } = voice;
  const track = React.useMemo(() => trackOf(shot, block), [shot, block]);
  const [t, setT] = React.useState(0);
  const [released, setReleased] = React.useState(0);
  const [holding, setHolding] = React.useState(false);
  // which line the voice has finished: the scene can't end mid-sentence
  const [heard, setHeard] = React.useState<"say" | "then" | null>(null);
  const held = React.useRef({ down: false, at: 0, burst: 0 });
  const actRef = React.useRef<HTMLButtonElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);

  const gate = track.gates[released];
  const waiting = gate !== undefined && t >= gate;
  const hold = track.hold;
  const holdOpen = hold !== undefined && t >= hold[0] && t < hold[1];
  const acted = hold ? t >= hold[1] : track.gates.length > 0 && released >= track.gates.length;
  const then = "then" in shot ? shot.then : undefined;
  const ready = t >= track.len && heard === (then ? "then" : "say");
  const last = index === total - 1;

  // the scene's line, then (once the learner has acted) its payoff line
  React.useEffect(() => {
    let alive = true;
    void say(clip(moduleId, index)).then(() => {
      if (alive) setHeard((h) => h ?? "say");
    });
    return () => {
      alive = false;
    };
  }, [say, moduleId, index]);
  React.useEffect(() => {
    if (!acted || !then) return;
    let alive = true;
    void say(clip(moduleId, index, true)).then(() => {
      if (alive) setHeard("then");
    });
    return () => {
      alive = false;
    };
  }, [acted, then, say, moduleId, index]);

  // the scene clock: runs to the next stop (a gate, or the start of an un-held stretch), then waits
  React.useEffect(() => {
    let raf = 0;
    let before = performance.now();
    const tick = (now: number) => {
      // reduced motion: no animation in between, the scene jumps to where it stops
      const dt = reduce ? Number.POSITIVE_INFINITY : Math.min(100, now - before);
      before = now;
      setT((prev) => {
        let stop = track.len;
        const g = track.gates[released];
        if (g !== undefined) stop = Math.min(stop, g);
        const running = held.current.down || now < held.current.burst;
        if (track.hold && prev < track.hold[1] && !running) stop = Math.min(stop, Math.max(prev, track.hold[0]));
        return Math.min(stop, prev + dt);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track, released, reduce]);

  const act = React.useCallback(() => {
    if (!waiting) return;
    setReleased((r) => r + 1);
  }, [waiting]);

  function press() {
    held.current.down = true;
    held.current.at = performance.now();
    setHolding(true);
  }
  function lift() {
    if (!held.current.down) return;
    held.current.down = false;
    setHolding(false);
    // a quick tap still moves time on a little, so tapping works too
    if (performance.now() - held.current.at < 250) held.current.burst = performance.now() + 900;
  }

  React.useEffect(() => {
    if ((waiting && !track.inScene) || holdOpen) actRef.current?.focus({ preventScroll: true });
  }, [waiting, holdOpen, track.inScene]);
  React.useEffect(() => {
    if (ready) nextRef.current?.focus({ preventScroll: true });
  }, [ready]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowRight") return;
      if (waiting && !track.inScene) act();
      else if (ready) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [waiting, ready, act, onNext, track.inScene]);

  const caption = acted && then ? then : shot.say;
  const holdP = hold ? Math.min(1, Math.max(0, (t - hold[0]) / (hold[1] - hold[0]))) : 0;
  // a slow push in while the scene plays; it stops when the scene waits
  const camera = reduce ? undefined : { transform: `scale(${1 + 0.035 * Math.min(1, t / track.len)})` };

  return (
    <div className="hf-wrap">
      <motion.div className="hf-frame" role="group" aria-label={shot.label} initial={reduce ? false : { opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <div className="hf-cam" style={camera}>
          <Shot shot={shot} t={t} block={block} reduce={reduce} sfx={sfx} waiting={waiting} onAct={act} />
        </div>
        <div className="hf-chyron">
          <i aria-hidden />
          {shot.label}
        </div>
        {waiting && track.inScene ? (
          <button type="button" className="hf-showme" onClick={act}>
            {t9("showMe")}
          </button>
        ) : null}
        <div className="hf-bar" aria-hidden>
          <i style={{ width: `${Math.min(100, (t / track.len) * 100)}%` }} />
        </div>
      </motion.div>
      {/* the learner's button: over the bottom of the picture, or under it on a narrow screen */}
      <div className="hf-dock">
        <AnimatePresence>
          {waiting && !track.inScene ? (
            <motion.button
              key={`act-${released}`}
              ref={actRef}
              type="button"
              className="hf-act"
              onClick={act}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {shot.type === "site-chat" ? <SendHorizontal aria-hidden /> : <MousePointerClick aria-hidden />}
              {actLabel(shot, released)}
            </motion.button>
          ) : null}
          {holdOpen ? (
            <motion.button
              key="hold"
              ref={actRef}
              type="button"
              className="hf-act hold"
              data-holding={holding}
              style={{ "--p": holdP } as React.CSSProperties}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                press();
              }}
              onPointerUp={lift}
              onPointerCancel={lift}
              onLostPointerCapture={lift}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if (e.key !== " " && e.key !== "Enter") return;
                e.preventDefault();
                if (!e.repeat) press();
              }}
              onKeyUp={(e) => {
                if (e.key !== " " && e.key !== "Enter") return;
                e.preventDefault();
                lift();
              }}
            >
              <span className="hf-ring" aria-hidden />
              <FastForward aria-hidden />
              <span className="flex flex-col items-start">
                {actLabel(shot, 0)}
                <small>{t9("pressHold")}</small>
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="hf-under">
        <div className="hf-side">
          <span className="hf-count">{t9("sceneCount", { n: index + 1, total })}</span>
          <VoiceBadge voice={voice} />
        </div>
        <div className="hf-say" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={caption} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <Spoken text={caption} progress={progress} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hf-next-slot">
          {ready ? (
            <motion.button ref={nextRef} type="button" className="hc-btn hf-next" onClick={onNext} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
              {last ? t9("toCall") : t9("continue")}
              <ArrowRight />
            </motion.button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
