"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { TopicChip } from "@/components/kit/stage";
import { useTopic } from "@/components/player/topic-context";
import { Button } from "@/components/ui/button";
import type { StageId } from "@/lib/stages";
import type { Bloom } from "@/data/types";

export type StageShellProps = {
  stage: StageId;
  title: React.ReactNode;
  intro?: React.ReactNode;
  minutes?: number;
  bloom?: Bloom;
  children: React.ReactNode;
  /** footer: previous stage */
  onPrev?: () => void;
  /** footer: complete this stage and move on */
  onComplete?: () => void;
  completeLabel?: string;
  canComplete?: boolean;
  /** shown left of the complete button when it is disabled */
  completeHint?: string;
  done?: boolean;
  /** hide the footer entirely (the gate renders its own actions) */
  hideFooter?: boolean;
  /** place the first child and the remaining material in separate surface cards */
  separateCards?: boolean;
  className?: string;
};

/**
 * Frame for one topic: position / Bloom / duration chips, the topic's own
 * title, intro line, body, and a prev / complete footer. Calm by design: no
 * glass, no decoration, one idea per screen (ch13 Mayer rules). The title
 * comes from the topic on screen, so learners never see a method name.
 */
export function StageShell({
  stage,
  title,
  intro,
  minutes,
  bloom,
  children,
  onPrev,
  onComplete,
  completeLabel,
  canComplete = true,
  completeHint,
  done,
  hideFooter,
  separateCards = false,
  className,
}: StageShellProps) {
  const t = useTranslations("player");
  const tb = useTranslations("bloom");
  const tc = useTranslations("common");
  const topic = useTopic();
  const open = canComplete;

  const header = (
    <header className="stage-focus-header flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {topic ? <TopicChip stage={topic.stage}>{topic.label}</TopicChip> : null}
        {bloom ? <Chip size="sm">{tb(bloom)}</Chip> : null}
        {minutes ? (
          <Chip size="sm" icon={<Clock />}>
            {tc("minutes", { count: minutes })}
          </Chip>
        ) : null}
        {done ? (
          <Chip size="sm" tone="ok" icon={<Check />}>
            {t("stageDone")}
          </Chip>
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{topic?.title ?? title}</h1>
      {intro ? <p className="text-lg text-ink-muted">{intro}</p> : null}
    </header>
  );

  const footer = hideFooter ? null : (
    <footer className="stage-focus-footer mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      {onPrev ? (
        <Button variant="ghost" onClick={onPrev}>
          <ArrowLeft data-icon="inline-start" />
          {tc("back")}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        {!open && completeHint ? (
          <span className="text-sm text-ink-muted" aria-live="polite">
            {completeHint}
          </span>
        ) : null}
        {onComplete ? (
          <Button size="lg" variant="brand" disabled={!open} onClick={onComplete}>
            {completeLabel ?? t("completeContinue")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </footer>
  );

  if (separateCards) {
    const parts = React.Children.toArray(children);
    return (
      <article data-stage={stage} className={cn("stage-focus-shell stage-separated-shell mx-auto flex w-full flex-col gap-4", className)}>
        <section className="stage-primary-card">
          {header}
          <div className="stage-focus-body stage-primary-body flex min-h-0 flex-col gap-6">{parts[0]}</div>
        </section>
        {parts.length > 1 ? <section className="stage-related-card" aria-label="Related lesson material">{parts.slice(1)}</section> : null}
        {footer}
      </article>
    );
  }

  return (
    <article data-stage={stage} className={cn("stage-focus-shell mx-auto flex w-full flex-col gap-6", className)}>
      {header}

      <div className="stage-focus-body flex min-h-0 flex-col gap-6">{children}</div>

      {footer}
    </article>
  );
}

/** Small labelled callout used for objectives, takeaways and "your turn". */
export function Callout({
  tone = "accent",
  label,
  icon,
  children,
  className,
}: {
  tone?: "accent" | StageId;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    accent: "border-brand-line bg-brand-soft [&_[data-label]]:text-brand-ink",
    worked: "border-stage-worked-line bg-stage-worked-soft [&_[data-label]]:text-stage-worked",
    guided: "border-stage-guided-line bg-stage-guided-soft [&_[data-label]]:text-stage-guided",
    lab: "border-stage-lab-line bg-stage-lab-soft [&_[data-label]]:text-stage-lab",
    hook: "border-stage-hook-line bg-stage-hook-soft [&_[data-label]]:text-stage-hook",
    reflection: "border-stage-reflection-line bg-stage-reflection-soft [&_[data-label]]:text-stage-reflection",
    review: "border-stage-review-line bg-stage-review-soft [&_[data-label]]:text-stage-review",
  };
  return (
    <div className={cn("flex gap-3 rounded-card border p-4", tones[tone] ?? tones.accent, className)}>
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-5" data-label>{icon}</span> : null}
      <div className="min-w-0">
        <div data-label className="text-sm font-semibold">
          {label}
        </div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
