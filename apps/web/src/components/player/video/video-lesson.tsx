"use client";

import "./video.css";
import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Captions,
  CheckCircle2,
  ChevronDown,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalString, writeLocal } from "@/lib/local-store";
import { VideoSlideView } from "@/components/player/video/video-slide";
import type { ConceptVideo, VideoQuiz } from "@/data/types";

const RATES = [0.75, 1, 1.25, 1.5] as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** seconds, until the clip's real length is known (or when a clip is missing) */
const estimate = (text: string) => Math.max(4, text.split(/\s+/).length * 0.4);
const audioSrc = (video: ConceptVideo, i: number) => `/audio/video-${video.id}-s${i}.mp3`;

type Phase = "play" | "mid" | "end" | "done";

/**
 * A concept video made of narrated HTML/CSS slides (ported from the
 * prototype's VideoLesson). It plays like a video: one play button, slides
 * advance with the recorded voice, and everything on a slide appears as the
 * narration reaches it. Because it is live in the page it can pause for a
 * short check half way and at the end. Nothing plays until the learner
 * presses play. Captions, speed, chapters, a transcript and fullscreen are
 * built in; keyboard: Space play/pause, arrows slides, M mute, C captions,
 * F fullscreen.
 */
export function VideoLesson({
  video,
  onComplete,
  onNext,
  nextLabel,
}: {
  video: ConceptVideo;
  /** the video was watched to the end (and its checks answered or skipped) */
  onComplete?: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const t = useTranslations("video");
  const slides = video.slides;
  const last = slides.length - 1;
  const quizAfter = video.quizAfter ?? -1;
  const srcs = React.useMemo(() => slides.map((_, i) => audioSrc(video, i)), [video, slides]);

  const [idx, setIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [frac, setFrac] = React.useState(0);
  const [seen, setSeen] = React.useState<Set<number>>(() => new Set());
  const [phase, setPhase] = React.useState<Phase>("play");
  const [midPassed, setMidPassed] = React.useState(!video.midQuiz.length);
  const [endPassed, setEndPassed] = React.useState(!video.endQuiz.length);
  const [muted, setMuted] = React.useState(false);
  const [lengths, setLengths] = React.useState(() => slides.map((s) => estimate(s.narration)));
  const [full, setFull] = React.useState(false);
  const [transcript, setTranscript] = React.useState(false);
  const storedRate = Number(useLocalString("lms-video-rate") ?? "1");
  const rate = (RATES as readonly number[]).includes(storedRate) ? storedRate : 1;
  const captionsOn = useLocalString("lms-video-cc") !== "off";

  const wrap = React.useRef<HTMLDivElement>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const silent = React.useRef<Record<number, boolean>>({});
  const live = React.useRef({ idx, playing, midPassed, endPassed });
  React.useLayoutEffect(() => {
    live.current = { idx, playing, midPassed, endPassed };
  });

  // every clip's real length, for the clock
  React.useEffect(() => {
    const probes = srcs.map((src, i) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => setLengths((l) => l.map((v, k) => (k === i && a.duration ? a.duration : v)));
      a.src = src;
      return a;
    });
    return () =>
      probes.forEach((a) => {
        a.onloadedmetadata = null;
        a.src = "";
      });
  }, [srcs]);

  const slideEnded = () => {
    const { idx: i, midPassed: mid, endPassed: end } = live.current;
    setSeen((s) => new Set(s).add(i));
    setFrac(1);
    if (i === quizAfter && !mid) {
      setPlaying(false);
      return setPhase("mid");
    }
    if (i === last) {
      setPlaying(false);
      return setPhase(end ? "done" : "end");
    }
    setFrac(0);
    setIdx(i + 1);
  };
  const endedRef = React.useRef(slideEnded);
  React.useLayoutEffect(() => {
    endedRef.current = slideEnded;
  });

  // one audio element for the whole video
  React.useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    const onEnd = () => endedRef.current();
    const onErr = () => {
      silent.current[live.current.idx] = true;
    };
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      a.pause();
      a.src = "";
    };
  }, []);

  // a new slide: load its clip, and keep playing if the video was playing
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = srcs[idx]!;
    a.muted = muted;
    a.playbackRate = rate;
    if (live.current.playing)
      a.play().catch((e: DOMException) => {
        // a missing clip falls back to the timed clock; a blocked autoplay pauses
        if (e?.name === "NotSupportedError") silent.current[live.current.idx] = true;
        else if (!silent.current[live.current.idx]) setPlaying(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muted/rate are applied by their own effect
  }, [idx, srcs]);

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = muted;
    a.playbackRate = rate;
  }, [muted, rate]);

  // while playing, the voice is the clock (or a timer, when a clip is missing)
  React.useEffect(() => {
    if (!playing || phase !== "play") return;
    let raf = 0;
    let prev = 0;
    let elapsed = frac * lengths[idx]!;
    const tick = (ts: number) => {
      const a = audioRef.current;
      if (silent.current[idx]) {
        elapsed += prev ? ((ts - prev) / 1000) * rate : 0;
        prev = ts;
        if (elapsed >= lengths[idx]!) return endedRef.current();
        setFrac(elapsed / lengths[idx]!);
      } else if (a?.duration) setFrac(Math.min(1, a.currentTime / a.duration));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart the clock only when these change
  }, [playing, phase, idx, rate]);

  const play = () => {
    setPlaying(true);
    if (!silent.current[idx]) audioRef.current?.play().catch(() => !silent.current[idx] && setPlaying(false));
  };
  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };
  const jump = (to: number, andPlay = false) => {
    if (to === idx) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      setFrac(0);
      if (andPlay) play();
    } else {
      if (andPlay) setPlaying(true);
      setFrac(0);
      setIdx(to);
    }
  };
  const goTo = (i: number) => {
    const to = Math.max(0, Math.min(last, i));
    // moving past the half-way point brings up its check first
    if (to > quizAfter && quizAfter >= 0 && !midPassed && phase === "play") {
      pause();
      return setPhase("mid");
    }
    setPhase("play");
    jump(to);
  };
  const next = () => {
    if (idx === last) {
      pause();
      return setPhase(endPassed ? "done" : "end");
    }
    setSeen((s) => new Set(s).add(idx));
    goTo(idx + 1);
  };
  const restart = () => {
    setSeen(new Set());
    setPhase("play");
    jump(0, true);
  };

  // tell the topic once the video has been watched to the end
  const reported = React.useRef(false);
  React.useEffect(() => {
    if (phase === "done" && !reported.current) {
      reported.current = true;
      onComplete?.();
    }
  }, [phase, onComplete]);

  // fullscreen follows the browser (Esc leaves it too)
  React.useEffect(() => {
    const on = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  };

  const slide = slides[idx]!;
  const sentences = React.useMemo(() => (slide.sentences.length ? slide.sentences : [slide.narration]), [slide]);
  // where in the narration (0-1) each sentence begins, by its share of the characters
  const starts = React.useMemo(() => {
    const lens = sentences.map((s) => s.length);
    const total = lens.reduce((n, l) => n + l, 0) || 1;
    return lens.map((_, i) => lens.slice(0, i).reduce((n, l) => n + l, 0) / total);
  }, [sentences]);
  const all = seen.has(idx);
  const shown = (cue = 0) => all || (frac >= (starts[Math.min(cue, starts.length - 1)] ?? 0) - 0.005 && (cue === 0 || frac > 0));
  const sentenceNow = Math.max(0, starts.findLastIndex((at) => frac >= at));
  const total = lengths.reduce((a, b) => a + b, 0);
  const elapsed = lengths.slice(0, idx).reduce((a, b) => a + b, 0) + frac * lengths[idx]!;
  const untouched = !playing && idx === 0 && frac === 0 && seen.size === 0;

  function onKey(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (phase !== "play" || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if ((key === " " || key === "k") && tag !== "BUTTON" && tag !== "INPUT") {
      e.preventDefault();
      if (playing) pause();
      else play();
    } else if (key === "arrowright") next();
    else if (key === "arrowleft") goTo(idx - 1);
    else if (key === "m") setMuted((m) => !m);
    else if (key === "c") writeLocal("lms-video-cc", captionsOn ? "off" : "on");
    else if (key === "f") toggleFull();
  }

  return (
    <div
      ref={wrap}
      onKeyDown={onKey}
      className={cn("flex flex-col gap-3", full && "items-center justify-center bg-canvas p-6")}
      aria-label={t("player", { title: video.title })}
      role="region"
    >
      <div className={cn("vl-stage", full && "w-[min(100%,calc((100dvh-170px)*16/9))]")}>
        {phase !== "done" ? <VideoSlideView key={idx} slide={slide} shown={shown} /> : null}

        <AnimatePresence>
          {phase === "mid" ? (
            <QuizOverlay
              key="mid"
              questions={video.midQuiz}
              doneLabel={t("continueVideo")}
              onDone={() => {
                setMidPassed(true);
                setPhase("play");
                setPlaying(true);
                setFrac(0);
                setIdx(quizAfter + 1);
              }}
            />
          ) : null}
          {phase === "end" ? (
            <QuizOverlay
              key="end"
              questions={video.endQuiz}
              doneLabel={t("finish")}
              onDone={() => {
                setEndPassed(true);
                setPhase("done");
              }}
            />
          ) : null}
          {phase === "done" ? (
            <motion.div key="done" className="vl-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex max-w-md flex-col items-center gap-3 text-center"
              >
                <CheckCircle2 className="size-10 text-ok" aria-hidden />
                <h3 className="text-xl font-semibold">{t("complete")}</h3>
                <p className="text-ink-muted">{t("completeBody", { title: video.title })}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" className="bg-transparent" onClick={restart}>
                    <RotateCcw data-icon="inline-start" />
                    {t("watchAgain")}
                  </Button>
                  {onNext ? (
                    <Button variant="brand" onClick={onNext}>
                      {nextLabel ?? t("next")}
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {untouched && phase === "play" ? (
          <button
            type="button"
            onClick={play}
            aria-label={t("playVideo")}
            className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-[linear-gradient(140deg,var(--accent-deep),var(--accent))] pl-1 text-white shadow-lg outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-ring/60"
          >
            <Play className="size-8" aria-hidden />
          </button>
        ) : null}
      </div>

      {phase === "play" && captionsOn ? (
        <p className={cn("min-h-[3.2em] w-full rounded-lg border-l-[3px] border-brand bg-panel-2 px-4 py-2.5 leading-relaxed", full && "max-w-[min(100%,calc((100dvh-170px)*16/9))]")}>
          {untouched ? <span className="text-ink-muted">{t("pressPlay")}</span> : sentences[all && !playing ? sentences.length - 1 : sentenceNow]}
        </p>
      ) : null}

      <div
        role="group"
        aria-label={t("controls")}
        className={cn("flex w-full flex-wrap items-center gap-1.5 rounded-card border border-line bg-panel-2 px-2.5 py-2", full && "max-w-[min(100%,calc((100dvh-170px)*16/9))]")}
      >
        <CtrlButton label={t("prevSlide")} onClick={() => goTo(idx - 1)} disabled={idx === 0 || phase !== "play"}>
          <SkipBack />
        </CtrlButton>
        <Button size="sm" variant="brand" onClick={playing ? pause : play} disabled={phase !== "play"} aria-label={playing ? t("pause") : t("playVideo")}>
          {playing ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
          {playing ? t("pause") : t("play")}
        </Button>
        <CtrlButton label={t("nextSlide")} onClick={next} disabled={phase !== "play"}>
          <SkipForward />
        </CtrlButton>
        <CtrlButton label={t("replaySlide")} onClick={() => goTo(idx)} disabled={phase !== "play"}>
          <Rewind />
        </CtrlButton>

        <div className="mx-1.5 flex min-w-40 flex-[1_1_220px] items-center gap-[3px]">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              title={t("slideN", { n: i + 1, title: s.title })}
              aria-label={t("slideN", { n: i + 1, title: s.title })}
              aria-current={i === idx ? "step" : undefined}
              style={{ flexGrow: lengths[i] }}
              className={cn(
                "relative h-2 flex-[1_1_0] cursor-pointer rounded-pill bg-chart-track outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                i === idx && "outline-2 outline-offset-2 outline-brand-soft",
              )}
            >
              <span
                className="block h-full rounded-pill bg-brand"
                style={{ width: `${(i < idx || seen.has(i) ? 1 : i === idx ? frac : 0) * 100}%` }}
              />
              {i === quizAfter ? (
                <i
                  title={t("quickCheck")}
                  className={cn("absolute -top-1 -right-1 z-[1] h-4 w-[7px] rounded-[3px]", midPassed ? "bg-ok" : "bg-amber")}
                />
              ) : null}
            </button>
          ))}
        </div>

        <span className="font-mono text-xs whitespace-nowrap text-ink-faint tabular-nums">
          {fmt(elapsed / rate)} / {fmt(total / rate)}
        </span>
        <span className="rounded-pill border border-line px-2 py-0.5 font-mono text-xs text-ink-muted tabular-nums">
          {idx + 1}/{slides.length}
        </span>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={t("chapters")}>
              <ListVideo />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1.5">
            <div className="px-2 py-1.5 text-xs font-semibold text-ink-faint">{t("chapters")}</div>
            <ol className="flex flex-col">
              {slides.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-ring/60",
                      i === idx && "bg-brand-soft text-brand-ink",
                    )}
                  >
                    <span className="w-5 font-mono text-xs text-ink-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <span className="font-mono text-xs text-ink-faint">{fmt(lengths[i]! / rate)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="ghost"
          className="font-mono tabular-nums"
          aria-label={t("speed", { rate })}
          onClick={() => writeLocal("lms-video-rate", String(RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length]))}
        >
          {rate}×
        </Button>
        <CtrlButton label={captionsOn ? t("captionsOff") : t("captionsOn")} pressed={captionsOn} onClick={() => writeLocal("lms-video-cc", captionsOn ? "off" : "on")}>
          <Captions />
        </CtrlButton>
        <CtrlButton label={muted ? t("unmute") : t("mute")} pressed={muted} onClick={() => setMuted((m) => !m)}>
          {muted ? <VolumeX /> : <Volume2 />}
        </CtrlButton>
        <CtrlButton label={full ? t("exitFullscreen") : t("fullscreen")} onClick={toggleFull}>
          {full ? <Minimize /> : <Maximize />}
        </CtrlButton>
      </div>

      {!full ? (
        <div className="rounded-card border border-line">
          <button
            type="button"
            onClick={() => setTranscript((v) => !v)}
            aria-expanded={transcript}
            className="flex w-full items-center justify-between gap-3 rounded-card px-4 py-2.5 text-left text-sm font-medium outline-none hover:bg-panel-2/50 focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {t("transcript")}
            <ChevronDown className={cn("size-4 text-ink-faint transition-transform", transcript && "rotate-180")} aria-hidden />
          </button>
          {transcript ? (
            <ol className="flex max-h-80 flex-col gap-3 overflow-y-auto px-4 pb-4">
              {slides.map((s, i) => (
                <li key={i} className={cn("rounded-lg p-2.5 text-sm", i === idx && "bg-brand-soft/50")}>
                  <button type="button" onClick={() => goTo(i)} className="mb-1 font-semibold text-brand-ink hover:underline">
                    {i + 1}. {s.title}
                  </button>
                  <p className="leading-relaxed text-ink-muted">{s.narration}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CtrlButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button size="icon-sm" variant="ghost" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={pressed} title={label}>
      {children}
    </Button>
  );
}

/**
 * A short check inside the video, as a popup over the slide. A right answer
 * moves on; a wrong one gets a hint, not the answer, and the learner decides
 * whether to try again or carry on.
 */
function QuizOverlay({ questions, onDone, doneLabel }: { questions: VideoQuiz[]; onDone: () => void; doneLabel: string }) {
  const t = useTranslations("video");
  const [qi, setQi] = React.useState(0);
  const [choice, setChoice] = React.useState<number | null>(null);
  const q = questions[qi]!;
  const right = choice === q.correct;
  const lastQ = qi === questions.length - 1;
  const move = () => {
    if (lastQ) onDone();
    else {
      setQi(qi + 1);
      setChoice(null);
    }
  };

  return (
    <motion.div className="vl-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        key={qi}
        role="dialog"
        aria-label={t("quickCheck")}
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-[min(480px,100%)] rounded-card border border-line bg-panel p-5 text-left shadow-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold tracking-wide text-warn uppercase">
            {t("quickCheck")} · {t("nOfTotal", { n: qi + 1, total: questions.length })}
          </div>
          <button type="button" onClick={move} className="text-sm text-ink-muted hover:text-ink hover:underline">
            {t("skip")}
          </button>
        </div>
        <p className="mt-3 mb-3 leading-snug font-semibold">{q.q}</p>
        <div className="flex flex-col gap-2">
          {q.options.map((o, i) => (
            <button
              key={o}
              type="button"
              disabled={right}
              onClick={() => setChoice(i)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                choice === i
                  ? right
                    ? "border-ok-line bg-ok-soft text-ok"
                    : "border-warn-line bg-warn-soft"
                  : "border-line bg-panel-2/60 hover:border-brand-line",
                right && choice !== i && "opacity-60",
              )}
            >
              {o}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="mt-3 text-sm">
          {choice !== null && right ? (
            <p>
              <b className="text-ok">{t("right")} </b>
              {q.explain}
            </p>
          ) : null}
          {choice !== null && !right ? (
            <p>
              <b className="text-warn">{t("hint")} </b>
              {q.hint}
            </p>
          ) : null}
        </div>
        {choice !== null ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-faint">{right ? "" : t("tryOrCarryOn")}</span>
            <Button size="sm" variant={right ? "brand" : "outline"} className={cn(!right && "bg-transparent")} onClick={move}>
              {lastQ ? doneLabel : t("nextQuestion")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
