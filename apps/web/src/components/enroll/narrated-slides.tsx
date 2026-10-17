"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpen, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adaptiveMediaUrl } from "@/lib/adaptive-onboarding-client";
import type { AdaptiveSession } from "@/lib/adaptive-onboarding";

/** Structured model content is rendered as accessible HTML, with one audio track per slide. */
export function NarratedSlides({ session, onDone }: { session: AdaptiveSession; onDone: () => void }) {
  const [index, setIndex] = React.useState(0);
  const [autoplay, setAutoplay] = React.useState(false);
  const [continuous, setContinuous] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [buffering, setBuffering] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const audio = React.useRef<HTMLAudioElement>(null);
  const reduced = useReducedMotion();
  const slide = session.slides[index]!;
  React.useEffect(() => {
    const element = audio.current;
    return () => { element?.pause(); };
  }, [index]);
  function change(next: number, play = false) {
    audio.current?.pause();
    setIndex(next); setAutoplay(play); setElapsed(0); setDuration(0); setPlaying(false); setBuffering(false); setFailed(false);
  }
  const ratio = duration > 0 && Number.isFinite(duration) ? elapsed / duration : 0;
  return <section className="mx-auto max-w-4xl space-y-5" aria-label="Narrated prerequisite slides">
    <header><p className="flex items-center gap-2 text-sm text-brand-ink"><BookOpen className="size-4" />Your starting point</p><h1 className="mt-2 text-2xl font-semibold">{session.title}</h1></header>
    <div className="overflow-hidden rounded-card border border-line bg-panel shadow-lg">
      <div className="flex items-center justify-between border-b border-line px-6 py-3 text-xs text-ink-muted"><span>Nebula KnowLab</span><span aria-live="polite">Slide {index + 1} of {session.slides.length}</span></div>
      <article key={index} className="flex min-h-80 flex-col justify-center p-6 md:min-h-96 md:p-10" aria-labelledby="prerequisite-slide-title">
        <h2 id="prerequisite-slide-title" className="max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">{slide.title}</h2>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">{slide.caption}</p>
        <ol aria-label={slide.animation === "compare" ? "Compare these ideas" : "Slide diagram"} className={`mt-8 grid gap-3 ${slide.animation === "compare" ? "sm:grid-cols-2" : slide.animation === "sequence" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
          {slide.steps.map((step, i) => <motion.li key={step} initial={false}
            animate={{ opacity: reduced || !playing || !Number.isFinite(duration) || duration <= 0 || ratio >= i / (slide.steps.length + 1) ? 1 : 0.45 }}
            className="adaptive-preview-step flex min-h-24 items-center gap-3 rounded-xl border border-line bg-panel-2 p-4">
            {slide.animation === "sequence" ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-brand-ink">{i + 1}</span> : <GitBranch className="size-5 shrink-0 text-brand-ink" aria-hidden />}
            <span className="text-sm font-medium">{step}</span>
          </motion.li>)}
        </ol>
      </article>
      <div className="space-y-4 border-t border-line p-4">
        <audio key={index} ref={audio} controls autoPlay={autoplay} preload="none" className="w-full" aria-label={`Narration: ${slide.title}`} src={adaptiveMediaUrl(session.id, "audio", index)}
          onPlay={(event) => { setPlaying(true); setBuffering(event.currentTarget.readyState < 3); }} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onEnded={() => { setPlaying(false); if (continuous && index + 1 < session.slides.length) change(index + 1, true); }} onError={() => { setFailed(true); setBuffering(false); }} />
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={continuous} onChange={(event) => setContinuous(event.target.checked)} />Play slides in order</label><span className="text-xs text-ink-muted" role="status">{buffering ? "Preparing narration…" : playing ? "Pip is speaking." : "Press play to hear Pip."}</span></div>
        {failed ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>Narration couldn’t load. You can read the transcript below.</p><Button variant="outline" size="sm" onClick={() => { setFailed(false); audio.current?.load(); }}>Retry audio</Button></div> : null}
      </div>
    </div>
    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={index === 0} onClick={() => change(index - 1)}>Previous slide</Button><Button onClick={() => index + 1 < session.slides.length ? change(index + 1) : onDone()}>{index + 1 < session.slides.length ? "Next slide" : "Enter my activity"}<ArrowRight /></Button></div>
    <details className="rounded-card border border-line px-4 py-3 text-sm"><summary className="cursor-pointer text-ink-muted">Read the narration</summary><p className="mt-3 leading-relaxed">{slide.narration}</p></details>
    <Button variant="ghost" size="sm" onClick={() => { audio.current?.pause(); onDone(); }}>Go to my activity<ArrowRight /></Button>
  </section>;
}
