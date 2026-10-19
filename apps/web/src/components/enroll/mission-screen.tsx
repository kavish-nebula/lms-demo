"use client";

import * as React from "react";
import { cn } from "cn";
import { motion, useReducedMotion } from "motion/react";
import { Check, Loader2, Mail, MessageSquare, NotebookPen, Sparkles, Table2 } from "lucide-react";
import type { MissionScreen as Screen, MissionScreenLine } from "@/lib/mission";

const APP_ICON = { chat: MessageSquare, email: Mail, sheet: Table2, notes: NotebookPen };
const MS_PER_CHAR = 22;
const TOOL_MS = 1100;

/** When each line starts, and how long it takes to play. */
function timeline(lines: MissionScreenLine[]) {
  let t = 400;
  return lines.map((l) => {
    const start = t;
    const length = l.kind === "tool" ? TOOL_MS : l.kind === "result" ? 450 : Math.min(l.text.length * MS_PER_CHAR, 1800);
    t += length + 350;
    return { start, length };
  });
}

/**
 * The AI assistant's screen inside a Mission scene, played like a shot of a
 * real screen: what the learner asks types out, tool calls spin and then
 * finish, results appear. The content is written live for the learner's own
 * task, so the scene shows their work rather than describing it. Fully drawn
 * at once when the scene is settled (a decision is on screen) or with
 * reduced motion.
 */
export function MissionScreen({ screen, settled, waitingLabel }: { screen: Screen; settled: boolean; waitingLabel: string }) {
  const reduce = useReducedMotion();
  const plan = React.useMemo(() => timeline(screen.lines), [screen.lines]);
  const end = plan.length ? plan.at(-1)!.start + plan.at(-1)!.length : 0;
  const [elapsed, setElapsed] = React.useState(0);
  const instant = settled || !!reduce;

  React.useEffect(() => {
    if (instant) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const e = performance.now() - t0;
      setElapsed(e);
      if (e > end) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [instant, end]);

  const now = instant ? Infinity : elapsed;
  const Icon = APP_ICON[screen.app] ?? MessageSquare;
  const done = now >= end;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: settled ? 0.92 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b0f17]/85 shadow-2xl backdrop-blur-md"
      role="img"
      aria-label={`${screen.title}: ${screen.lines.map((l) => l.text).join(". ")}`}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-white/60">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/20" />
        </span>
        <Icon className="ml-1 size-3.5" aria-hidden />
        <span className="truncate">{screen.title}</span>
      </div>
      <div aria-hidden className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-3 py-3 text-[12px] leading-snug sm:text-[13px]">
        {screen.lines.map((l, i) => {
          const p = plan[i]!;
          if (now < p.start) return null;
          const into = now - p.start;
          const text = l.kind === "user" || l.kind === "agent" ? l.text.slice(0, Math.max(1, Math.floor(into / MS_PER_CHAR))) : l.text;
          const typing = (l.kind === "user" || l.kind === "agent") && text.length < l.text.length;
          if (l.kind === "user")
            return (
              <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-white/12 px-3 py-1.5 text-white">
                {text}
                {typing ? <Caret /> : null}
              </div>
            );
          if (l.kind === "agent")
            return (
              <div key={i} className="flex max-w-[92%] gap-2 text-white/90">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-300" />
                <span>
                  {text}
                  {typing ? <Caret /> : null}
                </span>
              </div>
            );
          if (l.kind === "tool") {
            const running = into < TOOL_MS;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex w-fit items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-2 py-1 font-mono text-[11px] text-sky-100 sm:text-[12px]">
                {running ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3 text-emerald-300" />}
                {l.text}
              </motion.div>
            );
          }
          return (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pl-1 font-mono text-[11px] text-emerald-200/90 sm:text-[12px]">
              ↳ {l.text}
            </motion.div>
          );
        })}
        {settled || done ? (
          <div className={cn("flex items-center gap-1.5 pt-1 text-[11px] text-white/50", !settled && "invisible")}>
            <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
            {waitingLabel}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

const Caret = () => <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-white/70" />;
