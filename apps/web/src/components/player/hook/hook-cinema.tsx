"use client";

import "./hook-cinema.css";
import * as React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { ArrowRight, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { PipelineDiagram } from "@/components/kit/pipeline";
import { NumberTicker } from "@/components/kit/number-ticker";
import { DEMO_OPEN } from "@/lib/demo";
import { useLocalString, writeLocal } from "@/lib/local-store";
import { ROLE_HOOK } from "@/lib/world";
import { planModule } from "@/lib/learner-plan";
import { FilmPlayer } from "./film";
import { Replay } from "./replay";
import { parseStake } from "./shots";
import { sfxFor, unlockSfx } from "./sfx";
import { useVoice } from "./voice";
import type { Adaptation } from "@/lib/setup";
import type { HookBlock, Objective } from "@/data/types";

type Scene = "start" | "film" | "open" | "messages" | "stakes" | "call" | "replay" | "verdict";
type Auto = "open" | "messages" | "stakes";
/** the opening as a film of illustrated scenes, or (for hooks without one) as text scenes */
const FILM_STORY: Scene[] = ["film", "call", "replay", "verdict"];
const TEXT_STORY: Scene[] = ["open", "messages", "stakes", "call", "replay", "verdict"];
type Confidence = "hunch" | "fairly" | "certain";
const CONFIDENCE: Confidence[] = ["hunch", "fairly", "certain"];
const SOUND_KEY = "lms-hook-sound";

/** "Before anything is explained: why ...?" -> a kicker and the question itself. */
function splitPrompt(prompt: string): [string | null, string] {
  const clean = prompt.replace(" Click the node.", "");
  const i = clean.indexOf(":");
  if (i > 0 && i < 40) {
    const q = clean.slice(i + 1).trim();
    return [clean.slice(0, i), q.charAt(0).toUpperCase() + q.slice(1)];
  }
  return [null, clean];
}

/** The verdict headline already says "You called it" or "Not quite", so drop the feedback's own opener. */
function withoutOpener(text: string) {
  return text.replace(/^(exactly|right|not quite|called it|close|spot on|yes|no)[.!,:]?\s+/i, "");
}

/** One narration clip. Silent (duration 0) when it is missing or the browser refuses to play it. */
function useClip(src: string) {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.onloadedmetadata = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => setBroken(true);
    a.src = src;
    ref.current = a;
    return () => {
      a.pause();
      ref.current = null;
    };
  }, [src]);
  const play = React.useCallback(() => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => setBroken(true));
  }, []);
  const stop = React.useCallback(() => ref.current?.pause(), []);
  return { duration: broken ? 0 : duration, play, stop };
}

/** Milliseconds since the current scene started. */
function useSceneClock(scene: Scene) {
  // the reading belongs to the scene it was taken in, so a new scene starts at 0
  const [tick, setTick] = React.useState({ scene, ms: 0 });
  React.useEffect(() => {
    // only the text opening runs on this clock; the film and the replay keep their own pace
    if (scene !== "open" && scene !== "messages" && scene !== "stakes") return;
    const t0 = performance.now();
    const id = window.setInterval(() => setTick({ scene, ms: performance.now() - t0 }), 100);
    return () => window.clearInterval(id);
  }, [scene]);
  return tick.scene === scene ? tick.ms : 0;
}

/**
 * Stage 1, the problem hook, played as a short full-screen film with nothing
 * else on screen: a cold open, the team's messages as they arrive, what the
 * failure cost, the learner's call (with how sure they are), the replay of
 * what really happened in step with the narration, and the verdict that names
 * the idea the module teaches. Committing to a guess first, especially a
 * confident wrong one, is what makes the answer stick.
 */
export function HookCinema({
  block,
  moduleId,
  moduleIndex,
  moduleTitle,
  courseTitle,
  objectives,
  adaptation,
  nextTitle,
  done,
  onComplete,
  onExit,
}: {
  block: HookBlock;
  moduleId: string;
  moduleIndex: number;
  moduleTitle: string;
  courseTitle: string;
  objectives: Objective[];
  adaptation: Adaptation;
  nextTitle: string;
  done: boolean;
  onComplete: () => void;
  onExit: () => void;
}) {
  const t = useTranslations("cinema");
  const reduce = useReducedMotionConfig() ?? false;
  const [scene, setScene] = React.useState<Scene>("start");
  const [guess, setGuess] = React.useState<string | null>(null);
  const [sure, setSure] = React.useState<Confidence | null>(null);
  const soundOn = useLocalString(SOUND_KEY) !== "off";
  // the text opening (for a hook without a film) is one clip; the film and the replay speak line by line
  const openClip = useClip(`/audio/hook-${moduleId}-open.mp3`);
  const voice = useVoice(soundOn);
  const clock = useSceneClock(scene);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const sfx = React.useMemo(() => sfxFor(soundOn), [soundOn]);
  const hasFilm = Boolean(block.film?.shots.length);
  const STORY = hasFilm ? FILM_STORY : TEXT_STORY;

  const stakes = React.useMemo(() => block.stat.split("·").map((s) => parseStake(s.trim())), [block.stat]);
  const [lead, question] = splitPrompt(block.prompt);
  const opening = hasFilm ? (block.film?.shots ?? []).map((s) => `${s.say} ${"then" in s ? s.then : ""}`).join(" ") : block.narration;
  const words = `${opening} ${block.reveal.timeline.map((f) => f.caption).join(" ")}`.split(/\s+/).length;
  // spoken words at about 150 a minute, plus time to look, act and choose
  const minutes = Math.max(1, Math.round(words / 150 + 1));

  // pacing: each opening scene has a minimum length, stretched to the narration when sound is on
  const base: Record<Auto, number> = {
    open: 6500,
    messages: 1600 * block.messages.length + 1400,
    stakes: 1500 * stakes.length + 2000,
  };
  const baseTotal = base.open + base.messages + base.stakes;
  const stretch = soundOn && openClip.duration ? Math.max(1, (openClip.duration * 1000 + 300) / baseTotal) : 1;
  const dur = (s: Auto) => base[s] * stretch;
  const { stop: hush, unlock } = voice;

  const stopAll = React.useCallback(() => {
    openClip.stop();
    hush();
  }, [openClip, hush]);

  const advance = React.useCallback(() => {
    setScene((s) => (s === "open" ? "messages" : s === "messages" ? "stakes" : s === "stakes" ? "call" : s));
  }, []);

  function begin() {
    // the narration starts a moment after this click, once the scene has drawn: let the browser allow it now
    unlockSfx();
    unlock();
    setGuess(null);
    setSure(null);
    if (hasFilm) setScene("film");
    else {
      setScene("open");
      if (soundOn) openClip.play();
    }
  }

  const toCall = React.useCallback(() => {
    stopAll();
    setScene("call");
  }, [stopAll]);

  function lockIn() {
    stopAll();
    unlock();
    setScene("replay");
  }

  function watchAgain() {
    unlock();
    setScene("replay");
  }

  const toVerdict = React.useCallback(() => {
    hush();
    setScene("verdict");
  }, [hush]);

  const exit = React.useCallback(() => {
    stopAll();
    onExit();
  }, [onExit, stopAll]);

  function finish() {
    stopAll();
    onComplete();
  }

  function toggleSound() {
    if (soundOn) stopAll();
    writeLocal(SOUND_KEY, soundOn ? "off" : "on");
  }

  // the text opening runs by itself: each of its scenes moves on once its time is up
  React.useEffect(() => {
    if (scene !== "open" && scene !== "messages" && scene !== "stakes") return;
    const id = window.setTimeout(advance, Math.max(0, dur(scene) - clock));
    return () => window.clearTimeout(id);
    // dur() only depends on values already listed; the clock is read when the scene or its length changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, stretch, advance]);

  // nothing else on the page while the film is open
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  React.useEffect(() => {
    sceneRef.current?.focus({ preventScroll: true });
  }, [scene]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      } else if (scene === "call" && /^[1-9]$/.test(e.key)) {
        const h = block.hunches[Number(e.key) - 1];
        if (h) setGuess(h.id);
      } else if (e.key === "ArrowRight" && (scene === "open" || scene === "messages" || scene === "stakes")) {
        advance();
      }
      // the film and the replay handle their own arrow keys
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene, block.hunches, advance, exit]);

  const at = STORY.indexOf(scene);
  const correct = guess === block.correct;
  const mood = scene === "stakes" || scene === "replay" || (scene === "verdict" && !correct) ? "alarm" : scene === "verdict" ? "win" : undefined;
  const fade = reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.45 } };
  const appear = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay } });

  let body: React.ReactNode = null;

  if (scene === "start") {
    body = (
      <div className="hc-scene narrow">
        <motion.div {...appear(0)} className="hc-kicker cool">
          {t("startKicker", { n: moduleIndex })}
        </motion.div>
        <motion.h1 {...appear(0.1)} id="hc-title" className="hc-title">
          {block.title}
        </motion.h1>
        <motion.p {...appear(0.25)} className="hc-lede">
          {t("startLine")}
        </motion.p>
        <motion.div {...appear(0.4)} className="flex flex-wrap items-center gap-5 pt-2">
          <button type="button" className="hc-btn big" onClick={begin} autoFocus>
            <Play />
            {t("begin")}
          </button>
          <span className="hc-hint">{soundOn ? t("beginHint", { minutes }) : t("beginHintMuted", { minutes })}</span>
        </motion.div>
        {done || DEMO_OPEN ? (
          <button type="button" className="hc-link self-start" onClick={finish}>
            {t("skipToNext", { title: nextTitle })}
            <ArrowRight />
          </button>
        ) : null}
      </div>
    );
  } else if (scene === "film") {
    body = (
      <div className="hc-scene film">
        <h1 id="hc-title" className="sr-only">
          {block.title}
        </h1>
        <FilmPlayer block={block} moduleId={moduleId} reduce={reduce} sfx={sfx} voice={voice} onDone={toCall} />
      </div>
    );
  } else if (scene === "open") {
    const typed = reduce ? block.kicker.length : Math.floor(clock / 45);
    body = (
      <div className="hc-scene narrow">
        <div className="hc-kicker" aria-label={block.kicker}>
          <span aria-hidden>{block.kicker.slice(0, typed)}</span>
          {typed < block.kicker.length ? <span aria-hidden className="hc-caret" /> : null}
        </div>
        <h1 className="hc-title" id="hc-title">
          {block.title.split(" ").map((w, i) => (
            <motion.span key={i} className="w" {...appear(0.6 + i * 0.07)}>
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p {...appear(1.5)} className="hc-lede">
          {block.why}
        </motion.p>
      </div>
    );
  } else if (scene === "messages") {
    const n = block.messages.length;
    const per = (dur("messages") - 700) / n;
    const people = [...new Set(block.messages.map((m) => m.who))];
    body = (
      <div className="hc-scene narrow">
        <div className="hc-chat" role="log" aria-label={t("teamChat")}>
          <div className="hc-chat-head">
            <span className="hc-live" aria-hidden />
            <b>{t("channel")}</b>
            <span>{t("teamChat")}</span>
          </div>
          <div className="hc-chat-body">
            {block.messages.map((m, i) => {
              const showAt = i * per + 700;
              const typing = !reduce && clock >= i * per && clock < showAt;
              const shown = reduce || clock >= showAt;
              if (!typing && !shown) return null;
              return (
                <motion.div key={i} className="hc-msg" data-tone={people.indexOf(m.who) % 3} {...appear(0)}>
                  <span className="hc-av" aria-hidden>
                    {m.av}
                  </span>
                  <div className="min-w-0">
                    <div className="hc-msg-who">
                      {m.who}
                      <time>{m.at}</time>
                    </div>
                    {shown ? (
                      <p>{m.text}</p>
                    ) : (
                      <span className="hc-typing" aria-label={t("typing", { name: m.who })}>
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } else if (scene === "stakes") {
    const per = (dur("stakes") - 1800) / Math.max(1, stakes.length);
    body = (
      <div className="hc-scene">
        <motion.div {...appear(0)} className="hc-kicker">
          {t("costKicker")}
        </motion.div>
        <ul className="hc-stakes">
          {stakes.map((s, i) =>
            reduce || clock >= 300 + i * per ? (
              <motion.li key={i} className="hc-stake" {...(reduce ? {} : { initial: { opacity: 0, x: -24 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.5 } })}>
                {"value" in s ? (
                  <span>
                    {s.before}
                    <span className="n">
                      <NumberTicker value={s.value} prefix={s.prefix} />
                    </span>
                    {s.after}
                  </span>
                ) : (
                  <span>{s.text}</span>
                )}
              </motion.li>
            ) : null,
          )}
        </ul>
      </div>
    );
  } else if (scene === "call") {
    body = (
      <div className="hc-scene">
        <div className="hc-kicker cool">{lead ?? t("yourCall")}</div>
        <h1 className="hc-question" id="hc-title">
          {question}
        </h1>
        <div className="hc-diagram">
          <PipelineDiagram pipeline={block.pipeline} label={t("diagramLabel")} center maxScale={1.35} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="hc-choices" role="group" aria-label={t("yourCall")}>
            {block.hunches.map((h, i) => (
              <button
                key={h.id}
                type="button"
                className="hc-choice"
                aria-pressed={guess === h.id}
                data-dim={guess !== null && guess !== h.id}
                onClick={() => setGuess(h.id)}
              >
                <span className="hc-key" aria-hidden>
                  {i + 1}
                </span>
                {h.label}
              </button>
            ))}
          </div>
          <span className="hc-hint">{t("pickHint", { count: block.hunches.length })}</span>
        </div>
        <AnimatePresence>
          {guess ? (
            <motion.div key="sure" className="flex flex-col gap-5" {...fade}>
              <div className="hc-sure" role="group" aria-label={t("howSure")}>
                <span className="hc-sure-label">{t("howSure")}</span>
                {CONFIDENCE.map((c) => (
                  <button key={c} type="button" className="hc-chip" aria-pressed={sure === c} onClick={() => setSure(c)}>
                    {t(`sure_${c}`)}
                  </button>
                ))}
              </div>
              <div>
                <button type="button" className="hc-btn" onClick={lockIn}>
                  {t("lockIn")}
                  <ArrowRight />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  } else if (scene === "replay") {
    body = <Replay block={block} moduleId={moduleId} voice={voice} guessed={block.hunches.find((h) => h.id === guess)?.label} reduce={reduce} onDone={toVerdict} />;
  } else {
    // the learner's plan retells why this module matters for them; without one, the role's standard line
    const roleText =
      planModule(adaptation.plan, moduleId)?.hookScene ||
      (adaptation.roleKey ? ROLE_HOOK[moduleIndex]?.[adaptation.roleKey as keyof (typeof ROLE_HOOK)[1]] : undefined);
    const line = correct ? (sure === "certain" ? t("winSure") : t("win")) : sure === "certain" ? t("missSure") : t("miss");
    body = (
      <div className="hc-scene hc-verdict-grid">
        <div className="flex min-w-0 flex-col gap-5">
          <motion.h1 {...appear(0)} id="hc-title" className={correct ? "hc-verdict win" : "hc-verdict miss"}>
            {correct ? t("calledIt") : t("notQuite")}
          </motion.h1>
          <motion.p {...appear(0.2)} className="hc-lede">
            {line} {withoutOpener(correct ? block.wrap_correct : block.wrap_wrong)}
          </motion.p>
          {roleText ? (
            <motion.p {...appear(0.4)} className="hc-role">
              <b>{adaptation.roleLabel ? t("forYou", { role: adaptation.roleLabel }) : t("forYouPlain")}</b> {roleText}
            </motion.p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <motion.div {...appear(0.45)} className="hc-thesis">
            <div className="hc-kicker cool mb-2">{t("thesis")}</div>
            <p>{block.wrap_point}</p>
          </motion.div>
          {objectives.length ? (
            <motion.div {...appear(0.65)} className="flex flex-col gap-2.5">
              <div className="hc-kicker cool">{t("inModule")}</div>
              <ul className="hc-learn">
                {objectives.map((o) => (
                  <li key={o.id}>
                    <span>{o.lesson}</span>
                    {o.text}
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}
          <motion.div {...appear(0.85)} className="flex flex-wrap items-center gap-5 pt-1">
            <button type="button" className="hc-btn big" onClick={finish}>
              {t("startModule", { title: nextTitle })}
              <ArrowRight />
            </button>
            <button type="button" className="hc-link" onClick={watchAgain}>
              <RotateCcw />
              {t("watchAgain")}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="hc-root" data-theme="aurora" data-mood={mood} role="dialog" aria-modal="true" aria-labelledby="hc-title">
      <div className="hc-ambient" aria-hidden />
      <div className="hc-vignette" aria-hidden />
      <header className="hc-top">
        <div className="hc-where">{t("where", { course: courseTitle, n: moduleIndex, module: moduleTitle })}</div>
        <div className="hc-progress" role="progressbar" aria-label={t("progress")} aria-valuemin={0} aria-valuemax={STORY.length} aria-valuenow={Math.max(0, at)}>
          {STORY.map((s, i) => (
            <span key={s} data-on={at < 0 ? undefined : i < at ? "done" : i === at ? "now" : undefined} />
          ))}
        </div>
        <button type="button" className="hc-icon-btn" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? t("soundOff") : t("soundOn")}>
          {soundOn ? <Volume2 /> : <VolumeX />}
        </button>
        <button type="button" className="hc-icon-btn" onClick={exit} aria-label={t("exit")}>
          <X />
        </button>
      </header>
      <div className="hc-stage">
        <AnimatePresence mode="wait">
          <motion.div key={scene} ref={sceneRef} tabIndex={-1} className="flex w-full outline-none" {...(reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.35 } })}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      {scene === "film" ? (
        <div className="hc-next">
          <button type="button" className="hc-link" onClick={toCall}>
            {t("skipFilm")}
            <ArrowRight />
          </button>
        </div>
      ) : scene === "open" || scene === "messages" || scene === "stakes" ? (
        <div className="hc-next">
          <span className="hc-hint">{t("skipHint")}</span>
          <button type="button" className="hc-link" onClick={advance}>
            {t("continue")}
            <ArrowRight />
          </button>
        </div>
      ) : scene === "replay" ? (
        <div className="hc-next">
          <button type="button" className="hc-link" onClick={toVerdict}>
            {t("skipReplay")}
            <ArrowRight />
          </button>
        </div>
      ) : null}
    </div>
  );
}
