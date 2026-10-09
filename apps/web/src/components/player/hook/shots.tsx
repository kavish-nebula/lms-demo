"use client";

import * as React from "react";
import { motion, useAnimationControls } from "motion/react";
import {
  AlertTriangle,
  BatteryFull,
  Bot,
  CalendarDays,
  Check,
  FileText,
  Home,
  Inbox,
  Lock,
  Search,
  SendHorizontal,
  Signal,
  Truck,
  Warehouse,
  Wifi,
  X,
} from "lucide-react";
import { NumberTicker } from "@/components/kit/number-ticker";
import type { FilmShot, HookBlock } from "@/data/types";
import type { Sfx } from "./sfx";

/** What every scene gets: its script, the time into it, the hook it belongs to, and whether it is waiting for the learner. */
export type ShotProps<T extends FilmShot["type"]> = {
  shot: Extract<FilmShot, { type: T }>;
  /** milliseconds into the scene; the clock stands still while the scene waits for the learner */
  t: number;
  block: HookBlock;
  /** reduced motion: nothing slides or pops in (the clock also jumps instead of running) */
  reduce: boolean;
  sfx: Sfx;
  /** the scene is stopped at a point where the learner has to act */
  waiting: boolean;
  /** for a scene the learner acts on inside the picture: they did it */
  onAct: () => void;
};

/**
 * A scene's timeline, in milliseconds: how long it runs (`len`), where it stops
 * until the learner taps (`gates`), and a stretch that only runs while the
 * learner holds the button down (`hold`). `inScene`: the learner acts inside
 * the picture rather than on the button over it.
 */
export type Track = { len: number; gates: number[]; hold?: [number, number]; inScene?: boolean };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn = (x: number) => x * x * x;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** progress through [from, to] */
const span = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
const pop = { initial: { opacity: 0, y: 10, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.3 } };
const TONES = ["", "warm", "teal", "gold"];

/** Play a sound whenever a count goes up. */
function useOnIncrease(value: number, play: () => void) {
  const prev = React.useRef(value);
  React.useEffect(() => {
    if (value > prev.current) play();
    prev.current = value;
  }, [value, play]);
}

/** "400 tickets" -> 400 rolls in, " tickets" follows; a part without a number is shown as it is. */
export type Stake = { text: string } | { before: string; prefix: string; value: number; after: string };
export function parseStake(text: string): Stake {
  const m = text.match(/^(.*?)(\$?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return { text };
  return { before: m[1] ?? "", prefix: m[2] ?? "", value: Number((m[3] ?? "0").replace(/,/g, "")), after: m[4] ?? "" };
}
const stakesOf = (block: HookBlock) => block.stat.split("·").map((s) => parseStake(s.trim()));

/** Text with one phrase marked, cut off after `shown` characters (for typing). */
function Marked({ text, mark, shown, className }: { text: string; mark: string; shown: number; className: string }) {
  const i = text.indexOf(mark);
  const visible = text.slice(0, shown);
  if (i < 0 || shown <= i) return <>{visible}</>;
  const end = i + mark.length;
  return (
    <>
      {text.slice(0, i)}
      <span className={shown >= end ? className : undefined}>{text.slice(i, Math.min(shown, end))}</span>
      {shown > end ? text.slice(end, shown) : null}
    </>
  );
}

function Lights() {
  return (
    <span className="hf-lights" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function Typing() {
  return (
    <span className="hf-typing" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/* ------------------------------------------------------------------ site-chat */

// the learner sends three messages; each reply lands a beat later; then the weekend runs on without them
const CHAT_GATES = [700, 3000, 5300];
const CHAT_REPLY = 1500;
const CHAT_RUN: [number, number] = [7400, 11600];

/** A tent in the mountains at dusk: the product photo on Orbit's shop page. */
function TentArt() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="hf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2463" />
          <stop offset="0.6" stopColor="#b4533f" />
          <stop offset="1" stopColor="#e3a14f" />
        </linearGradient>
        <linearGradient id="hf-tent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fc49a" />
          <stop offset="1" stopColor="#2a8f85" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#hf-sky)" />
      <circle cx="300" cy="96" r="26" fill="#ffd9a0" opacity="0.85" />
      <path d="M0 170 L80 90 L140 150 L210 70 L290 160 L350 110 L400 150 L400 260 L0 260 Z" fill="#1d1834" />
      <path d="M0 205 L120 150 L230 200 L330 160 L400 190 L400 260 L0 260 Z" fill="#110f1e" />
      <path d="M140 225 L205 135 L270 225 Z" fill="url(#hf-tent)" />
      <path d="M205 135 L190 225 L220 225 Z" fill="#0b2a26" />
      <path d="M120 226 L290 226" stroke="#0b0a12" strokeWidth="3" />
    </svg>
  );
}

export function SiteChatShot({ shot, t, reduce, sfx, waiting }: ShotProps<"site-chat">) {
  const sent = CHAT_GATES.filter((g) => t > g).length;
  const replies = CHAT_GATES.filter((g) => t >= g + CHAT_REPLY).length;
  const run = span(t, ...CHAT_RUN);
  const n = t < CHAT_RUN[0] ? sent : Math.max(sent, Math.round(sent + easeIn(run) * (shot.count - sent)));
  useOnIncrease(sent, sfx.pop);
  useOnIncrease(replies, sfx.alarm);
  useOnIncrease(n > sent ? n : 0, sfx.tick);
  const tail = Array.from({ length: Math.min(n, 3) }, (_, k) => n - Math.min(n, 3) + k);
  const next = shot.asks[sent];

  return (
    <>
      <div className="hf-win hf-browser">
        <div className="hf-winbar">
          <Lights />
          <span className="hf-url">
            <Lock aria-hidden />
            {shot.url}
          </span>
        </div>
        <div className="hf-site">
          <div className="hf-site-art">
            <TentArt />
            <div className="hf-site-info">
              <b>{shot.product}</b>
              <span>Add to cart</span>
            </div>
          </div>
          <div className="hf-widget">
            <div className="hf-widget-head">
              <Bot aria-hidden />
              Orbit help
            </div>
            <div className="hf-widget-body">
              {n === 0 ? <div className="hf-bubble bot">Hi! I&apos;m Orbit&apos;s assistant. How can I help?</div> : null}
              {tail.map((i) => {
                const replied = i >= CHAT_GATES.length || t >= CHAT_GATES[i]! + CHAT_REPLY;
                return (
                  <React.Fragment key={i}>
                    <motion.div className="hf-bubble me" {...(reduce ? {} : pop)}>
                      {shot.asks[i % shot.asks.length]}
                    </motion.div>
                    {replied ? (
                      <motion.div className={i > 0 ? "hf-bubble bot bad" : "hf-bubble bot"} {...(reduce ? {} : pop)}>
                        {shot.reply}
                      </motion.div>
                    ) : (
                      <Typing />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="hf-compose" data-ready={waiting}>
              <span>{waiting && next ? next : "Type a message…"}</span>
              <SendHorizontal aria-hidden />
            </div>
          </div>
        </div>
      </div>
      {n > sent ? (
        <motion.div className="hf-counter" initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
          <b>{n.toLocaleString("en-US")}</b>
          <span>{shot.countLabel}</span>
        </motion.div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ tickets */

const TICKET_GATE = 600;
const TICKET_RUN: [number, number] = [700, 5600];
const NAMES = ["AR", "TK", "JM", "SL", "PD", "RN", "OB", "EK", "MW", "CH", "LF", "DV"];
const DAYS = ["Sat", "Sun"];

export function TicketsShot({ shot, t, reduce, sfx }: ShotProps<"tickets">) {
  const opened = t > TICKET_GATE;
  const n = Math.round(easeOut(span(t, ...TICKET_RUN)) * shot.count);
  useOnIncrease(n, sfx.tick);
  const rows = Array.from({ length: Math.min(n, 8) }, (_, k) => n - k);

  return (
    <div className="hf-win hf-app">
      <aside className="hf-app-side">
        <div className="hf-app-logo">Orbit Helpdesk</div>
        <div className="hf-folder on">
          <span>Inbox</span>
          {opened ? <b>{n}</b> : null}
        </div>
        <div className="hf-folder">
          <span>Waiting</span>
        </div>
        <div className="hf-folder">
          <span>Solved</span>
          <span>0</span>
        </div>
      </aside>
      <div className="hf-app-main">
        <div className="hf-app-head">
          Open tickets
          {opened ? (
            <span>
              <Search aria-hidden className="mr-1 inline size-[1.1cqw]" />
              {n} need a reply
            </span>
          ) : null}
        </div>
        {opened ? (
          <div className="hf-rows">
            {rows.map((num) => (
              <motion.div key={num} className="hf-ticket" initial={reduce ? false : { opacity: 0, y: -18, backgroundColor: "rgba(125,108,255,0.22)" }} animate={{ opacity: 1, y: 0, backgroundColor: "rgba(125,108,255,0)" }} transition={{ duration: 0.45 }}>
                <span className={`hf-av ${TONES[num % 4]}`}>{NAMES[num % NAMES.length]}</span>
                <span className="s">{shot.subjects[num % shot.subjects.length]}</span>
                <span className="tag">{shot.tag}</span>
                <span className="time">
                  {DAYS[num % 2]} {1 + (num * 7) % 11}:{String((num * 13) % 60).padStart(2, "0")} PM
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="hf-empty">
            <Inbox aria-hidden />
            <b>The weekend queue</b>
            <span>Not opened since Friday</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ phone */

const noteAt = (k: number) => 500 + k * 1900;

export function PhoneShot({ shot, t, reduce, sfx }: ShotProps<"phone">) {
  const shown = shot.notes.filter((_, k) => t >= noteAt(k)).length;
  const controls = useAnimationControls();
  useOnIncrease(shown, sfx.ping);
  React.useEffect(() => {
    if (shown > 0 && !reduce) void controls.start({ x: [0, -5, 5, -4, 4, 0], transition: { duration: 0.45 } });
  }, [shown, reduce, controls]);
  const people = [...new Set(shot.notes.map((m) => m.who))];

  return (
    <div className="hf-desk">
      <motion.div className="hf-phone" animate={controls}>
        <div className="hf-phone-screen">
          <span className="hf-notch" aria-hidden />
          <div className="flex w-full items-center justify-between px-[1cqw] text-[max(8px,0.9cqw)] text-[#c9c4e0]">
            <span>{shot.time}</span>
            <span className="flex items-center gap-[0.4cqw]">
              <Signal className="size-[1.1cqw]" aria-hidden />
              <Wifi className="size-[1.1cqw]" aria-hidden />
              <BatteryFull className="size-[1.2cqw]" aria-hidden />
            </span>
          </div>
          <div className="hf-phone-time">{shot.time}</div>
          <div className="hf-phone-day">#support · Orbit Outdoor</div>
          <div className="hf-notes" aria-hidden>
            {shot.notes
              .slice(0, shown)
              .reverse()
              .map((m) => (
                <motion.div key={`${m.who}-${m.at}`} className="hf-note" layout initial={reduce ? false : { opacity: 0, y: -16, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35 }}>
                  <b>{m.who.split(" ")[0]}</b> {m.text}
                </motion.div>
              ))}
          </div>
        </div>
      </motion.div>
      <div className="hf-cards">
        {shot.notes.slice(0, shown).map((m) => (
          <motion.div key={`${m.who}-${m.at}`} className="hf-card" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
            <div className="hf-card-head">
              <span className={`hf-av ${TONES[people.indexOf(m.who) % 4]}`}>{m.av}</span>
              <span>
                <b>{m.who}</b> · {m.at}
              </span>
            </div>
            <p>{m.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ email */

const MAIL_GATE = 900;
const MAIL_TYPE: [number, number] = [1500, 5100];

export function EmailShot({ shot, t, reduce, sfx }: ShotProps<"email">) {
  const drafting = t > MAIL_GATE;
  const typed = Math.floor(span(t, ...MAIL_TYPE) * shot.reply.length);
  const markEnd = shot.reply.indexOf(shot.highlight) + shot.highlight.length;
  useOnIncrease(Math.floor(typed / 4), sfx.tick);
  useOnIncrease(typed >= markEnd && markEnd > 0 ? 1 : 0, sfx.alarm);

  return (
    <div className="hf-win hf-mail">
      <div className="hf-mail-list">
        <div className="hf-winbar">
          <Inbox aria-hidden className="size-[1.3cqw]" />
          Support inbox
        </div>
        <div className="hf-mail-item on">
          <b>{shot.from}</b>
          {shot.subject}
        </div>
        <div className="hf-mail-item">
          <b>Tom Becker</b>
          Size exchange for jacket
        </div>
        <div className="hf-mail-item">
          <b>Priya Nair</b>
          Scout drafts are on
        </div>
        <div className="hf-mail-item">
          <b>ParcelPath</b>
          Daily delivery report
        </div>
      </div>
      <div className="hf-mail-read">
        <div className="hf-mail-from">
          <span className="hf-av warm">{shot.from.split(" ").map((w) => w[0]).join("")}</span>
          <span>
            <b>{shot.from}</b>
            <small>{shot.address}</small>
          </span>
        </div>
        <div className="hf-mail-subject">{shot.subject}</div>
        <span className="hf-chip">{shot.meta}</span>
        <p className="hf-mail-body">{shot.body}</p>
        {drafting ? (
          <motion.div className="hf-draft" initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="hf-draft-head">
              <span>
                <Bot aria-hidden />
                {shot.replyBy}
              </span>
              <span className="hf-send">Send</span>
            </div>
            <p>
              <Marked text={shot.reply} mark={shot.highlight} shown={typed} className="hf-bad" />
              {typed < shot.reply.length ? <span className="hf-caret" aria-hidden /> : null}
            </p>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ doc-vs-reply */

// the learner finds the mistake: they tap the part of the reply that breaks the policy
const DOC_GATE = 1300;

function MarkIn({ text, mark, on, tone }: { text: string; mark: string; on: boolean; tone: "good" | "bad" }) {
  const i = text.indexOf(mark);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className={`hf-mark ${tone}`} data-on={on}>
        {mark}
      </span>
      {text.slice(i + mark.length)}
    </>
  );
}

/** The reply as tappable pieces: each word, and the wrong phrase as one piece. */
function SpotTheMistake({ text, mark, onRight, onWrong, hint }: { text: string; mark: string; onRight: () => void; onWrong: () => void; hint: boolean }) {
  const [shaking, setShaking] = React.useState<number | null>(null);
  const i = text.indexOf(mark);
  const before = text.slice(0, i).split(" ").filter(Boolean);
  const after = text.slice(i + mark.length).split(" ").filter(Boolean);
  const wrong = (k: number) => {
    setShaking(k);
    window.setTimeout(() => setShaking((s) => (s === k ? null : s)), 450);
    onWrong();
  };
  // punctuation stuck to the phrase (", so") stays with the next word
  return (
    <>
      {before.map((w, k) => (
        <React.Fragment key={`b${k}`}>
          <button type="button" className="hf-tap" data-shake={shaking === k} onClick={() => wrong(k)}>
            {w}
          </button>{" "}
        </React.Fragment>
      ))}
      <button type="button" className={hint ? "hf-tap hint" : "hf-tap"} onClick={onRight}>
        {mark}
      </button>
      {after.map((w, k) => (
        <React.Fragment key={`a${k}`}>
          {k > 0 || !/^[,.;:!?]/.test(w) ? " " : null}
          <button type="button" className="hf-tap" data-shake={shaking === 100 + k} onClick={() => wrong(100 + k)}>
            {w}
          </button>
        </React.Fragment>
      ))}
    </>
  );
}

export function DocVsReplyShot({ shot, t, reduce, sfx, waiting, onAct }: ShotProps<"doc-vs-reply">) {
  const [misses, setMisses] = React.useState(0);
  const found = t > DOC_GATE;
  const at = (ms: number) => t >= ms;
  useOnIncrease(at(DOC_GATE + 900) ? 1 : 0, sfx.thud);
  return (
    <div className="hf-papers">
      <motion.div className="hf-paper" initial={reduce ? false : { opacity: 0, x: -30, rotate: -2 }} animate={{ opacity: 1, x: 0, rotate: -1 }} transition={{ duration: 0.5 }}>
        <div className="hf-paper-title">
          <FileText aria-hidden />
          {shot.doc.title}
        </div>
        <h4>{shot.doc.heading}</h4>
        <p>
          <MarkIn text={shot.doc.text} mark={shot.doc.highlight} on={at(700)} tone="good" />
        </p>
      </motion.div>
      <motion.div className="hf-neq" initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={found && at(DOC_GATE + 400) ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}>
        ≠
      </motion.div>
      <motion.div className="hf-paper dark" data-spot={waiting} initial={reduce ? false : { opacity: 0, x: 30, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 1 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <div className="hf-paper-title">
          <Bot aria-hidden />
          {shot.reply.title}
        </div>
        <p>
          {waiting ? (
            <SpotTheMistake
              text={shot.reply.text}
              mark={shot.reply.highlight}
              hint={misses >= 2}
              onRight={() => {
                sfx.pop();
                onAct();
              }}
              onWrong={() => {
                sfx.tick();
                setMisses((m) => m + 1);
              }}
            />
          ) : (
            <MarkIn text={shot.reply.text} mark={shot.reply.highlight} on={at(DOC_GATE + 100)} tone="bad" />
          )}
        </p>
        {at(DOC_GATE + 900) ? (
          <motion.div className="hf-stamp" initial={reduce ? false : { opacity: 0, scale: 2.4, rotate: -24 }} animate={{ opacity: 1, scale: 1, rotate: -10 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            {shot.stamp}
          </motion.div>
        ) : null}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ parcel-map */

// Scout's claim first; the truth only when the learner tracks the parcel
const MAP_CLAIM = 300;
const MAP_GATE = 1300;
const MAP_DRIVE: [number, number] = [1400, 4400];
const MAP_CAUGHT = 4700;

// the route: a cubic curve across an 800 x 400 map
const P0 = { x: 90, y: 300 };
const P1 = { x: 250, y: 60 };
const P2 = { x: 520, y: 400 };
const P3 = { x: 710, y: 110 };
function routeAt(u: number) {
  const a = 1 - u;
  return {
    x: a * a * a * P0.x + 3 * a * a * u * P1.x + 3 * a * u * u * P2.x + u * u * u * P3.x,
    y: a * a * a * P0.y + 3 * a * a * u * P1.y + 3 * a * u * u * P2.y + u * u * u * P3.y,
  };
}
const ROUTE = `M${P0.x} ${P0.y} C${P1.x} ${P1.y} ${P2.x} ${P2.y} ${P3.x} ${P3.y}`;
const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / 800) * 100}%`, top: `${(p.y / 400) * 100}%` });

export function ParcelMapShot({ shot, t, reduce, sfx }: ShotProps<"parcel-map">) {
  const u = shot.stop * easeOut(span(t, ...MAP_DRIVE));
  const claimed = t >= MAP_CLAIM + 300;
  const caught = t >= MAP_CAUGHT;
  useOnIncrease(claimed ? 1 : 0, sfx.pop);
  useOnIncrease(caught ? 1 : 0, sfx.alarm);
  const truck = routeAt(u);
  const hub = routeAt(shot.stop);

  return (
    <div className="hf-map">
      <svg viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="hf-streets" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0 L0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="800" height="400" fill="url(#hf-streets)" />
        <path d="M0 250 C200 230 300 330 520 300 S760 330 800 320" fill="none" stroke="rgba(127,182,209,0.18)" strokeWidth="18" />
        <path d={ROUTE} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round" />
        <path d={ROUTE} fill="none" stroke="#e3a14f" strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - u} />
      </svg>
      <div className="hf-pin" style={pct(P0)}>
        <span className="hf-pin-ic">
          <Warehouse aria-hidden />
        </span>
        <span>{shot.from}</span>
      </div>
      <div className={`hf-pin ${caught ? "bad" : claimed ? "ok" : ""}`} style={pct(P3)}>
        <span className="hf-pin-ic">{caught ? <X aria-hidden /> : claimed ? <Check aria-hidden /> : <Home aria-hidden />}</span>
        <span>{claimed ? (caught ? "Not delivered" : "Delivered?") : shot.to}</span>
      </div>
      {u >= shot.stop * 0.98 ? (
        <div className="hf-pin" style={{ ...pct(hub), marginTop: "-3cqw" }}>
          <span>{shot.hub}</span>
        </div>
      ) : null}
      <div className={`hf-truck ${caught ? "lost" : ""}`} style={pct(truck)}>
        <Truck aria-hidden />
      </div>
      {caught ? (
        <motion.div className="hf-truth" style={pct(truck)} initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          {shot.truth}
        </motion.div>
      ) : null}
      {t >= MAP_CLAIM ? (
        <motion.div className="hf-claim" initial={reduce ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <small>
            <Bot aria-hidden />
            Scout · last night
          </small>
          {shot.claim}
        </motion.div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ terminal */

const LINE_MS = 600;
const FLOOD_MS = 4200;
const linesEnd = (shot: Extract<FilmShot, { type: "terminal" }>) => 300 + shot.lines.length * LINE_MS;
const terminalEnd = (shot: Extract<FilmShot, { type: "terminal" }>) => linesEnd(shot) + (shot.flood ? 200 + FLOOD_MS : 0);

export function TerminalShot({ shot, t, reduce, sfx }: ShotProps<"terminal">) {
  const shown = clamp(Math.floor((t - 300) / LINE_MS) + 1, 0, shot.lines.length);
  const floodStart = linesEnd(shot) + 200;
  const floodN = shot.flood ? Math.round(easeIn(span(t, floodStart, floodStart + FLOOD_MS)) * shot.flood.count) : 0;
  useOnIncrease(shown, sfx.tick);
  useOnIncrease(floodN, sfx.tick);
  const floodRows = shot.flood && floodN ? Math.min(9, floodN) : 0;

  return (
    <div className={shot.flood ? "hf-win hf-term flood" : "hf-win hf-term"}>
      <div className="hf-winbar">
        <Lights />
        <span className="hf-url">{shot.title}</span>
      </div>
      <div className="hf-term-body">
        {shot.lines.slice(0, shown).map((l, i) => (
          <motion.div key={i} className={`hf-line ${l.tone}`} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
            <time>{l.time}</time>
            <span>{l.text}</span>
          </motion.div>
        ))}
        {Array.from({ length: floodRows }, (_, i) => (
          <div key={`f${floodN - i}`} className="hf-line err">
            <time>{`#${(floodN - floodRows + i + 1).toLocaleString("en-US")}`}</time>
            <span>{shot.flood!.text}</span>
          </div>
        ))}
        {shot.badge && shown >= shot.lines.length ? (
          <motion.span className="hf-term-badge" initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <Check aria-hidden className="mr-1 inline size-[1.2cqw]" />
            {shot.badge}
          </motion.span>
        ) : null}
        {shot.flood && floodN ? (
          <div className="hf-flood hf-counter" style={{ position: "absolute", top: "auto" }}>
            <b>{floodN.toLocaleString("en-US")}</b>
            <span>times</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ long-chat */

// the chat only moves while the learner holds the button down
const CHAT_HOLD: [number, number] = [900, 8400];
const ROW = 4.6; // cqw per message row, bubble and gap

export function LongChatShot({ shot, t, reduce, sfx }: ShotProps<"long-chat">) {
  const total = shot.messages.length;
  const last = Math.round(2 + easeInOut(span(t, ...CHAT_HOLD)) * (total - 3));
  const firstVisible = Math.max(0, last - shot.keep + 1);
  const keyGone = firstVisible > shot.key;
  useOnIncrease(last, sfx.tick);
  useOnIncrease(keyGone ? 1 : 0, sfx.whoosh);
  useOnIncrease(last >= shot.ask ? 1 : 0, sfx.alarm);

  return (
    <div className="hf-win hf-longchat">
      <div className="hf-winbar">
        <Lights />
        <span className="hf-url">
          Chat · {shot.customer} and {shot.agent}
        </span>
      </div>
      <div className="hf-lc-view">
        {keyGone ? (
          <motion.div className="hf-gone" initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <AlertTriangle aria-hidden />
            Message {shot.key + 1} scrolled away
          </motion.div>
        ) : null}
        <div className="hf-lc-list">
          {shot.messages.slice(firstVisible, last + 1).map((m, k) => {
            const i = firstVisible + k;
            const isKey = i === shot.key;
            const isAsk = i === shot.ask;
            return (
              <motion.div key={i} layout={!reduce} className={m.from === "customer" ? "hf-lc-msg me" : "hf-lc-msg"} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ minHeight: `${ROW - 0.7}cqw` }}>
                <span className="hf-lc-n">#{i + 1}</span>
                <span className={`hf-bubble ${m.from === "customer" ? "me" : "bot"} ${isKey ? "hf-key" : ""} ${isAsk ? "bad" : ""}`}>{m.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ test-grid */

const GRID_GATE = 600;
const GRID_RUN: [number, number] = [700, 5200];

/** Which test cases fail: a fixed, scattered pattern so the grid looks like a real run. */
function failing(total: number, failCount: number) {
  const rank = (i: number) => Math.imul(i + 1, 2654435761) >>> 0;
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => rank(a) - rank(b));
  return new Set(order.slice(0, failCount));
}

export function TestGridShot({ shot, t, sfx }: ShotProps<"test-grid">) {
  const fails = React.useMemo(() => failing(shot.total, shot.total - shot.passed), [shot.total, shot.passed]);
  const done = Math.round(easeInOut(span(t, ...GRID_RUN)) * shot.total);
  let failed = 0;
  for (let i = 0; i < done; i++) if (fails.has(i)) failed++;
  const passed = done - failed;
  useOnIncrease(done, sfx.tick);
  useOnIncrease(done >= shot.total ? 1 : 0, sfx.thud);

  return (
    <div className="hf-tests">
      <div className="hf-grid" aria-hidden>
        {Array.from({ length: shot.total }, (_, i) => (
          <span key={i} className={`hf-cell ${i < done ? (fails.has(i) ? "fail" : "pass") : ""}`} />
        ))}
      </div>
      <div className="hf-score">
        <span className="hf-countdown">
          <CalendarDays aria-hidden />
          {shot.countdown}
        </span>
        <div className="big">
          {passed}
          <small> / {shot.total}</small>
        </div>
        <div className="hf-tally">
          <span>
            <i style={{ background: "#3fae84" }} />
            {passed} passed
          </span>
          <span>
            <i style={{ background: "#e5605a" }} />
            {failed} failed
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ timelapse */

// the weekend only passes while the learner holds the button down
const LAPSE_HOLD: [number, number] = [500, 8500];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function timeLabel(startDay: string, startTime: string, minutes: number) {
  const [h, m] = startTime.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const day = WEEK[(WEEK.indexOf(startDay) + Math.floor(total / 1440)) % 7];
  const inDay = Math.floor(total % 1440);
  const hh = Math.floor(inDay / 60);
  const mm = inDay % 60;
  return { day, text: `${day} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`, hour: hh + mm / 60, minute: mm };
}

export function TimelapseShot({ shot, t, sfx }: ShotProps<"timelapse">) {
  const f = span(t, ...LAPSE_HOLD);
  const minutes = f * shot.hours * 60;
  const now = timeLabel(shot.startDay, shot.startTime, minutes);
  // every step re-sends a longer conversation, so cost grows faster than steps
  const cost = (x: number) => shot.amount * Math.pow(x, 2.2);
  const bill = Math.round(cost(f));
  const steps = Math.round(shot.steps * Math.pow(f, 1.25));
  const hot = f >= 1;
  useOnIncrease(Math.floor(bill / 25), sfx.tick);
  useOnIncrease(hot ? 1 : 0, sfx.alarm);
  const points = Array.from({ length: 25 }, (_, i) => {
    const x = (i / 24) * f;
    return `${(i / 24) * 300 * f},${78 - (cost(x) / shot.amount) * 72}`;
  }).join(" ");

  return (
    <div className="hf-lapse">
      <div className="hf-clock">
        <svg viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="92" fill="#14121e" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="100" y1="16" x2="100" y2={i % 3 ? 24 : 30} stroke="rgba(255,255,255,0.35)" strokeWidth={i % 3 ? 2 : 4} transform={`rotate(${i * 30} 100 100)`} />
          ))}
          <line x1="100" y1="100" x2="100" y2="54" stroke="#ece9f7" strokeWidth="6" strokeLinecap="round" transform={`rotate(${(now.hour % 12) * 30} 100 100)`} />
          <line x1="100" y1="100" x2="100" y2="30" stroke="#e3a14f" strokeWidth="3" strokeLinecap="round" transform={`rotate(${now.minute * 6} 100 100)`} />
          <circle cx="100" cy="100" r="6" fill="#e3a14f" />
        </svg>
        <div className="hf-clock-label">{now.text}</div>
      </div>
      <div className="hf-bill">
        <span className="hf-bill-label">AI provider bill</span>
        <span className={hot ? "hf-bill-amount hot" : "hf-bill-amount"}>${bill.toLocaleString("en-US")}</span>
        <svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden>
          <polyline points={points} fill="none" stroke="#ef8077" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <span className="hf-steps">{steps.toLocaleString("en-US")} steps · 0 parcels tracked</span>
        {f > 0 ? (
          <span className="hf-errline">
            {now.day} · {shot.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ numbers */

const numAt = (k: number) => 400 + k * 1100;

export function NumbersShot({ t, block, reduce, sfx }: ShotProps<"numbers">) {
  const items = stakesOf(block);
  const shown = items.filter((_, k) => t >= numAt(k)).length;
  useOnIncrease(shown, sfx.thud);
  return (
    <div className="hf-numbers">
      <span className="k">What it cost</span>
      {items.slice(0, shown).map((s, i) => (
        <motion.div key={i} className="hf-num" initial={reduce ? false : { opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
          {"value" in s ? (
            <span>
              {s.before}
              {/* a small count ("1 draft reply", "message 2") lands as it is; rolling up from 0 reads as a glitch */}
              <span className="n">{s.value < 10 ? `${s.prefix}${s.value}` : <NumberTicker value={s.value} prefix={s.prefix} />}</span>
              {s.after}
            </span>
          ) : (
            <span>{s.text}</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ dispatch */

/** The scene for a shot, by its type. */
export function Shot(props: Omit<ShotProps<FilmShot["type"]>, "shot"> & { shot: FilmShot }) {
  const { shot, ...rest } = props;
  switch (shot.type) {
    case "site-chat":
      return <SiteChatShot shot={shot} {...rest} />;
    case "tickets":
      return <TicketsShot shot={shot} {...rest} />;
    case "phone":
      return <PhoneShot shot={shot} {...rest} />;
    case "email":
      return <EmailShot shot={shot} {...rest} />;
    case "doc-vs-reply":
      return <DocVsReplyShot shot={shot} {...rest} />;
    case "parcel-map":
      return <ParcelMapShot shot={shot} {...rest} />;
    case "terminal":
      return <TerminalShot shot={shot} {...rest} />;
    case "long-chat":
      return <LongChatShot shot={shot} {...rest} />;
    case "test-grid":
      return <TestGridShot shot={shot} {...rest} />;
    case "timelapse":
      return <TimelapseShot shot={shot} {...rest} />;
    case "numbers":
      return <NumbersShot shot={shot} {...rest} />;
  }
}

/** Each scene's timeline (see Track). */
export function trackOf(shot: FilmShot, block: HookBlock): Track {
  switch (shot.type) {
    case "site-chat":
      return { len: CHAT_RUN[1] + 600, gates: CHAT_GATES };
    case "tickets":
      return { len: TICKET_RUN[1] + 600, gates: [TICKET_GATE] };
    case "phone":
      return { len: noteAt(shot.notes.length) + 600, gates: [] };
    case "email":
      return { len: MAIL_TYPE[1] + 600, gates: [MAIL_GATE] };
    case "doc-vs-reply":
      return { len: DOC_GATE + 2000, gates: [DOC_GATE], inScene: true };
    case "parcel-map":
      return { len: MAP_CAUGHT + 1200, gates: [MAP_GATE] };
    case "terminal":
      return { len: terminalEnd(shot) + 1200, gates: [] };
    case "long-chat":
      return { len: CHAT_HOLD[1] + 1800, gates: [], hold: CHAT_HOLD };
    case "test-grid":
      return { len: GRID_RUN[1] + 800, gates: [GRID_GATE] };
    case "timelapse":
      return { len: LAPSE_HOLD[1] + 1000, gates: [], hold: LAPSE_HOLD };
    case "numbers":
      return { len: numAt(stakesOf(block).length) + 900, gates: [] };
  }
}

/** What the learner's button says at gate `g`: the message they send, or the scene's `act`. */
export function actLabel(shot: FilmShot, g: number) {
  if (shot.type === "site-chat") return `“${shot.asks[g] ?? ""}”`;
  return "act" in shot ? shot.act : "";
}
