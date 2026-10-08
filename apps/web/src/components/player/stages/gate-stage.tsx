"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Clock, EyeOff, Loader2, RotateCcw, ShieldCheck, Target, X } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { ProgressBar, ProgressRing } from "@/components/kit/progress-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageShell } from "@/components/player/stage-shell";
import { ChoiceList } from "@/components/player/items";
import { gradeGate, type GateResponse, type GateResult } from "@/data/mock-grader";
import type { GateBlock, GateItem, Objective } from "@/data/types";
import type { StageProps } from "./types";

type Phase = "intro" | "running" | "submitting" | "result";

/**
 * The course's final check, after the capstone. Summative and pass/fail
 * (ch13 T5): no feedback until submit, 80% overall plus at least one correct
 * per lesson, links back to the lessons to revisit, retakes allowed.
 * Answers never appear in the UI data; explanations show once it is passed.
 */
export function GateStage({
  block,
  objectives,
  checkId,
  remediationHref,
  preview,
  onGraded,
  ...nav
}: StageProps<GateBlock> & {
  objectives: Objective[];
  /** which answer key grades this check */
  checkId: string;
  /** where a "revisit" link for a lesson step id goes */
  remediationHref: (stepId: string) => string;
  /** locked: show what it covers, but it cannot be started */
  preview?: boolean;
  onGraded?: (result: GateResult) => void;
}) {
  const t = useTranslations("player");
  const [phase, setPhase] = React.useState<Phase>(nav.done ? "result" : "intro");
  const [responses, setResponses] = React.useState<Record<string, GateResponse>>({});
  const [result, setResult] = React.useState<GateResult | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const tested = objectives.filter((o) => block.objectives_tested.includes(o.id));
  const answeredCount = block.items.filter((i) => {
    const r = responses[i.id];
    return Array.isArray(r) ? r.length > 0 : !!r?.trim();
  }).length;

  async function submit() {
    setConfirm(false);
    setPhase("submitting");
    const r = await gradeGate(checkId, block, responses);
    onGraded?.(r);
    setResult(r);
    setPhase("result");
  }

  if (phase === "intro") {
    return (
      <StageShell stage="gate" title={t("gateIntroTitle")} minutes={block.duration_min} bloom={block.bloom} hideFooter>
        <Surface pad="lg" className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Target className="size-4 text-stage-gate" aria-hidden />
              {t("gateObjectives")}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {tested.map((o) => (
                <li key={o.id} className="flex items-start gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-stage-gate" />
                  {o.text}
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            <Rule icon={<ShieldCheck />} text={t("gatePass", { percent: Math.round(block.pass_threshold * 100) })} />
            <Rule icon={<EyeOff />} text={t("gateNoFeedback")} />
            <Rule icon={<RotateCcw />} text={t("gateRetry", { hours: block.retry_policy.wait_hours })} />
            <Rule icon={<Clock />} text={t("gateLength", { count: block.items.length, minutes: block.duration_min })} />
          </ul>
          <p className="text-sm text-ink-faint">{t("gateTutorOff")}</p>
        </Surface>
        <div className="flex flex-wrap justify-between gap-3">
          {nav.onPrev ? (
            <Button variant="ghost" onClick={nav.onPrev}>
              {t("notReady")}
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" variant="brand" disabled={preview} onClick={() => setPhase("running")}>
            {t("gateStart")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </StageShell>
    );
  }

  if (phase === "result" && (result || nav.done)) {
    return (
      <GateResultView
        block={block}
        objectives={tested}
        result={result}
        remediationHref={remediationHref}
        onContinue={nav.onComplete}
        onRetry={() => {
          setResponses({});
          setResult(null);
          setPhase("intro");
        }}
      />
    );
  }

  return (
    <StageShell stage="gate" title={t("gateIntroTitle")} minutes={block.duration_min} hideFooter>
      <div className="sticky top-(--nav-h) z-10 -mx-1 flex items-center gap-3 rounded-lg bg-canvas/90 px-1 py-2 backdrop-blur-sm">
        <ProgressBar value={answeredCount / block.items.length} tone="ink" size="sm" aria-label={t("answeredOf", { done: answeredCount, total: block.items.length })} />
        <span className="shrink-0 text-sm text-ink-muted tabular-nums">
          {t("answeredOf", { done: answeredCount, total: block.items.length })}
        </span>
      </div>

      <ol className="flex flex-col gap-4">
        {block.items.map((item, i) => (
          <li key={item.id}>
            <GateQuestion
              item={item}
              index={i}
              value={responses[item.id]}
              disabled={phase === "submitting"}
              onChange={(v) => setResponses((r) => ({ ...r, [item.id]: v }))}
            />
          </li>
        ))}
      </ol>

      <div className="flex justify-end">
        <Button
          size="lg"
          variant="brand"
          disabled={phase === "submitting" || answeredCount === 0}
          onClick={() => (answeredCount < block.items.length ? setConfirm(true) : submit())}
        >
          {phase === "submitting" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {phase === "submitting" ? t("gateGrading") : t("gateSubmit")}
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("gateUnansweredTitle")}</DialogTitle>
            <DialogDescription>
              {t("gateUnansweredBody", { count: block.items.length - answeredCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("keepAnswering")}</Button>
            </DialogClose>
            <Button onClick={submit}>{t("submitAnyway")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StageShell>
  );
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-line bg-panel-2/60 p-3 text-sm">
      <span className="mt-0.5 shrink-0 text-stage-gate [&_svg]:size-4">{icon}</span>
      {text}
    </li>
  );
}

function GateQuestion({
  item,
  index,
  value,
  disabled,
  onChange,
}: {
  item: GateItem;
  index: number;
  value: GateResponse;
  disabled?: boolean;
  onChange: (v: GateResponse) => void;
}) {
  const t = useTranslations("player");
  const id = `gate-${item.id}`;
  return (
    <Surface pad="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-ink-faint tabular-nums">Q{index + 1}</span>
        {item.interleaved_from ? <Chip size="sm" tone="review">{t("fromModule", { module: item.interleaved_from })}</Chip> : null}
        {item.lessons?.length ? <Chip size="sm" tone="review">{t("fromLessons", { list: item.lessons.join(" · ") })}</Chip> : null}
        {item.transfer ? <Chip size="sm" tone="info">{t("scenarioChip")}</Chip> : null}
        {item.kind === "multi" ? <Chip size="sm">{t("selectAll")}</Chip> : null}
      </div>
      {item.kind === "fill" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-base font-medium">
            {item.stem}
          </Label>
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            placeholder={item.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="max-w-xs font-mono"
            autoComplete="off"
          />
        </div>
      ) : (
        <>
          <p id={`${id}-stem`} className="font-medium">
            {item.stem}
          </p>
          <ChoiceList
            name={id}
            labelledBy={`${id}-stem`}
            options={item.options ?? []}
            multiple={item.kind === "multi"}
            disabled={disabled}
            value={Array.isArray(value) ? value : value ? [value] : []}
            onChange={(v) => onChange(item.kind === "multi" ? v : v[0])}
          />
        </>
      )}
    </Surface>
  );
}

function GateResultView({
  block,
  objectives,
  result,
  remediationHref,
  onContinue,
  onRetry,
}: {
  block: GateBlock;
  objectives: Objective[];
  result: GateResult | null;
  remediationHref: (stepId: string) => string;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("player");
  // Revisiting a passed gate: no stored attempt in the UI phase, show the pass state only.
  const passed = result ? result.passed : true;

  return (
    <StageShell stage="gate" title={passed ? t("gatePassed") : t("gateFailed")} hideFooter done={passed}>
      <Surface
        pad="lg"
        tone={passed ? "default" : "default"}
        className={cn("flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left", passed ? "border-ok-line" : "border-warn-line")}
      >
        {result ? (
          <ProgressRing
            value={result.ratio}
            size={96}
            stroke={8}
            tone={passed ? "ok" : "amber"}
            label={`${result.score}/${result.total}`}
            aria-label={t("scoreOf", { score: result.score, total: result.total })}
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-lg font-semibold">{passed ? t("gatePassedBody") : t("gateFailedBody")}</p>
          <p className="mt-1 text-ink-muted">
            {passed
              ? t("gatePassedNext")
              : t("gateRetry", { hours: block.retry_policy.wait_hours })}
          </p>
        </div>
      </Surface>

      {result ? (
        <Surface pad="md" className="flex flex-col gap-4">
          <h2 className="font-semibold">{t("byObjective")}</h2>
          <ul className="flex flex-col gap-3">
            {result.perObjective.map((o) => {
              const obj = objectives.find((x) => x.id === o.objective_id);
              const ok = o.correct >= block.min_correct_per_objective;
              return (
                <li key={o.objective_id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{obj?.text ?? o.objective_id}</span>
                    <span className={cn("shrink-0 tabular-nums", ok ? "text-ok" : "text-warn")}>
                      {o.correct}/{o.total}
                    </span>
                  </div>
                  <ProgressBar value={o.total ? o.correct / o.total : 0} size="sm" tone={ok ? "ok" : "amber"} />
                </li>
              );
            })}
          </ul>
        </Surface>
      ) : null}

      {result && !passed && result.failedObjectives.length ? (
        <Surface pad="md" className="flex flex-col gap-3">
          <h2 className="font-semibold">{t("remediation")}</h2>
          <ul className="flex flex-col gap-2">
            {result.failedObjectives.map((id) => {
              const r = block.remediation[id];
              const obj = objectives.find((o) => o.id === id);
              return r ? (
                <li key={id}>
                  <Link
                    href={remediationHref(r.step_id)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-sm hover:border-brand-line"
                  >
                    <span>
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-ink-faint">{obj?.text}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </Surface>
      ) : null}

      {result && passed && result.review.some((x) => x.explain) ? (
        <Surface pad="md" className="flex flex-col gap-3">
          <h2 className="font-semibold">{t("whyEachAnswer")}</h2>
          <ol className="flex flex-col gap-3">
            {block.items.map((item, i) => {
              const r = result.review.find((x) => x.id === item.id);
              if (!r?.explain) return null;
              return (
                <li key={item.id} className="flex gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3",
                      r.correct ? "bg-ok text-on-ok" : "bg-warn-soft text-warn",
                    )}
                    aria-label={r.correct ? t("correct") : t("notYet")}
                  >
                    {r.correct ? <Check /> : <X />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">
                      Q{i + 1}. {item.stem}
                    </span>
                    <span className="mt-0.5 block text-ink-muted">{r.explain}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Surface>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        {!passed ? (
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw data-icon="inline-start" />
            {t("retryDemo")}
          </Button>
        ) : null}
        {passed ? (
          <Button size="lg" variant="brand" onClick={onContinue}>
            {t("completeContinue")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </StageShell>
  );
}
