"use client";

import * as React from "react";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { STAGE_META } from "@/lib/stages";
import type { PlanUnit } from "@/lib/plan";
import { keyDate } from "@/components/plan/use-plan";

/**
 * Course outline: every module's steps as selectable pills. Green = done,
 * "next up" on the first open step, a date chip once a step is planned.
 * Selecting a pill picks it in "Add plan".
 */
export function PlanOutline({
  title,
  units,
  plannedOn,
  nextUpId,
  pickedId,
  onPick,
}: {
  title: string;
  units: PlanUnit[];
  plannedOn: Record<string, string>;
  nextUpId?: string;
  pickedId?: string;
  onPick: (id: string) => void;
}) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const format = useFormatter();

  const doneCount = units.filter((u) => u.done).length;
  const percent = units.length ? Math.round((doneCount / units.length) * 100) : 0;
  const status =
    doneCount === 0 ? t("statusNotStarted") : doneCount === units.length ? t("statusDone") : t("statusInProgress", { percent });

  const modules: { index: number; title: string; units: PlanUnit[] }[] = [];
  for (const u of units) {
    const last = modules[modules.length - 1];
    if (last && last.index === u.moduleIndex) last.units.push(u);
    else modules.push({ index: u.moduleIndex, title: u.moduleTitle, units: [u] });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <Chip tone={doneCount === units.length ? "ok" : doneCount ? "accent" : "neutral"} dot>
          {status}
        </Chip>
      </div>

      <ol className="flex flex-col gap-5">
        {modules.map((m) => {
          const minutes = m.units.reduce((n, u) => n + u.minutes, 0);
          const allDone = m.units.every((u) => u.done);
          return (
            <li key={m.index} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">
                  <span className="mr-2 font-mono text-xs text-ink-faint">{m.index ? t("moduleN", { n: m.index }) : t("finaleShort")}</span>
                  {m.title}
                </h3>
                <span className="shrink-0 font-mono text-xs text-ink-faint">
                  {allDone ? t("allStepsDone", { count: m.units.length }) : tc("minutes", { count: minutes })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {m.units.map((u) => {
                  const meta = STAGE_META[u.stage];
                  const Icon = meta.icon;
                  const isNext = u.id === nextUpId;
                  const isPicked = u.id === pickedId && !u.done;
                  const date = plannedOn[u.id];
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={u.done}
                      onClick={() => onPick(u.id)}
                      aria-pressed={isPicked}
                      className={cn(
                        "group inline-flex h-9 items-center gap-2 rounded-pill border pr-3 pl-1 text-sm transition-[transform,border-color,background-color] duration-(--dur-1) outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring/60",
                        u.done
                          ? "cursor-default border-transparent bg-ok-soft text-ink-muted"
                          : "border-line bg-panel hover:-translate-y-0.5 hover:border-brand-line active:scale-[0.97]",
                        isPicked && "border-brand bg-brand-soft shadow-[0_0_0_3px_var(--accent-soft)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full border [&_svg]:size-3.5",
                          u.done ? "border-transparent bg-ok text-on-ok" : meta.chip,
                        )}
                      >
                        {u.done ? <Check aria-hidden strokeWidth={3} /> : <Icon aria-hidden />}
                      </span>
                      <span className={cn("text-left", u.done && "line-through decoration-ink-faint/60")}>{u.label}</span>
                      {!u.done ? <span className="font-mono text-xs text-ink-faint">{u.minutes}m</span> : null}
                      {!u.done && (isNext || date) ? (
                        <Chip size="sm" tone={date ? "neutral" : "accent"} className="h-5 px-1.5 text-[11px]">
                          {date
                            ? format.dateTime(keyDate(date), { day: "numeric", month: "short" })
                            : t("nextUp")}
                        </Chip>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="font-mono text-xs text-ink-faint">{t("outlineHint")}</p>
    </div>
  );
}
