"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Compass, RotateCcw, ScrollText } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { ChoiceList, TieredHints } from "@/components/player/items";
import { useCompanionStep, useLearningContext } from "@/components/learning/course-companion";
import { recordLearning } from "@/lib/learning-state";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import type { Support } from "@/lib/setup";
import type { Scenario, ScenarioBlock } from "@/data/types";
import type { StageProps } from "./types";

type Decisions = Record<string, { choice: string; committed: boolean }>;
/** One situation at a time, with a visible consequence and a deliberate retry loop. */
export function ScenarioStage({ block, support, ...nav }: StageProps<ScenarioBlock> & { support: Support }) {
  const t = useTranslations("player");
  const context = useLearningContext();
  const key = `lms-decisions:v1:${context?.courseId ?? "course"}:${block.step_id}`;
  const decisions = useLocalJson<Decisions>(key, {});
  const [index, setIndex] = React.useState(0);
  const s = block.scenarios[index]!;
  const left = block.scenarios.filter((s) => !decisions[s.id]?.committed).length;
  useCompanionStep({ title: s.title, phase: "lab", guidance: `${s.situation} Inspect the evidence, choose an action, and compare its consequence with your expectation.`, hint: s.question.hints[0] });
  return <StageShell stage="lab" title={block.title} intro={block.intro} minutes={block.duration_min} bloom={block.bloom} canComplete={left === 0 || nav.done} completeHint={t("scenariosLeft", { count: left })} {...nav}>
    <nav className="flex flex-wrap gap-2" aria-label="Scenario cases">{block.scenarios.map((item, i) => <Button key={item.id} size="sm" variant={index === i ? "brand" : "outline"} onClick={() => setIndex(i)} aria-current={index === i ? "step" : undefined}>{decisions[item.id]?.committed ? <Check /> : <Compass />}Case {i + 1}</Button>)}</nav>
    <ScenarioCard key={s.id} scenario={s} n={index + 1} total={block.scenarios.length} support={support} saved={decisions[s.id]} onSave={(choice, committed, helped) => {
      writeLocal(key, JSON.stringify({ ...decisions, [s.id]: { choice, committed } }));
      if (committed && context) recordLearning(context.courseId, { id: s.question.step_id, moduleId: context.moduleId, correct: !!s.question.options.find((o) => o.id === choice)?.correct, helped });
    }} />
    <div className="flex justify-between gap-3"><Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft />Previous case</Button><Button variant="outline" disabled={index === block.scenarios.length - 1 || !decisions[s.id]?.committed} onClick={() => setIndex(index + 1)}>Next case<ArrowRight /></Button></div>
  </StageShell>;
}

function ScenarioCard({ scenario: s, n, total, support, saved, onSave }: { scenario: Scenario; n: number; total: number; support: Support; saved?: { choice: string; committed: boolean }; onSave: (choice: string, committed: boolean, helped: boolean) => void }) {
  const t = useTranslations("player");
  const [choice, setChoice] = React.useState(saved?.choice ?? "");
  const [showHints, setShowHints] = React.useState(support === "extra");
  const [evidenceOpen, setEvidenceOpen] = React.useState(support !== "light");
  const [seenFeedback, setSeenFeedback] = React.useState(!!saved?.committed);
  const committed = saved?.committed && saved.choice === choice;
  const option = s.question.options.find((o) => o.id === choice);
  return <Surface pad="none" className="focus-split overflow-hidden">
    <section className="focus-pane flex flex-col gap-4 p-5">
      <div className="flex flex-wrap gap-2"><Chip size="sm" tone="lab" icon={<Compass />}>{t("scenarioOf", { n, total })}</Chip><Chip size="sm">{t("scenarioLesson", { lesson: s.lesson })}</Chip></div>
      <div><h2 className="text-xl font-semibold">{s.title}</h2><p className="mt-3 leading-relaxed text-ink-muted">{s.situation}</p></div>
      {s.context && <details className="rounded-xl border border-line bg-panel-2 p-4" open={evidenceOpen} onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}><summary className="cursor-pointer text-xs font-semibold"><ScrollText className="mr-2 inline size-4" />Inspect the evidence · {s.context.label}</summary><pre className="focus-pane-scroll mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed">{s.context.lines.join("\n")}</pre></details>}
    </section>
    <section className="focus-pane flex flex-col gap-4 border-l border-line bg-panel-2/35 p-5 max-[700px]:border-t max-[700px]:border-l-0">
      <p id={`${s.id}-decision`} className="font-medium">{s.question.stem}</p>
      <ChoiceList name={s.id} labelledBy={`${s.id}-decision`} options={s.question.options} value={choice ? [choice] : []} disabled={!!committed} onChange={(v) => setChoice(v[0] ?? "")} />
      {!committed ? <><div className="flex flex-wrap gap-2"><Button variant="brand" disabled={!choice} onClick={() => { onSave(choice, true, showHints || seenFeedback); setSeenFeedback(true); }}>Make my decision<ArrowRight /></Button>{!showHints ? <Button variant="ghost" onClick={() => setShowHints(true)}>Give me a nudge</Button> : null}</div>{showHints && <TieredHints hints={s.question.hints} initialShown={support === "extra" ? 1 : 0} />}</> : <>
        <Callout tone="lab" label={option?.correct ? "Your decision holds up" : "A consequence to think through"} icon={<Compass />}><p className="leading-relaxed">{option?.rationale ?? s.debrief}</p></Callout>
        <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium">Compare with an experienced builder</summary><p className="mt-3 text-sm leading-relaxed text-ink-muted">{s.debrief}</p></details>
        <Button variant="outline" className="w-fit" onClick={() => onSave(choice, false, showHints)}><RotateCcw />Try another decision</Button>
      </>}
    </section>
  </Surface>;
}
