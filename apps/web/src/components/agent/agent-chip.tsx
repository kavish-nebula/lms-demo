"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgentBlueprint } from "@/components/agent/agent-blueprint";
import type { AgentBlueprint as Blueprint, PartState } from "@/lib/agent-build";

const SEGMENT: Record<PartState, string> = {
  built: "stroke-brand",
  building: "stroke-brand/50",
  next: "stroke-line",
  later: "stroke-line",
};

/**
 * The agent, small, for headers: a ring with one segment per part (lit when
 * built), its name and the part being built now. Opens the full blueprint.
 */
export function AgentChip({ agent, onRename, className }: { agent: Blueprint; onRename?: (name: string) => void; className?: string }) {
  const t = useTranslations("agent");
  const n = agent.parts.length || 1;
  const gap = 4;
  const arc = 100 / n - gap;
  const status = agent.current ? t("building", { part: agent.current.label }) : agent.builtCount === agent.parts.length && agent.parts.length ? t("complete") : t("label");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("flex min-w-0 items-center gap-2 rounded-full border border-line bg-panel py-1 pr-3 pl-1 text-left hover:border-brand-line", className)}
          aria-label={`${agent.name ?? t("label")}. ${status}. ${t("open")}`}
        >
          <span className="relative flex size-8 shrink-0 items-center justify-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden>
              {agent.parts.map((p, i) => (
                <circle
                  key={p.key}
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  strokeWidth="3"
                  pathLength={100}
                  strokeDasharray={`${arc} ${100 - arc}`}
                  strokeDashoffset={-(i * (100 / n)) - gap / 2}
                  className={SEGMENT[p.state]}
                />
              ))}
            </svg>
            <Bot className="size-4 text-brand-ink" aria-hidden />
          </span>
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate text-xs font-semibold">{agent.name ?? t("label")}</span>
            <span className="truncate text-[11px] text-ink-muted">{status}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <AgentBlueprint agent={agent} onRename={onRename} compact className="border-0" />
      </PopoverContent>
    </Popover>
  );
}
