"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Clock3, EyeOff, Gauge, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/kit/progress-ring";
import { scorePrecheck } from "@/data/mock-grader";
import type { PrecheckResult } from "@/lib/setup";
import type { PrecheckItem } from "@/data/types";

/**
 * Quick check of what the learner already knows, asked once before Module 1
 * (the prototype's pre-assessment). Not a test: no score, no feedback, never
 * blocks. Two questions per lesson set how much help that lesson opens with.
 */
export function PrecheckStep({ items, courseTitle, onDone }: { items: PrecheckItem[]; courseTitle: string; onDone: (r: PrecheckResult) => void }) {
  const t = useTranslations("enroll");
  const [i, setI] = React.useState(-1);
  const [responses, setResponses] = React.useState<Record<string, string | null>>({});
  const lessons = [...new Set(items.map((x) => x.lesson))];
  const at = () => new Date().toISOString();

  function answer(id: string, v: string | null) {
    const next = { ...responses, [id]: v };
    setResponses(next);
    setTimeout(() => {
      if (i + 1 < items.length) setI(i + 1);
      else onDone({ at: at(), lessons: scorePrecheck(items, next), responses: next });
    }, 220);
  }

  if (i < 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("precheckKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("precheckTitle")}</h1>
          <p className="mt-3 text-lg text-ink-muted">{t("precheckBody", { count: items.length, course: courseTitle })}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: <Clock3 />, text: t("precheckTime") },
            { icon: <EyeOff />, text: t("precheckNoScore") },
            { icon: <Gauge />, text: t("precheckSets") },
          ].map((r) => (
            <li key={r.text} className="flex items-start gap-2.5 rounded-lg border border-line bg-panel-2/60 p-3 text-sm">
              <span className="mt-0.5 shrink-0 text-brand-ink [&_svg]:size-4">{r.icon}</span>
              {r.text}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="brand" onClick={() => setI(0)}>
            {t("precheckStart")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="bg-transparent"
            onClick={() => onDone({ at: at(), isNew: true, lessons: Object.fromEntries(lessons.map((l) => [l, 0])) })}
          >
            <Sprout data-icon="inline-start" />
            {t("precheckNew")}
          </Button>
          <Button variant="ghost" onClick={() => onDone({ at: at(), skipped: true, lessons: {} })}>
            {t("precheckSkip")}
          </Button>
        </div>
        <p className="text-sm text-ink-faint">{t("precheckSkipNote")}</p>
      </div>
    );
  }

  const item = items[i]!;
  const chosen = responses[item.id];
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <ProgressBar value={i / items.length} size="sm" aria-label={t("precheckOf", { n: i + 1, total: items.length })} />
        <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
          {i + 1}/{items.length}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={item.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col gap-5"
          aria-labelledby="precheck-q"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-brand-ink">
            {t("precheckOf", { n: i + 1, total: items.length })}
            <span className="rounded-pill border border-line px-2 py-0.5 text-xs font-normal text-ink-faint">
              {t("precheckWhere", { module: item.module.replace("m", ""), lesson: item.lesson })}
            </span>
          </div>
          <h1 id="precheck-q" className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            {item.stem}
          </h1>
          <div role="radiogroup" aria-labelledby="precheck-q" className="flex flex-col gap-2.5">
            {item.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={chosen === o.id}
                onClick={() => answer(item.id, o.id)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-card border px-4 py-3 text-left outline-none transition-[transform,border-color,background-color] duration-(--dur-1)",
                  "hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.99]",
                  chosen === o.id ? "border-brand bg-brand-soft" : "border-line bg-panel hover:border-brand-line",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 font-mono text-xs text-ink-faint uppercase">
                  {o.id}
                </span>
                <span className="font-medium">{o.text}</span>
              </button>
            ))}
          </div>
        </motion.section>
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <Button variant="ghost" onClick={() => setI(i - 1)}>
          <ArrowLeft data-icon="inline-start" />
          {t("back")}
        </Button>
        <span className="text-sm text-ink-faint">{t("precheckClosest")}</span>
        <Button variant="outline" className="ml-auto bg-transparent" onClick={() => answer(item.id, null)}>
          {t("precheckDontKnow")}
        </Button>
      </div>
    </div>
  );
}
