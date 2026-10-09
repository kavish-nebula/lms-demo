"use client";

import * as React from "react";

export type Voice = {
  /** how far through the line being spoken, 0 to 1; null when nothing is being spoken */
  progress: number | null;
  /** the browser refused to play sound (no click it trusts yet): offer the learner a tap to hear it */
  blocked: boolean;
  /**
   * Speak one line (its own clip); any line still playing stops. Resolves true
   * when the clip played to the end, false when it was cut off, could not play,
   * or sound is off, so a caller never waits on audio that isn't coming.
   */
  say: (src: string) => Promise<boolean>;
  stop: () => void;
  /**
   * Call from a click. Browsers only let audio start from a click (Safari and
   * Firefox strictly so), and the lines are spoken a moment later, after the
   * scene has drawn; playing a sliver of silence inside the click lets them.
   */
  unlock: () => void;
  /** from a click, after `blocked`: speak the line that was refused */
  retry: () => void;
};

/** A few milliseconds of silence as a WAV file, for `unlock`. */
function silence() {
  const bytes = new Uint8Array(48);
  const v = new DataView(bytes.buffer);
  const tag = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 40, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true); // format chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, 8000, true); // sample rate
  v.setUint32(28, 16000, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  tag(36, "data");
  v.setUint32(40, 4, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

/** The narrator of the hook: one line at a time, with how far it has got for the caption. */
export function useVoice(on: boolean): Voice {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const settle = React.useRef<((heard: boolean) => void) | null>(null);
  const last = React.useRef<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [blocked, setBlocked] = React.useState(false);

  React.useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audio.current = a;
    let raf = 0;
    const tick = () => {
      if (a.duration > 0) setProgress(Math.min(1, a.currentTime / a.duration));
      raf = requestAnimationFrame(tick);
    };
    const playing = () => {
      setBlocked(false);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const end = (heard: boolean) => () => {
      cancelAnimationFrame(raf);
      setProgress(null);
      settle.current?.(heard);
      settle.current = null;
    };
    const ended = end(true);
    const failed = end(false);
    a.addEventListener("playing", playing);
    a.addEventListener("ended", ended);
    a.addEventListener("error", failed);
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      a.removeEventListener("playing", playing);
      a.removeEventListener("ended", ended);
      a.removeEventListener("error", failed);
      settle.current?.(false);
      settle.current = null;
      audio.current = null;
    };
  }, []);

  const stop = React.useCallback(() => {
    audio.current?.pause();
    setProgress(null);
    settle.current?.(false);
    settle.current = null;
  }, []);

  // read through a ref so `say` never changes: switching sound on must not replay the line
  const enabled = React.useRef(on);
  React.useEffect(() => {
    enabled.current = on;
    if (!on) {
      stop(); // switched off mid-line
      setBlocked(false);
    }
  }, [on, stop]);

  const say = React.useCallback(
    (src: string) => {
      stop();
      last.current = src;
      const a = audio.current;
      if (!a || !enabled.current) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        settle.current = resolve;
        setProgress(0);
        a.src = src;
        a.play().catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") setBlocked(true);
          if (settle.current !== resolve) return;
          setProgress(null);
          settle.current = null;
          resolve(false);
        });
      });
    },
    [stop],
  );

  const unlock = React.useCallback(() => {
    const a = audio.current;
    if (!a || !enabled.current) return;
    a.src = silence();
    a.play().catch(() => {});
  }, []);

  const retry = React.useCallback(() => {
    setBlocked(false);
    if (last.current) void say(last.current);
  }, [say]);

  return React.useMemo(() => ({ progress, blocked, say, stop, unlock, retry }), [progress, blocked, say, stop, unlock, retry]);
}
