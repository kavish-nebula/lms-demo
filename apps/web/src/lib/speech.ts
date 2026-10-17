import * as React from "react";

/* Browser speech recognition is not in the DOM typings; this is the slice we use. */
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export type RecognitionCtor = new () => Recognition;

/** The browser's speech recognition, if it has one (Chrome and Edge do; Firefox doesn't). */
export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => undefined;
/** Whether the browser can listen, without a hydration mismatch (false on the server). */
export const useCanListen = () => React.useSyncExternalStore(noSubscribe, () => !!recognitionCtor(), () => false);

/** Seconds since a timestamp (kept outside components: reading the clock is an event-time job). */
export const secondsSince = (t: number) => Math.round((Date.now() - t) / 1000);
export const msSince = (t: number) => Date.now() - t;

/*
 * Chrome's speech has three known faults this works around: speaking right
 * after cancel() is often dropped silently, utterances nobody holds on to
 * can be garbage-collected mid-sentence, and anything longer than about 15
 * seconds is cut off. So: a short pause after cancel(), the queue is kept
 * here, and text is spoken one sentence at a time.
 */
let queue: SpeechSynthesisUtterance[] = [];
let pending: number | undefined;

/**
 * A reliable English voice: Edge's "Natural" voices first, then voices
 * installed on the computer. Chrome's online Google voices come last: they
 * often stop working for the rest of the page once speech is interrupted.
 */
function bestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  return (
    voices.find((v) => /natural/i.test(v.name)) ??
    voices.find((v) => v.localService && v.lang === "en-US") ??
    voices.find((v) => v.localService) ??
    voices[0] ??
    null
  );
}

// resolves the promise of the line being read (when it ends or is replaced)
let finished: (() => void) | null = null;

/** Reads text aloud with the browser's own voice; cancels whatever was playing. Resolves when it has been read (or replaced). */
export function speak(text: string): Promise<void> {
  finished?.();
  finished = null;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  const synth = window.speechSynthesis;
  window.clearTimeout(pending);
  synth.cancel();
  queue = [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return Promise.resolve();
  const done = new Promise<void>((resolve) => (finished = resolve));
  // titles like "Dr." and "St." don't end a sentence
  const guarded = clean.replace(/\b(Dr|St|Mr|Mrs|Ms|Prof|Mt|No|vs|e\.g|i\.e)\.\s/g, "$1․ ");
  const sentences = guarded.match(/[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$/g)?.map((s) => s.trim().replace(/․/g, ".")).filter(Boolean) ?? [clean];
  const play = (retry: boolean) => {
    const voice = bestVoice();
    let started = false;
    queue = sentences.map((s) => {
      const u = new SpeechSynthesisUtterance(s);
      if (voice) u.voice = voice;
      u.onstart = () => (started = true);
      return u;
    });
    const last = queue.at(-1);
    const end = () => {
      finished?.();
      finished = null;
    };
    if (last) {
      last.onend = end;
      last.onerror = end; // e.g. blocked before the learner has clicked on the page
    }
    for (const u of queue) synth.speak(u);
    synth.resume(); // Chrome sometimes leaves the queue paused
    // if nothing has started after two seconds, the engine is stuck: reset it and try once more
    if (retry)
      pending = window.setTimeout(() => {
        if (started) return;
        synth.cancel();
        pending = window.setTimeout(() => play(false), 150);
      }, 2000);
  };
  pending = window.setTimeout(() => play(true), 120);
  return done;
}
export const stopSpeaking = () => speak("");

const synthOk = () => typeof window !== "undefined" && "speechSynthesis" in window;
export const pauseSpeaking = () => synthOk() && window.speechSynthesis.pause();
export const resumeSpeaking = () => synthOk() && window.speechSynthesis.resume();

/** "speaking", "paused" or "idle", polled while a component listens (the speech API has no change event). */
export type SpeakingState = "speaking" | "paused" | "idle";
const speakingState = (): SpeakingState => {
  if (!synthOk()) return "idle";
  const s = window.speechSynthesis;
  return s.paused && (s.speaking || s.pending) ? "paused" : s.speaking || s.pending ? "speaking" : "idle";
};
const subscribeSpeaking = (notify: () => void) => {
  const id = window.setInterval(notify, 250);
  return () => window.clearInterval(id);
};
export const useSpeaking = () => React.useSyncExternalStore(subscribeSpeaking, speakingState, () => "idle" as SpeakingState);
