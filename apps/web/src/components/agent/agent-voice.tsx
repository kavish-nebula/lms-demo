"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bot, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useLocalString, writeLocal } from "@/lib/local-store";
import { narrateText, prepareLine, stopNarration, useNarration, useNarrationOwner } from "@/lib/narrator";
import { FIXED_LINES } from "@/lib/guide-lines";

const MUTE_KEY = "knowlab.agent.voice";
const saidKey = (once: string) => `knowlab.agent.said.${once}`;

type SayOptions = {
  /** say it only the first time (remembered in this browser) */
  once?: string;
  /** wait for the current line to finish instead of interrupting it */
  queue?: boolean;
  /** show the words without speaking (e.g. over a video with its own sound) */
  silent?: boolean;
};
type Ctx = { say: (text: string, opts?: SayOptions) => void; stop: () => void };
const VoiceContext = React.createContext<Ctx | null>(null);
/** What the companion is saying now, for a screen that shows it itself (the agent card), and a way to say "I'm showing it". */
type State = { line: string | null; speaking: boolean; host: () => () => void };
const StateContext = React.createContext<State | null>(null);
// the fixed lines are recorded ahead once per visit (instant after the first time ever)
let warmed = false;

const alreadySaid = (once: string) => {
  try {
    return localStorage.getItem(saidKey(once)) === "1";
  } catch {
    return false;
  }
};

/**
 * The companion's voice: the learner's agent speaks along the journey (the
 * local Kokoro voice, made on the server) and its words show in a small
 * subtitle bar with replay and mute. It tells the learner where they are and
 * what comes next. Mounted once for all learning pages; screens call
 * useAgentVoice().say(...). The Mission's story narration plays through the
 * same voice, so the two never talk over each other.
 */
export function AgentVoiceProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("agent");
  const reduce = useReducedMotion();
  const muted = useLocalString(MUTE_KEY) === "off";
  const narration = useNarration();
  const owner = useNarrationOwner();
  const [line, setLine] = React.useState<string | null>(null);
  // screens showing the companion's words themselves (the agent card beside setup); while any is on screen, no subtitle bar
  const [hosts, setHosts] = React.useState(0);
  const host = React.useCallback(() => {
    setHosts((n) => n + 1);
    return () => setHosts((n) => n - 1);
  }, []);
  React.useEffect(() => {
    if (warmed) return;
    warmed = true;
    // one at a time, reactions first; each is made once on the server and then served from disk
    void (async () => {
      for (const text of FIXED_LINES) await prepareLine(text);
    })();
  }, []);
  const queue = React.useRef<{ text: string; silent: boolean }[]>([]);
  const busy = React.useRef(false);
  const hide = React.useRef<number | undefined>(undefined);
  const mutedRef = React.useRef(muted);
  React.useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playNext = React.useCallback(function next() {
    const item = queue.current.shift();
    window.clearTimeout(hide.current);
    if (!item) {
      busy.current = false;
      hide.current = window.setTimeout(() => setLine(null), 2500);
      return;
    }
    busy.current = true;
    setLine(item.text);
    // the words stay up at least as long as they take to read, even when sound is off or blocked
    const reading = Math.min(9000, 1500 + item.text.split(/\s+/).length * 330);
    if (item.silent || mutedRef.current) {
      hide.current = window.setTimeout(next, reading);
      return;
    }
    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    // a line is never cut short: the next one starts when it has been said (or, unspoken, read)
    void Promise.all([narrateText(item.text), wait(reading)]).then(next);
  }, []);

  const say = React.useCallback(
    (text: string, opts: SayOptions = {}) => {
      if (!text.trim()) return;
      if (opts.once) {
        if (alreadySaid(opts.once)) return;
        writeLocal(saidKey(opts.once), "1");
      }
      const item = { text, silent: !!opts.silent };
      if (opts.queue && busy.current) queue.current.push(item);
      else {
        queue.current = [item];
        playNext();
      }
    },
    [playNext],
  );

  const stop = React.useCallback(() => {
    queue.current = [];
    busy.current = false;
    stopNarration();
    setLine(null);
  }, []);

  const value = React.useMemo(() => ({ say, stop }), [say, stop]);
  const speaking = owner === "companion" && narration === "playing";
  const state = React.useMemo(() => ({ line: owner === "story" ? null : line, speaking, host }), [line, owner, speaking, host]);
  // the story's narration took over, or a screen shows the words itself: no bar
  const visible = !!line && owner !== "story" && hosts === 0;

  return (
    <VoiceContext.Provider value={value}>
     <StateContext.Provider value={state}>
      {children}
      <AnimatePresence>
        {visible ? (
          <motion.div
            key="agent-voice"
            role="status"
            aria-live="polite"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-4 left-4 right-24 z-[60] flex max-w-md items-start gap-3 rounded-card border border-brand-line bg-panel/95 p-3 shadow-2xl backdrop-blur sm:right-auto"
          >
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand" aria-hidden>
              <Bot className="size-4" />
              {speaking && !reduce ? (
                <span className="absolute -right-1 -bottom-1 flex h-3 items-end gap-[2px] rounded-full bg-panel px-1 py-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-[2px] rounded-full bg-brand"
                      animate={{ height: ["30%", "100%", "40%"] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
              ) : null}
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug">
              <span className="sr-only">{t("label")}: </span>
              {line}
            </p>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => line && say(line)}
                aria-label={t("sayAgain")}
                title={t("sayAgain")}
                className="rounded-full p-1.5 text-ink-muted hover:bg-panel-2 hover:text-ink"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!muted) stopNarration();
                  writeLocal(MUTE_KEY, muted ? null : "off");
                }}
                aria-pressed={!muted}
                aria-label={muted ? t("voiceOff") : t("voiceOn")}
                title={muted ? t("voiceOff") : t("voiceOn")}
                className={cn("rounded-full p-1.5 hover:bg-panel-2 hover:text-ink", muted ? "text-ink-faint" : "text-ink-muted")}
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <button type="button" onClick={stop} aria-label={t("hush")} title={t("hush")} className="rounded-full p-1.5 text-ink-muted hover:bg-panel-2 hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
     </StateContext.Provider>
    </VoiceContext.Provider>
  );
}

/** What the companion is saying now (null when quiet), for a screen that shows it itself; hosting hides the subtitle bar. */
export function useAgentVoiceState(): State {
  return React.useContext(StateContext) ?? QUIET;
}
const QUIET: State = { line: null, speaking: false, host: () => () => undefined };

/** The companion's voice, for screens: say(text, { once, queue, silent }). Does nothing outside the provider. */
export function useAgentVoice(): Ctx {
  return React.useContext(VoiceContext) ?? NOOP;
}
const NOOP: Ctx = { say: () => undefined, stop: () => undefined };
