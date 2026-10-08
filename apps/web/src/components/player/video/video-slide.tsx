"use client";

import * as React from "react";
import { cn } from "cn";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  Boxes,
  Braces,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  Factory,
  FileText,
  Filter,
  Headset,
  Lightbulb,
  Mail,
  Pencil,
  Scale,
  Search,
  Send,
  ShoppingCart,
  Split,
  Table2,
  UserRound,
  Webhook,
  Workflow,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { VideoSlide } from "@/data/types";

const ICONS: Record<string, LucideIcon> = {
  workflow: Workflow,
  zap: Zap,
  boxes: Boxes,
  send: Send,
  table: Table2,
  form: ClipboardList,
  clock: Clock3,
  webhook: Webhook,
  "bell-off": BellOff,
  download: Download,
  pencil: Pencil,
  split: Split,
  "arrow-right": ArrowRight,
  "x-circle": XCircle,
  eye: Eye,
  alert: AlertTriangle,
  file: FileText,
  headset: Headset,
  filter: Filter,
  copy: Copy,
  database: Database,
  code: Braces,
  calendar: CalendarDays,
  shop: ShoppingCart,
  factory: Factory,
  user: UserRound,
  mail: Mail,
  search: Search,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Boxes;
  return <C className={className} aria-hidden />;
}

/** Something on a slide that appears when the narration reaches it. It keeps its place while hidden. */
function R({
  on,
  children,
  className,
  x = 0,
  y = 14,
  style,
}: {
  on: boolean;
  children: React.ReactNode;
  className?: string;
  x?: number;
  y?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={false}
      aria-hidden={!on}
      animate={{ opacity: on ? 1 : 0, x: on ? 0 : x, y: on ? 0 : y, scale: on ? 1 : 0.98 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

type Shown = (cue?: number) => boolean;

/**
 * One slide of a concept video. `shown(cue)` says whether the narration has
 * reached sentence `cue`; each kind lays its content out like a presentation
 * slide. Nothing may leave the frame: if a slide is taller than the frame,
 * its body is scaled down to fit.
 */
export function VideoSlideView({ slide: s, shown }: { slide: VideoSlide; shown: Shown }) {
  const frame = React.useRef<HTMLDivElement>(null);
  const body = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const fit = () => {
      const b = body.current;
      const f = frame.current;
      if (!b || !f) return;
      b.style.transform = "none";
      b.style.width = "100%";
      if (window.matchMedia("(max-width: 760px)").matches) return;
      const room = f.clientHeight;
      const top = f.getBoundingClientRect().top;
      let need = b.scrollHeight;
      for (const el of b.querySelectorAll("*")) need = Math.max(need, el.getBoundingClientRect().bottom - top);
      if (need <= room) return;
      const scale = Math.max(0.5, (room / need) * 0.99);
      b.style.transform = `scale(${scale})`;
      b.style.width = `${100 / scale}%`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (frame.current) ro.observe(frame.current);
    return () => ro.disconnect();
  }, [s]);

  return (
    <motion.div className="vl-slide" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
      <div className="vl-frame" ref={frame}>
        <div className={cn("vl-body", `vl-k-${s.kind}`)} ref={body}>
          {s.kind !== "title" ? <h3 className="vl-title">{s.title}</h3> : null}
          <SlideBody s={s} shown={shown} />
        </div>
      </div>
    </motion.div>
  );
}

function SlideBody({ s, shown }: { s: VideoSlide; shown: Shown }) {
  switch (s.kind) {
    case "title":
      return (
        <div className="vl-cover">
          <span className="vl-cover-ic">
            <Icon name={s.icon} />
          </span>
          <div className="vl-kicker">{s.kicker}</div>
          <h3 className="vl-cover-title">{s.title}</h3>
          <p className="vl-cover-sub">{s.sub}</p>
        </div>
      );

    case "compare":
      return (
        <div className="vl-cols">
          {[s.left, s.right].map((side) => (
            <R key={side.label} on={shown(side.cue)} className={cn("vl-col", side.tone)}>
              <div className="vl-col-head">
                {side.tone === "ok" ? <Check size={18} aria-hidden /> : side.tone === "bad" ? <X size={18} aria-hidden /> : <Scale size={18} aria-hidden />} {side.label}
              </div>
              <ul>
                {side.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </R>
          ))}
        </div>
      );

    case "define":
      return (
        <div className="vl-define">
          <R on={shown(0)} className="vl-def-card">
            <div className="vl-kicker">{s.term}</div>
            <p className="vl-def">{s.definition}</p>
            <div className="vl-def-parts">
              {s.parts.map((p) => (
                <R key={p.text} on={shown(p.cue)} className="vl-chip">
                  {p.text}
                </R>
              ))}
            </div>
          </R>
          <R on={shown((s.parts.at(-1)?.cue ?? 0) + 1)} className="vl-aside">
            <Lightbulb aria-hidden />
            <div>
              <b>{s.analogy.label}</b>
              <p>{s.analogy.text}</p>
            </div>
          </R>
        </div>
      );

    case "flow":
      return (
        <div className="vl-flowwrap">
          <div className="vl-flow" style={{ "--n": s.nodes.length } as React.CSSProperties}>
            {s.nodes.map((n, i) => {
              // in a "run", a node turns green once the narration has moved on to the next one
              const ran = !!s.run && shown(s.nodes[i + 1]?.cue ?? s.note.cue);
              return (
                <div key={`${n.label}-${i}`} className="vl-flow-step">
                  {i > 0 ? (
                    <R on={shown(n.cue)} y={0} x={-10} className={cn("vl-arrow", s.run && shown(n.cue) && "live")}>
                      <span />
                      <ArrowRight size={22} aria-hidden />
                    </R>
                  ) : null}
                  <R on={shown(n.cue)} className={cn("vl-node", n.kind, ran && "ran")}>
                    <span className="vl-node-ic">{ran ? <CheckCircle2 aria-hidden /> : <Icon name={n.icon} />}</span>
                    <b>{n.label}</b>
                    <span>{n.sub}</span>
                  </R>
                </div>
              );
            })}
          </div>
          <R on={shown(s.note.cue)} className="vl-note">
            {s.note.text}
          </R>
        </div>
      );

    case "bullets":
      return (
        <div className="vl-split">
          <div>
            <p className="vl-lead">{s.lead}</p>
            <ul className="vl-bullets">
              {s.bullets.map((b) => (
                <li key={b.text}>
                  <R on={shown(b.cue)} x={-14} y={0} className="vl-bullet">
                    <span className="vl-bullet-ic">
                      <Icon name={b.icon} />
                    </span>
                    {b.text}
                  </R>
                </li>
              ))}
            </ul>
          </div>
          <R on={shown(s.aside.cue)} className="vl-aside tall">
            <Icon name={s.aside.icon} />
            <div>
              <b>{s.aside.label}</b>
              <p>{s.aside.text}</p>
            </div>
          </R>
        </div>
      );

    case "example":
      return (
        <div className="vl-example">
          <p className="vl-lead">
            <b>Scenario: </b>
            {s.scenario}
          </p>
          <ol>
            {s.steps.map((st) => (
              <li key={st.text}>
                <R on={shown(st.cue)} x={-14} y={0} className="vl-step">
                  <span className="vl-time-tag">{st.time}</span>
                  <span className="vl-bullet-ic">
                    <Icon name={st.icon} />
                  </span>
                  {st.text}
                </R>
              </li>
            ))}
          </ol>
          <R on={shown(s.result.cue)} className="vl-note ok">
            {s.result.text}
          </R>
        </div>
      );

    case "cards":
      return (
        <div className="vl-cards">
          {s.cards.map((c) => (
            <R key={c.title} on={shown(c.cue)} className="vl-card">
              <div className="vl-card-head">
                <Icon name={c.icon} /> {c.title}
              </div>
              {c.flow.map((f, k) => (
                <div key={k} className="vl-card-row">
                  <span className="vl-card-tag">{["Trigger", "Step", "Action"][k]}</span>
                  {f}
                </div>
              ))}
            </R>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="vl-tablewrap">
          <div className="vl-table" style={{ "--cols": s.columns.length } as React.CSSProperties}>
            <div className="vl-tr head">
              {s.columns.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {s.rows.map((r, i) => (
              <R key={i} on={shown(r.cue)} y={8} className={cn("vl-tr", r.tone)}>
                {r.cells.map((c, k) => (
                  <span key={k}>{c}</span>
                ))}
              </R>
            ))}
          </div>
          <R on={shown(s.note.cue)} className="vl-note">
            {s.note.text}
          </R>
        </div>
      );

    case "code":
      return (
        <div className="vl-split">
          <div>
            <p className="vl-lead">{s.lead}</p>
            <div className="vl-code">
              {s.rows.map((r) => (
                <R key={r.code} on={shown(r.cue)} x={-14} y={0} className="vl-code-row">
                  <code>{r.code}</code>
                  <ArrowRight size={18} aria-hidden />
                  <span>{r.out}</span>
                </R>
              ))}
            </div>
          </div>
          <R on={shown(s.aside.cue)} className="vl-aside tall">
            <Icon name={s.aside.icon} />
            <div>
              <b>{s.aside.label}</b>
              <p>{s.aside.text}</p>
            </div>
          </R>
        </div>
      );

    case "recap":
      return (
        <ul className="vl-recap">
          {s.points.map((p) => (
            <li key={p.text}>
              <R on={shown(p.cue)} x={-14} y={0} className="vl-recap-row">
                <CheckCircle2 aria-hidden />
                {p.text}
              </R>
            </li>
          ))}
        </ul>
      );
  }
}
