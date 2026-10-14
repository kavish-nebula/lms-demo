"use client";

import * as React from "react";
import { useSignal } from "@/lib/signals";
import { ReflectionReview, ReviewRecall } from "@/components/learning/reflection-review";
import { useTranslations } from "next-intl";
import { CalendarClock, HeartPulse } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { ChoiceList, Feedback } from "@/components/player/items";
import type { ReviewBlock, ReviewVariant } from "@/data/types";
import type { StageProps } from "./types";


/**
 * Stage 9. "Workflow health checks": the same ideas in a new incident,
 * scheduled 3, 10 and 30 days after the module (ch13 T7). Answer, see the
 * reasoning, then rate recall; ratings tune the schedule. Answering every
 * question finishes the module; an unrated answer counts as its result.
 */
export function ReviewStage({ block, ...nav }: StageProps<ReviewBlock>) {
  const signal = useSignal();
  const t = useTranslations("player");
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
      <ReflectionReview />
      <Callout tone="review" label={t("scheduleLabel")} icon={<CalendarClock />}>
        <p className="text-sm">{t("scheduleBodyDays", { a: days[0] ?? 3, b: days[1] ?? 10, c: days[2] ?? 30 })}</p>
      </Callout>

      {block.variants.map((v) => (
        <ReviewCard
          key={v.id}
          variant={v}
          onAnswered={(yes,correct) => { setAnswered((s) => ({ ...s, [v.id]: yes })); if (yes) signal({ kind: "recall_answer",moduleId: block.step_id.split(".")[0],payload: { variantId: v.id,correct } }); }}
        />
      ))}
    </StageShell>
  );
}

function ReviewCard({
  variant,
  onAnswered,
}: {
  variant: ReviewVariant;
  onAnswered: (answered: boolean,correct: boolean) => void;
}) {
  const t = useTranslations("player");
  const [value, setValue] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState(false);
  const chosen = variant.options.find((o) => o.id === value[0]);
  const correct = !!chosen?.correct;
  const id = `review-${variant.id}`;

  return (
    <Surface id={`review-${variant.after_days}`} pad="md" className="flex scroll-mt-28 flex-col gap-3">
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
          onAnswered(false,false);
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
            onAnswered(true,correct);
          }}
        >
          {t("checkAnswer")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Feedback ok={correct} title={correct ? t("correct") : t("notYet")}>
            {chosen?.rationale}
          </Feedback>
          <ReviewRecall interval={variant.after_days} correct={correct} />
        </div>
      )}
    </Surface>
  );
}
