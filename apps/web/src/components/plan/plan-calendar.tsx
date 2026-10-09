"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, HeartPulse, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/kit/chip";
import { STAGE_META } from "@/lib/stages";
import { fromKey, monthGrid, WEEK_ORDER, type DayItem, type PlanUnit } from "@/lib/plan";
import { keyDate } from "@/components/plan/use-plan";

export type PlanCalendarProps = {
  days: Record<string, DayItem[]>;
  today: string;
  selected: string;
  onSelect: (key: string) => void;
  /** the next-up unit, startable from its session */
  nextUp?: PlanUnit;
  /** unit "Plan here" would add on an empty future day */
  suggestion?: PlanUnit;
  onPlanHere: (key: string) => void;
  onRemove: (sessionId: string) => void;
  playerHref: (u: PlanUnit) => string;
};

/**
 * Study calendar (prototype LearningPlan): month grid with planned /
 * health-check / done markers, a sliding month transition, and the selected
 * day's items with enter/exit animation.
 */
export function PlanCalendar({
  days,
  today,
  selected,
  onSelect,
  nextUp,
  suggestion,
  onPlanHere,
  onRemove,
  playerHref,
}: PlanCalendarProps) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const format = useFormatter();
  const sel = fromKey(selected);
  const [view, setView] = React.useState({ y: sel.getFullYear(), m: sel.getMonth(), dir: 0 });

  // keep the visible month on the selected day when it changes from outside
  const selMonth = `${sel.getFullYear()}-${sel.getMonth()}`;
  const [lastSel, setLastSel] = React.useState(selMonth);
  if (selMonth !== lastSel) {
    setLastSel(selMonth);
    const dir = sel.getFullYear() * 12 + sel.getMonth() > view.y * 12 + view.m ? 1 : -1;
    setView({ y: sel.getFullYear(), m: sel.getMonth(), dir });
  }

  const move = (by: number) => {
    const d = new Date(view.y, view.m + by, 1);
    setView({ y: d.getFullYear(), m: d.getMonth(), dir: by });
  };

  const monthLabel = format.dateTime(new Date(Date.UTC(view.y, view.m, 15)), { month: "long", year: "numeric" });
  // 2026-10-05 is a Monday; weekday names come from Intl in the learner's locale
  const weekdayNames = WEEK_ORDER.map((_, i) =>
    format.dateTime(new Date(Date.UTC(2026, 9, 5 + i, 12)), { weekday: "short" }),
  );
  const items = days[selected] ?? [];
  const sessions = items.filter((i) => i.type === "session").length;
  const canPlanHere = !!suggestion && selected >= today && items.every((i) => i.type !== "session");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap">{t("calendarTitle")}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => move(-1)} aria-label={t("prevMonth")}>
            <ChevronLeft />
          </Button>
          <span aria-live="polite" className="min-w-28 text-center text-sm font-semibold whitespace-nowrap">
            {monthLabel}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => move(1)} aria-label={t("nextMonth")}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold tracking-wide text-ink-faint uppercase">
        {weekdayNames.map((d) => (
          <div key={d} aria-hidden>
            {d}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={view.dir}>
          <motion.div
            key={`${view.y}-${view.m}`}
            custom={view.dir}
            variants={{
              enter: (dir: number) => ({ opacity: 0, x: dir * 36 }),
              center: { opacity: 1, x: 0 },
              exit: (dir: number) => ({ opacity: 0, x: dir * -36 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            role="grid"
            aria-label={`${t("calendarTitle")}, ${monthLabel}`}
            className="grid grid-cols-7 gap-1.5"
          >
            {monthGrid(view.y, view.m)
              .flat()
              .map((key, i) => {
                if (!key) return <div key={`x${i}`} aria-hidden className="aspect-square sm:aspect-auto sm:h-16" />;
                const list = days[key] ?? [];
                const open = list.filter((it) => !it.done);
                const planned = open.filter((it) => it.type === "session").length;
                const check = open.some((it) => it.type === "review");
                const done = list.some((it) => it.done);
                const isSel = key === selected;
                const isToday = key === today;
                const past = key < today;
                const label = format.dateTime(keyDate(key), { weekday: "long", day: "numeric", month: "long" });
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={list.length ? `${label}, ${t("itemsCount", { count: list.length })}` : label}
                    onClick={() => onSelect(key)}
                    className={cn(
                      "group relative flex aspect-square flex-col items-start justify-between rounded-lg border p-1.5 text-left text-sm transition-[transform,background-color,border-color,box-shadow] duration-(--dur-1) outline-none sm:aspect-auto sm:h-16 sm:p-2",
                      "focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.97]",
                      isSel
                        ? "border-transparent bg-[linear-gradient(140deg,var(--accent-deep),var(--accent))] text-on-brand shadow-[0_10px_30px_-12px_var(--accent)]"
                        : list.length
                          ? "border-line bg-panel-2/60 hover:-translate-y-0.5 hover:border-brand-line"
                          : "border-line/70 bg-panel/40 hover:-translate-y-0.5 hover:border-brand-line",
                      past && !isSel && "text-ink-faint",
                      isToday && !isSel && "border-brand-line ring-1 ring-brand-line",
                    )}
                  >
                    <span className={cn("leading-none font-semibold tabular-nums", isToday && !isSel && "text-brand-ink")}>
                      {fromKey(key).getDate()}
                    </span>
                    <span className="flex items-center gap-1" aria-hidden>
                      {planned ? (
                        <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold", isSel ? "text-on-brand" : "text-brand-ink")}>
                          <i className={cn("size-1.5 rounded-full", isSel ? "bg-on-brand" : "bg-brand")} />
                          {planned > 1 ? planned : null}
                        </span>
                      ) : null}
                      {check ? <i className="size-1.5 rounded-full bg-amber" /> : null}
                      {done ? <i className={cn("size-1.5 rounded-full", isSel ? "bg-on-brand/80" : "bg-ok")} /> : null}
                    </span>
                  </button>
                );
              })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-brand" aria-hidden /> {t("legendPlanned")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-amber" aria-hidden /> {t("legendCheck")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-ok" aria-hidden /> {t("legendDone")}
        </span>
        {selected !== today ? (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => onSelect(today)}>
            {t("today")}
          </Button>
        ) : null}
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">
            {format.dateTime(keyDate(selected), { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <Chip size="sm">{t("sessionsCount", { count: sessions })}</Chip>
        </div>

        <ul className="mt-3 flex flex-col gap-2" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="flex items-center gap-3 rounded-lg border border-line bg-panel-2/50 p-2.5"
              >
                <DayItemRow
                  item={it}
                  nextUp={nextUp}
                  playerHref={playerHref}
                  onRemove={onRemove}
                  minutesLabel={(n) => tc("minutes", { count: n })}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {items.length === 0 ? <p className="mt-2 text-sm text-ink-faint">{t("nothingOnDay")}</p> : null}
        {canPlanHere ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => onPlanHere(selected)}>
            <CalendarPlus data-icon="inline-start" />
            {t("planHere", { step: suggestion!.label })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DayItemRow({
  item,
  nextUp,
  playerHref,
  onRemove,
  minutesLabel,
}: {
  item: DayItem;
  nextUp?: PlanUnit;
  playerHref: (u: PlanUnit) => string;
  onRemove: (id: string) => void;
  minutesLabel: (n: number) => string;
}) {
  const t = useTranslations("plan");

  if (item.type === "session") {
    const u = item.unit;
    const meta = STAGE_META[u.stage];
    const Icon = meta.icon;
    return (
      <>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4", item.done ? "border-transparent bg-ok text-on-ok" : meta.chip)}>
          {item.done ? <Check aria-hidden /> : <Icon aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{u.label}</span>
          <span className="block truncate font-mono text-xs text-ink-faint">
            {u.moduleIndex ? `M${u.moduleIndex} · ` : ""}{u.moduleTitle} · {item.done ? t("stepDone") : minutesLabel(u.minutes)}
          </span>
        </span>
        {!item.done && nextUp?.id === u.id ? (
          <Button asChild size="xs" variant="brand">
            <Link href={playerHref(u)}>
              <Play data-icon="inline-start" />
              {t("start")}
            </Link>
          </Button>
        ) : null}
        {!item.done ? (
          <Button variant="ghost" size="icon-xs" onClick={() => onRemove(item.sessionId)} aria-label={`${t("remove")}: ${u.label}`}>
            <X />
          </Button>
        ) : null}
      </>
    );
  }

  if (item.type === "review") {
    return (
      <>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-warn-line bg-warn-soft text-warn [&_svg]:size-4">
          <HeartPulse aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{t("checkLabel")}</span>
          <span className="block truncate font-mono text-xs text-ink-faint">
            {item.label} · {minutesLabel(item.minutes)}
          </span>
        </span>
      </>
    );
  }

  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ok text-on-ok [&_svg]:size-4">
        <Check aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        <span className="block truncate font-mono text-xs text-ink-faint">
          {item.course} · {item.detail}
        </span>
      </span>
    </>
  );
}
