"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Bot, Brain, Briefcase, Check, Database, Map as MapIcon, Pencil, Play, Rocket, Sparkles, Target, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentVoiceState } from "@/components/agent/agent-voice";
import type { AgentBlueprint as Blueprint, AgentPart, PartState } from "@/lib/agent-build";

/** The picture for each part of the agent. */
export function PartIcon({ part, className }: { part: string; className?: string }) {
  switch (part) {
    case "job":
      return <Briefcase className={className} aria-hidden />;
    case "skills":
      return <Sparkles className={className} aria-hidden />;
    case "roadmap":
      return <MapIcon className={className} aria-hidden />;
    case "m1":
      return <Target className={className} aria-hidden />;
    case "m2":
      return <Brain className={className} aria-hidden />;
    case "m3":
      return <Wrench className={className} aria-hidden />;
    case "m4":
      return <Database className={className} aria-hidden />;
    case "m5":
      return <Play className={className} aria-hidden />;
    case "m6":
      return <Rocket className={className} aria-hidden />;
    default:
      return <Bot className={className} aria-hidden />;
  }
}

// six nodes around the core, starting at the top, clockwise
const R = 38; // % of the diagram's half-width
const spot = (i: number, n: number) => {
  const a = (-90 + (360 / n) * i) * (Math.PI / 180);
  return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
};

const NODE: Record<PartState, string> = {
  built: "border-brand bg-brand text-on-brand shadow-[0_0_18px_var(--accent-soft)]",
  building: "border-brand bg-brand-soft text-brand-ink",
  next: "border-brand-line border-dashed bg-panel text-ink-muted",
  later: "border-line border-dashed bg-panel text-ink-faint",
};

/**
 * The learner's agent as a blueprint: its core with its name, the six
 * parts the modules add around it (built ones lit and joined to the core,
 * the one being built pulsing), the three setup pieces above, and what the
 * agent says. It answers "where am I?" without a tour: you are building
 * the part that pulses.
 */
export function AgentBlueprint({
  agent,
  onRename,
  compact = false,
  voiceHost = false,
  className,
}: {
  agent: Blueprint;
  /** lets the learner rename their agent */
  onRename?: (name: string) => void;
  /** smaller, for side panels and popovers */
  compact?: boolean;
  /** this card shows what the companion says (and the subtitle bar steps aside while it is on screen) */
  voiceHost?: boolean;
  className?: string;
}) {
  const t = useTranslations("agent");
  const reduce = useReducedMotion();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const voice = useAgentVoiceState();
  const card = React.useRef<HTMLElement>(null);
  // host the companion's words only while this card is actually on screen (it's hidden on phones)
  const hostVoice = voice.host;
  React.useEffect(() => {
    if (!voiceHost || !card.current) return;
    let release: (() => void) | null = null;
    const check = () => {
      const shown = !!card.current && card.current.getClientRects().length > 0;
      if (shown && !release) release = hostVoice();
      if (!shown && release) {
        release();
        release = null;
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      release?.();
    };
  }, [voiceHost, hostVoice]);
  const spoken = voiceHost ? voice.line : null;

  function save() {
    const name = draft.trim().slice(0, 40);
    if (name && onRename) onRename(name);
    setEditing(false);
  }

  return (
    <section ref={card} className={cn("flex flex-col gap-4 rounded-card border border-line bg-panel p-4", className)} aria-label={t("label")}>
      {/* name and purpose */}
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand" aria-hidden>
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{t("label")}</div>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                autoFocus
                value={draft}
                maxLength={40}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
                aria-label={t("rename")}
                className="w-full rounded-md border border-brand-line bg-panel-2 px-2 py-0.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={cn("line-clamp-2 leading-snug font-semibold", !agent.name && "text-ink-muted")}>{agent.name ?? t("unnamed")}</span>
              {onRename && agent.name ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(agent.name ?? "");
                    setEditing(true);
                  }}
                  aria-label={t("rename")}
                  title={t("rename")}
                  className="rounded p-0.5 text-ink-faint hover:text-ink"
                >
                  <Pencil className="size-3.5" />
                </button>
              ) : null}
            </div>
          )}
          {agent.purpose ? <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{agent.purpose}</div> : null}
        </div>
      </div>

      {/* setup pieces */}
      <ol className="flex flex-wrap gap-1.5" aria-label={t("setup")}>
        {agent.setup.map((p) => (
          <SetupChip key={p.key} part={p} reduce={!!reduce} />
        ))}
      </ol>

      {/* the parts the modules add, around the core */}
      <div className={cn("relative mx-auto aspect-square w-full", compact ? "max-w-[220px]" : "max-w-[300px]")}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {agent.parts.map((p, i) => {
            const s = spot(i, agent.parts.length);
            const lit = p.state === "built";
            return (
              <motion.line
                key={p.key}
                x1={50}
                y1={50}
                x2={s.x}
                y2={s.y}
                strokeWidth={lit ? 1.2 : 0.6}
                strokeDasharray={lit ? undefined : "2 2"}
                className={lit ? "stroke-brand" : p.state === "building" ? "stroke-brand/70" : "stroke-line"}
                initial={reduce || !lit ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.1 * i }}
              />
            );
          })}
        </svg>
        {/* core */}
        <div className="absolute top-1/2 left-1/2 flex size-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-brand-line bg-brand-soft text-center">
          <Bot className="size-5 text-brand-ink" aria-hidden />
          <span className="mt-0.5 text-[10px] font-semibold text-brand-ink tabular-nums">{t("built", { n: agent.builtCount, total: agent.parts.length })}</span>
        </div>
        {/* nodes */}
        <ol aria-label={t("parts")}>
          {agent.parts.map((p, i) => {
            const s = spot(i, agent.parts.length);
            return (
              <li
                key={p.key}
                className="absolute flex w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-current={p.state === "building" ? "step" : undefined}
              >
                <span className={cn("relative flex size-9 items-center justify-center rounded-full border-2", NODE[p.state])}>
                  {p.state === "building" && !reduce ? (
                    <motion.span
                      aria-hidden
                      className="absolute inset-[-5px] rounded-full border-2 border-brand"
                      animate={{ scale: [1, 1.25], opacity: [0.7, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                  {p.state === "built" ? <Check className="size-4" aria-hidden /> : <PartIcon part={p.key} className="size-4" />}
                </span>
                <span className={cn("text-[10px] leading-tight font-medium", p.state === "later" ? "text-ink-faint" : "text-ink")}>
                  {p.label}
                  <span className="sr-only">: {t(`state_${p.state}`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* what the agent says: its spoken line while it talks, otherwise where things stand */}
      {spoken ? (
        <div className="relative flex gap-2 rounded-2xl rounded-tl-md border border-brand-line bg-brand-soft/60 px-3 py-2 text-sm" role="status" aria-live="polite">
          <span className="mt-1 flex h-3 shrink-0 items-end gap-[2px]" aria-hidden>
            {[0, 1, 2].map((i) =>
              voice.speaking && !reduce ? (
                <motion.span key={i} className="w-[2px] rounded-full bg-brand" animate={{ height: ["30%", "100%", "40%"] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
              ) : (
                <span key={i} className="h-1/2 w-[2px] rounded-full bg-brand/60" />
              ),
            )}
          </span>
          <p>{spoken}</p>
        </div>
      ) : agent.said || agent.needs ? (
        <div className="relative rounded-2xl rounded-tl-md bg-panel-2 px-3 py-2 text-sm" aria-live="polite">
          {agent.said ? <p>{agent.said}</p> : null}
          {agent.needs ? <p className={cn("text-ink-muted", agent.said && "mt-1")}>{agent.needs}</p> : null}
        </div>
      ) : null}

      {agent.next ? (
        <Button asChild variant="brand" size={compact ? "sm" : "default"} className="w-full">
          <Link href={agent.next.href}>
            {t("continue", { title: agent.next.label })}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function SetupChip({ part, reduce }: { part: AgentPart; reduce: boolean }) {
  const t = useTranslations("agent");
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        part.state === "built" ? "border-brand-line bg-brand-soft text-brand-ink" : part.state === "building" ? "border-brand text-ink" : "border-dashed border-line text-ink-faint",
      )}
      title={part.detail}
    >
      {part.state === "built" ? (
        <Check className="size-3.5" aria-hidden />
      ) : part.state === "building" ? (
        <span className={cn("size-2 rounded-full bg-brand", !reduce && "animate-pulse")} aria-hidden />
      ) : (
        <PartIcon part={part.key} className="size-3.5" />
      )}
      {part.label}
      <span className="sr-only">: {t(`state_${part.state}`)}</span>
    </li>
  );
}
