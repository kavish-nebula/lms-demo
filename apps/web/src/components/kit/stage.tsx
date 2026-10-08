"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Check, Lock } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { STAGE_META, STAGE_ORDER, type StageId, type StageState } from "@/lib/stages";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Stage label chip with icon, coloured per stage. */
export function StageChip({
  stage,
  size = "md",
  className,
}: {
  stage: StageId;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("stages");
  const Icon = STAGE_META[stage].icon;
  return (
    <Chip tone={stage} size={size} icon={<Icon />} className={className}>
      {t(stage)}
    </Chip>
  );
}

export type StageDotsProps = {
  /** stages this module includes, in delivery order */
  included: StageId[];
  /** map of stage -> state; missing entries default to "todo" */
  states?: Partial<Record<StageId, StageState>>;
  className?: string;
};

/**
 * Compact nine-slot strip for module rows: one segment per stage.
 * Absent stages are grey and dashed; not-in-V1 stages are hatched.
 */
export function StageDots({ included, states = {}, className }: StageDotsProps) {
  const t = useTranslations("stages");
  const tp = useTranslations("player");
  return (
    <ol className={cn("flex items-center gap-1", className)} aria-label={tp("stageRail")}>
      {STAGE_ORDER.map((stage) => {
        const inModule = included.includes(stage);
        const state: StageState = !inModule ? "absent" : (states[stage] ?? "todo");
        const meta = STAGE_META[stage];
        const label = `${meta.index}. ${t(stage)}${
          state === "absent" ? ` (${t("notInThisModule")})` : state === "not_in_v1" ? ` (${t("comingSoon")})` : ""
        }`;
        return (
          <li key={stage} className="contents">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={label}
                  className={cn(
                    "block h-2 w-5 rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    state === "done" && meta.solid,
                    state === "current" && cn(meta.solid, "ring-2 ring-offset-1 ring-offset-panel", "ring-current"),
                    state === "current" && meta.ink,
                    state === "todo" && cn("border", meta.chip),
                    state === "locked" && "bg-chart-track",
                    state === "absent" && "border border-dashed border-line bg-transparent",
                    state === "not_in_v1" &&
                      "bg-[repeating-linear-gradient(45deg,var(--chart-track)_0_3px,transparent_3px_6px)]",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}

export type TopicRailItem = {
  id: string;
  /** picks the icon and colour only; the label is the topic's own title */
  stage: StageId;
  label: string;
  /** small line under the label, e.g. the lessons a topic covers */
  sublabel?: string;
  state: StageState;
  minutes?: number;
};

/**
 * Vertical topic list for the player: the module's own topics in order, each
 * with its title (never the method name), state and length.
 */
export function TopicRail({
  items,
  label,
  onSelect,
  className,
}: {
  items: TopicRailItem[];
  label: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-1", className)}>
      {items.map((item, i) => {
        const meta = STAGE_META[item.stage];
        const Icon = meta.icon;
        const { state } = item;
        const disabled = state === "absent" || state === "not_in_v1";
        const locked = state === "locked";
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            aria-current={state === "current" ? "step" : undefined}
            onClick={() => onSelect?.(item.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-(--dur-1) outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/60",
              state === "current" && "bg-brand-soft font-medium text-brand-ink",
              state === "done" && "text-ink hover:bg-panel-2",
              state === "todo" && "text-ink-muted hover:bg-panel-2",
              locked && "text-ink-faint hover:bg-panel-2",
              disabled && "cursor-not-allowed text-ink-faint",
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4",
                state === "done" ? "border-transparent bg-ok text-on-ok" : meta.chip,
                (locked || disabled) && "border-line bg-panel-2 text-ink-faint",
              )}
            >
              {state === "done" ? <Check /> : locked ? <Lock /> : <Icon />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5">
                <span className="text-xs text-ink-faint tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
              </span>
              {item.sublabel ? (
                <span className="mt-0.5 block text-xs leading-snug font-normal text-ink-faint">{item.sublabel}</span>
              ) : null}
            </span>
            {item.minutes != null ? <span className="pt-0.5 text-xs text-ink-faint tabular-nums">{item.minutes}m</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

/** A small "Topic 2 of 5" chip in the topic's stage colour, used above lesson titles. */
export function TopicChip({ stage, children, className }: { stage: StageId; children: React.ReactNode; className?: string }) {
  const Icon = STAGE_META[stage].icon;
  return (
    <Chip tone={stage} size="md" icon={<Icon />} className={className}>
      {children}
    </Chip>
  );
}
