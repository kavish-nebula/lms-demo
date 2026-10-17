import type { ConversationVoice } from "./profile-conversation";

export type ProfileVoiceState = "idle" | "loading" | "playing" | "paused" | "blocked";

/** One audio element, unlocked by a learner gesture and reused for every line. */
export class ProfileVoice implements ConversationVoice {
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private finish: ((error?: Error) => void) | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private objectUrl: string | null = null;
  private muted = false;
  private state: ProfileVoiceState = "idle";
  constructor(private status: (state: ProfileVoiceState, browserVoice: boolean) => void) {}
  get enabled() { return !this.muted; }
  private update(state: ProfileVoiceState, browser = false) { this.state = state; this.status(state, browser); }
  unlock() {
    if (!this.audio) this.audio = new Audio();
    // Playing silence during the click authorizes later asynchronous cloud audio.
    this.audio.src = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==";
    void this.audio.play().catch(() => {});
  }
  setMuted(value: boolean) { this.muted = value; if (value) this.finish?.(); }
  pause() {
    if (this.state !== "playing") return;
    if (this.utterance) speechSynthesis.pause(); else this.audio?.pause();
    this.update("paused", !!this.utterance);
  }
  resume() {
    if (this.utterance) {
      if (this.state === "blocked") speechSynthesis.speak(this.utterance);
      else speechSynthesis.resume();
      this.update("playing", true);
    }
    else if (this.audio && this.finish) {
      const active = this.finish;
      void this.audio.play().then(
        () => { if (this.finish === active) this.update("playing"); },
        () => { if (this.finish === active) this.update("blocked"); },
      );
    }
  }
  cancel() { this.abort?.abort(); this.finish?.(new DOMException("Playback cancelled", "AbortError")); this.audio?.pause(); }
  async say(url: string | null, text: string): Promise<void> {
    this.cancel();
    if (this.muted || !text) return;
    const abort = new AbortController();
    this.abort = abort;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const audio = this.audio ??= new Audio();
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        audio.pause(); audio.onended = null; audio.onerror = null; audio.onplaying = null;
        if (this.utterance) { this.utterance.onstart = null; this.utterance.onend = null; this.utterance.onerror = null; speechSynthesis.cancel(); this.utterance = null; }
        if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
        abort.abort();
        this.finish = null;
        this.update("idle");
        if (error) reject(error); else resolve();
      };
      this.finish = finish;
      const browserFallback = () => {
        if (settled || this.utterance) return;
        if (!("speechSynthesis" in window)) { finish(new Error("Voice is unavailable. Retry or choose Read instead.")); return; }
        audio.pause(); audio.onerror = null; audio.onended = null; audio.onplaying = null;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = document.documentElement.lang || "en";
        utterance.rate = 0.95;
        utterance.onstart = () => this.update("playing", true);
        utterance.onend = () => finish();
        utterance.onerror = (event) => {
          if (event.error === "not-allowed") this.update("blocked", true);
          else finish(new Error("Voice could not play. Retry or choose Read instead."));
        };
        this.utterance = utterance;
        this.update("loading", true);
        try { speechSynthesis.speak(utterance); }
        catch { finish(new Error("Voice could not start. Retry or choose Read instead.")); }
      };
      this.update("loading");
      void (async () => {
        try {
          if (!url) { browserFallback(); return; }
          const response = await fetch(url, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100_000)]) });
          if (!response.ok) throw new Error("Cloud voice unavailable");
          const blob = await response.blob();
          if (settled) return;
          this.objectUrl = URL.createObjectURL(blob);
          audio.src = this.objectUrl;
          audio.onended = () => finish();
          audio.onerror = browserFallback;
          audio.onplaying = () => this.update("playing");
          try { await audio.play(); }
          catch (error) {
            if (settled) return;
            if (error instanceof DOMException && error.name === "NotAllowedError") this.update("blocked");
            else browserFallback();
          }
        } catch { if (!settled) browserFallback(); }
      })();
    });
  }
}
