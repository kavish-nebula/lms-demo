import * as React from "react";
import { cn } from "cn";
import { STAGE_META } from "@/lib/stages";
import type { FinaleStep } from "@/data/types";
import {
  Bell,
  Bot,
  Boxes,
  Code2,
  FileText,
  Filter,
  GitBranch,
  GitMerge,
  Globe,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Table2,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Three icons per module, read left to right as a tiny pipeline. */
const SETS: LucideIcon[][] = [
  [Zap, Filter, Bell],
  [Table2, Wand2, Sparkles],
  [GitBranch, GitMerge, Globe],
  [ShieldAlert, RotateCw, Bot],
  [Boxes, Code2, FileText],
];

const TONES = [
  "text-stage-hook border-stage-hook-line bg-stage-hook-soft",
  "text-stage-worked border-stage-worked-line bg-stage-worked-soft",
  "text-brand-ink border-brand-line bg-brand-soft",
];

/**
 * Module illustration (Coursera-style thumbnail), built from the module's
 * own theme rather than stock art: three nodes joined like a workflow.
 */
export function ModuleArt({ index, className, size = "md" }: { index: number; className?: string; size?: "sm" | "md" }) {
  const set = SETS[(index - 1) % SETS.length]!;
  const box = size === "sm" ? "size-9 [&_svg]:size-4" : "size-12 [&_svg]:size-5";
  return (
    <div
      aria-hidden
      className={cn(
        "grid-texture relative flex items-center justify-center gap-3 overflow-hidden rounded-xl border border-line bg-panel-2/60",
        className,
      )}
    >
      <span className="absolute inset-x-6 top-1/2 h-px bg-[linear-gradient(90deg,transparent,var(--line),transparent)]" />
      {set.map((Icon, i) => (
        <span
          key={i}
          className={cn(
            "relative flex items-center justify-center rounded-xl border shadow-sm",
            box,
            TONES[(i + index) % TONES.length],
            i === 1 && "-translate-y-2",
          )}
        >
          <Icon />
        </span>
      ))}
    </div>
  );
}

/** The finale's thumbnail: its three steps (capstone, final check, wrap-up) in their own colours. */
export function FinaleArt({ steps, className }: { steps: FinaleStep[]; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid-texture relative flex items-center justify-center gap-3 overflow-hidden rounded-xl border border-line bg-panel-2/60",
        className,
      )}
    >
      <span className="absolute inset-x-6 top-1/2 h-px bg-[linear-gradient(90deg,transparent,var(--line),transparent)]" />
      {steps.map((s, i) => {
        const meta = STAGE_META[s.stage];
        const Icon = meta.icon;
        return (
          <span
            key={s.id}
            className={cn("relative flex size-12 items-center justify-center rounded-xl border shadow-sm [&_svg]:size-5", meta.chip, i === 1 && "-translate-y-2")}
          >
            <Icon />
          </span>
        );
      })}
    </div>
  );
}
