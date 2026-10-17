import * as React from "react";
import { pauseSpeaking, resumeSpeaking, speak, stopSpeaking } from "@/lib/speech";

/**
 * One voice for the whole app: the Mission's story narration and the
 * companion (the learner's agent) both play through here, so they never talk
 * over each other: starting a line stops the one before. Lines are recorded
 * audio (Kokoro, made on the server) or, when a line can't be made, read by
 * the browser's own voice. Play and pause work the same either way.
 */
export type NarrationState = "idle" | "loading" | "playing" | "paused";
/** who is speaking: the story (Mission narration) or the companion */
export type NarrationOwner = "story" | "companion";

let audio: HTMLAudioElement | null = null;
let state: NarrationState = "idle";
let owner: NarrationOwner | null = null;
/** which line is current: answers from an older line are ignored */
let token = 0;
let browserVoice = false;
/** resolves the current line's promise (when it ends, fails or is replaced) */
let settle: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: NarrationState) {
  if (state === next) return;
  state = next;
  if (next === "idle") owner = null;
  for (const l of listeners) l();
}

function finishLine() {
  const s = settle;
  settle = null;
  s?.();
}

function player(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = "auto";
  a.addEventListener("playing", () => set("playing"));
  a.addEventListener("waiting", () => set("loading"));
  a.addEventListener("pause", () => set(a.ended || !a.src ? "idle" : "paused"));
  a.addEventListener("ended", () => {
    set("idle");
    finishLine();
  });
  audio = a;
  return a;
}

/** The line could not be played as audio: the story is read by the browser's voice; the companion's words just show. */
function fallBack(my: number, text: string) {
  if (my !== token) return;
  set("idle");
  if (owner === "companion") return finishLine();
  browserVoice = true;
  void speak(text).then(() => my === token && finishLine());
}

/** Starts a new line: stops whatever was playing and settles its promise. */
function begin(who: NarrationOwner): { my: number; done: Promise<void> } {
  const my = ++token;
  finishLine();
  stopSpeaking();
  browserVoice = false;
  audio?.pause();
  owner = who;
  const done = new Promise<void>((resolve) => (settle = resolve));
  return { my, done };
}

function play(my: number, url: string, text: string) {
  const a = player();
  a.onerror = () => fallBack(my, text);
  a.src = url;
  set("loading");
  a.play().catch((e: unknown) => {
    // a newer line replaced this one: nothing to do
    if (e instanceof DOMException && e.name === "AbortError") return;
    fallBack(my, text);
  });
}

/** Plays one line: the audio at `url`, or `text` with the browser's voice when there is no url or it fails. Resolves when it ends. */
export function narrate(url: string | null, text: string, who: NarrationOwner = "story"): Promise<void> {
  const { my, done } = begin(who);
  if (!url) fallBack(my, text);
  else play(my, url, text);
  return done;
}

// recordings already fetched for the companion, by text (each line is made once on the server too)
const recorded = new Map<string, Promise<string | null>>();
function recording(text: string, ahead = false): Promise<string | null> {
  let p = recorded.get(text);
  if (!p) {
    p = fetch("/api/v1/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, ahead }) })
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null);
    void p.then((url) => {
      if (!url) recorded.delete(text); // try again next time
    });
    recorded.set(text, p);
  }
  return p;
}

/** Records a companion line ahead of time (behind anything a learner is waiting for), so it plays at once when needed. */
export const prepareLine = (text: string): Promise<unknown> => recording(text, true);

/**
 * The companion says one line (recorded on the server by Kokoro). If the
 * recording isn't ready within `maxWait`, the line is not spoken at all (its
 * words still show), rather than starting late over whatever comes next.
 * Resolves when it ends, is skipped or is replaced.
 */
export function narrateText(text: string, who: NarrationOwner = "companion", maxWait = 6000): Promise<void> {
  const { my, done } = begin(who);
  set("loading");
  const late = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), maxWait));
  void Promise.race([recording(text), late]).then((url) => {
    if (my !== token) return;
    if (url) play(my, url, text);
    else fallBack(my, text);
  });
  return done;
}

export function stopNarration() {
  token++;
  finishLine();
  stopSpeaking();
  if (audio) {
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  set("idle");
}

export function pauseNarration() {
  if (browserVoice) pauseSpeaking();
  else audio?.pause();
}

export function resumeNarration() {
  if (browserVoice) resumeSpeaking();
  else void audio?.play().catch(() => undefined);
}

/* the browser's speech has no change events, so its state is polled while someone listens */
const browserState = (): NarrationState => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return "idle";
  const s = window.speechSynthesis;
  return s.paused && (s.speaking || s.pending) ? "paused" : s.speaking || s.pending ? "playing" : "idle";
};
const snapshot = () => (browserVoice ? browserState() : state);
const subscribe = (notify: () => void) => {
  listeners.add(notify);
  const id = window.setInterval(notify, 250);
  return () => {
    listeners.delete(notify);
    window.clearInterval(id);
  };
};

/** The narration's state, for play/pause buttons. */
export const useNarration = () => React.useSyncExternalStore(subscribe, snapshot, () => "idle" as NarrationState);
/** Who is speaking now (null when nobody is). */
export const useNarrationOwner = () => React.useSyncExternalStore(subscribe, () => (snapshot() === "idle" ? null : owner), () => null);
