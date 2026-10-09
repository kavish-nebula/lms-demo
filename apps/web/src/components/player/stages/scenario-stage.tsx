"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Compass, ScrollText } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { McQuestion, TieredHints } from "@/components/player/items";
import { useSignal } from "@/lib/signals";
import type { Scenario, ScenarioBlock } from "@/data/types";
import type { StageProps } from "./types";

/**
 * Stage 5. Scenarios: situations the learner has not seen, each with evidence
 * (a trace, a log, a chat) and a decision to make. Every option explains
 * itself, and the debrief says what an experienced builder would do. Answering
 * all of them finishes the topic; a wrong answer can be changed and checked again.
 * The first answer to each scenario goes to the learner's plan as evidence.
 */
export function ScenarioStage({ block, moduleId, ...nav }: StageProps<ScenarioBlock> & { moduleId: string }) {
  const t = useTranslations("player");
  const [answered, setAnswered] = React.useState<Record<string, boolean>>({});
  const left = block.scenarios.filter((s) => !answered[s.id]).length;

  return (
    <StageShell
      stage="lab"
      title={block.title}
      intro={block.intro}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={left === 0 || nav.done}
      completeHint={t("scenariosLeft", { count: left })}
      {...nav}
    >
      {block.scenarios.map((s, i) => (
        <ScenarioCard
          key={s.id}
          scenario={s}
          moduleId={moduleId}
          n={i + 1}
          total={block.scenarios.length}
          onAnswered={() => setAnswered((a) => (a[s.id] ? a : { ...a, [s.id]: true }))}
          answered={!!answered[s.id]}
        />
      ))}
    </StageShell>
  );
}

function ScenarioCard({
  scenario: s,
  moduleId,
  n,
  total,
  answered,
  onAnswered,
}: {
  scenario: Scenario;
  moduleId: string;
  n: number;
  total: number;
  answered: boolean;
  onAnswered: () => void;
}) {
  const t = useTranslations("player");
  const signal = useSignal();
  const reported = React.useRef(false);
  const onCheck = (correct: boolean) => {
    if (!reported.current) {
      reported.current = true;
      signal({ kind: "scenario_answer", moduleId, lesson: s.lesson, payload: { scenarioId: s.id, correct } });
    }
    onAnswered();
  };
  return (
    <Surface pad="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" tone="lab" icon={<Compass />}>
          {t("scenarioOf", { n, total })}
        </Chip>
        <Chip size="sm">{t("scenarioLesson", { lesson: s.lesson })}</Chip>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{s.title}</h2>
        <p className="leading-relaxed text-pretty">{s.situation}</p>
      </div>
      {s.context ? (
        <figure className="flex flex-col gap-1.5">
          <figcaption className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            <ScrollText className="size-3.5" aria-hidden />
            {s.context.label}
          </figcaption>
          <pre className="overflow-x-auto rounded-lg border border-line bg-panel-2 px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
            {s.context.lines.join("\n")}
          </pre>
        </figure>
      ) : null}
      <McQuestion id={s.question.step_id} stem={s.question.stem} options={s.question.options} onAnswered={onCheck} />
      {!answered && s.question.hints.length ? <TieredHints hints={s.question.hints} /> : null}
      {answered ? (
        <Callout tone="lab" label={t("scenarioDebrief")} icon={<Compass />}>
          <p className="leading-relaxed">{s.debrief}</p>
        </Callout>
      ) : null}
    </Surface>
  );
}
