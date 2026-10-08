"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { CalendarClock, HeartPulse } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { ChoiceList, Feedback } from "@/components/player/items";
import type { ReviewBlock, ReviewVariant } from "@/data/types";
import type { StageProps } from "./types";

type Rating = "got" | "not_yet";

/**
 * Stage 9. "Workflow health checks": the same ideas in a new incident,
 * scheduled 3, 10 and 30 days after the module (ch13 T7). Answer, see the
 * reasoning, then rate recall; ratings tune the schedule. Answering every
 * question finishes the module; an unrated answer counts as its result.
 */
export function ReviewStage({ block, ...nav }: StageProps<ReviewBlock>) {
  const t = useTranslations("player");
  const [ratings, setRatings] = React.useState<Record<string, Rating>>({});
  const [answered, setAnswered] = React.useState<Record<string, boolean>>({});
  const left = block.variants.filter((v) => !answered[v.id]).length;
  const days = block.schedule.map((s) => s.after_days);

  return (
    <StageShell
      stage="review"
      title={t("reviewTitle")}
      intro={t("reviewIntro")}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={left === 0 || nav.done}
      completeHint={t("answerMore", { count: left })}
      completeLabel={t("finishModule")}
      {...nav}
    >
      <Callout tone="review" label={t("scheduleLabel")} icon={<CalendarClock />}>
        <p className="text-sm">{t("scheduleBodyDays", { a: days[0] ?? 3, b: days[1] ?? 10, c: days[2] ?? 30 })}</p>
      </Callout>

      {block.variants.map((v) => (
        <ReviewCard
          key={v.id}
          variant={v}
          rating={ratings[v.id]}
          onRate={(r) => setRatings((s) => ({ ...s, [v.id]: r }))}
          onAnswered={(yes) => setAnswered((s) => ({ ...s, [v.id]: yes }))}
        />
      ))}
    </StageShell>
  );
}

function ReviewCard({
  variant,
  rating,
  onRate,
  onAnswered,
}: {
  variant: ReviewVariant;
  rating?: Rating;
  onRate: (r: Rating) => void;
  onAnswered: (answered: boolean) => void;
}) {
  const t = useTranslations("player");
  const [value, setValue] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState(false);
  const chosen = variant.options.find((o) => o.id === value[0]);
  const correct = !!chosen?.correct;
  const id = `review-${variant.id}`;

  return (
    <Surface pad="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" tone="review" icon={<HeartPulse />}>
          {variant.title}
        </Chip>
        <Chip size="sm">{t("afterDays", { days: variant.after_days })}</Chip>
        <Chip size="sm" tone="info">
          {t("newContext")}
        </Chip>
      </div>
      <p id={`${id}-stem`} className="font-medium leading-relaxed">
        {variant.stem}
      </p>
      <ChoiceList
        name={id}
        labelledBy={`${id}-stem`}
        options={variant.options}
        value={value}
        onChange={(v) => {
          setValue(v);
          setChecked(false);
          onAnswered(false);
        }}
        marks={checked && chosen ? { [chosen.id]: correct ? "correct" : "incorrect" } : undefined}
      />
      {!checked ? (
        <Button
          variant="outline"
          className="w-fit"
          disabled={!value.length}
          onClick={() => {
            setChecked(true);
            onAnswered(true);
          }}
        >
          {t("checkAnswer")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Feedback ok={correct} title={correct ? t("correct") : t("notYet")}>
            {chosen?.rationale}
          </Feedback>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("rateRecall")}>
            <span className="text-sm text-ink-muted">{t("rateRecall")}</span>
            <Button
              size="sm"
              variant={rating === "got" ? "default" : "outline"}
              aria-pressed={rating === "got"}
              onClick={() => onRate("got")}
              className={cn(rating === "got" && "bg-ok text-on-ok hover:bg-ok/90")}
            >
              {t("gotIt")}
            </Button>
            <Button size="sm" variant={rating === "not_yet" ? "default" : "outline"} aria-pressed={rating === "not_yet"} onClick={() => onRate("not_yet")}>
              {t("notYetRecall")}
            </Button>
          </div>
        </div>
      )}
    </Surface>
  );
}
