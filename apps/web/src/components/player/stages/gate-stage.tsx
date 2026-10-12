"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Clock, EyeOff, Loader2, RotateCcw, ShieldCheck, Target, X } from "lucide-react";
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
import { DEMO_OPEN } from "@/lib/demo";
import type { GateBlock, GateItem, Objective } from "@/data/types";
import type { StageProps } from "./types";

type Phase = "intro" | "running" | "submitting" | "result";

/**
 * A summative check: the check that closes each module, and the course's
 * final check after the capstone. Pass/fail (ch13 T5): no feedback until
 * submit, 80% overall (the final check also wants one right per module),
 * links back to what to revisit, retakes allowed. Answers never appear in the
 * UI data; explanations show once it is passed. The demo lets a learner move
 * on without passing.
 */
export function GateStage({
  block,
  objectives,
  checkId,
  remediationHref,
  preview,
  onGraded,
  scope = "course",
  slides = false,
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
  /** a module's closing check, or the course's final check */
  scope?: "module" | "course";
  /** final check only: one question per slide, answered → next, like a deck */
  slides?: boolean;
}) {
  const t = useTranslations("player");
  const forModule = scope === "module";
  const [phase, setPhase] = React.useState<Phase>(nav.done ? "result" : "intro");
  const [responses, setResponses] = React.useState<Record<string, GateResponse>>({});
  const [result, setResult] = React.useState<GateResult | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const tested = objectives.filter((o) => block.objectives_tested.includes(o.id));
  const answeredCount = block.items.filter((i) => isAnswered(responses[i.id])).length;

  async function submit() {
    setConfirm(false);
    setPhase("submitting");
    const r = await gradeGate(checkId, block, responses);
    onGraded?.(r);
    setResult(r);
    setPhase("result");
  }

  /** unanswered questions are caught by the confirm dialog before submitting */
  function requestSubmit() {
    if (answeredCount < block.items.length) setConfirm(true);
    else void submit();
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
            <Rule
              icon={<ShieldCheck />}
              text={t(block.min_correct_per_objective > 0 ? "gatePass" : "gatePassOverall", { percent: Math.round(block.pass_threshold * 100) })}
            />
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
            {forModule ? t("gateStartModule") : t("gateStart")}
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
        scope={scope}
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
      {slides ? (
        <GateSlides
          block={block}
          responses={responses}
          submitting={phase === "submitting"}
          onChange={(id, v) => setResponses((r) => ({ ...r, [id]: v }))}
          onRequestSubmit={requestSubmit}
        />
      ) : (
        <>
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
              onClick={requestSubmit}
            >
              {phase === "submitting" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {phase === "submitting" ? t("gateGrading") : t("gateSubmit")}
            </Button>
          </div>
        </>
      )}

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

/** A response counts as answered when it has content: picks, or a trimmed string. */
function isAnswered(v: GateResponse | undefined): boolean {
  return Array.isArray(v) ? v.length > 0 : !!v?.trim();
}

/**
 * The final check as a deck: one question per slide, so a twelve-question exam
 * reads like a presentation instead of a scrolling form. Answering a
 * single-choice question turns the slide on its own (multi-select and fill-in
 * need a deliberate Next, since their answers are more than one gesture).
 * Previous and the dot rail allow revising anything before submitting — still
 * no correctness feedback until then, by gate rule. The dots only ever show
 * which questions have an answer, never whether it is right.
 */
function GateSlides({
  block,
  responses,
  submitting,
  onChange,
  onRequestSubmit,
}: {
  block: GateBlock;
  responses: Record<string, GateResponse>;
  submitting: boolean;
  onChange: (id: string, v: GateResponse) => void;
  onRequestSubmit: () => void;
}) {
  const t = useTranslations("player");
  const items = block.items;
  const [index, setIndex] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const timer = React.useRef<number | null>(null);
  const slideEl = React.useRef<HTMLDivElement | null>(null);
  const firstRender = React.useRef(true);
  const answeredCount = items.filter((i) => isAnswered(responses[i.id])).length;
  const last = index === items.length - 1;
  const item = items[index]!;

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  // popLayout keeps the entering slide in the tree at once, so focus can move
  // as soon as the index changes instead of waiting an animation out.
  React.useEffect(() => {
    if (firstRender.current) {
      // when the gate opens, the player has already focused the stage
      firstRender.current = false;
      return;
    }
    slideEl.current?.focus({ preventScroll: true });
  }, [index]);

  function clearTimer() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function go(n: number) {
    const next = Math.max(0, Math.min(items.length - 1, n));
    if (next === index) return;
    clearTimer();
    setDir(next > index ? 1 : -1);
    setIndex(next);
  }

  function answer(next: GateItem, v: GateResponse) {
    // auto-advance only on a first answer: revisiting a slide means the learner
    // is revising it, and the deck should not pull them forward mid-thought
    const first = !isAnswered(responses[next.id]);
    onChange(next.id, v);
    if (first && next.kind === "mc" && !last && !submitting) {
      clearTimer();
      // let the picked option's highlight land before the slide turns
      timer.current = window.setTimeout(() => go(index + 1), 300);
    }
  }

  return (
    <>
      <div className="sticky top-(--nav-h) z-10 -mx-1 flex flex-col gap-2 rounded-lg bg-canvas/90 px-1 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ProgressBar
            value={(index + 1) / items.length}
            tone="ink"
            size="sm"
            aria-label={t("gateQuestionOf", { n: index + 1, total: items.length })}
          />
          <span className="shrink-0 text-sm text-ink-muted tabular-nums">
            {t("gateQuestionOf", { n: index + 1, total: items.length })}
          </span>
        </div>
        <div role="group" aria-label={t("gateDotsLabel")} className="flex flex-wrap items-center gap-1.5">
          {items.map((it, i) => {
            const answered = isAnswered(responses[it.id]);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => go(i)}
                disabled={submitting}
                aria-current={i === index ? "step" : undefined}
                aria-label={`${t("gateQuestionN", { n: i + 1 })}${answered ? `, ${t("gateDotAnswered")}` : ""}`}
                className={cn(
                  "size-2.5 rounded-full border transition-colors duration-(--dur-1)",
                  i === index
                    ? "border-brand bg-brand"
                    : answered
                      ? "border-brand/40 bg-brand/50"
                      : "border-line bg-transparent hover:border-brand-line",
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[16rem]">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={item.id}
            custom={dir}
            ref={slideEl}
            role="group"
            tabIndex={-1}
            aria-label={t("gateQuestionOf", { n: index + 1, total: items.length })}
            initial={{ opacity: 0, x: 28 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 * dir }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="outline-none"
          >
            <GateQuestion
              item={item}
              index={index}
              value={responses[item.id]}
              disabled={submitting}
              onChange={(v) => answer(item, v)}
              onEnterPress={last ? onRequestSubmit : () => go(index + 1)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {index > 0 ? (
          <Button variant="ghost" onClick={() => go(index - 1)} disabled={submitting}>
            <ArrowLeft data-icon="inline-start" />
            {t("gatePrev")}
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          <Button size="lg" variant="brand" disabled={submitting || answeredCount === 0} onClick={onRequestSubmit}>
            {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {submitting ? t("gateGrading") : t("gateSubmit")}
          </Button>
        ) : (
          <Button size="lg" variant="brand" onClick={() => go(index + 1)} disabled={submitting}>
            {t("gateNext")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </>
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
  onEnterPress,
}: {
  item: GateItem;
  index: number;
  value: GateResponse;
  disabled?: boolean;
  onChange: (v: GateResponse) => void;
  /** slide mode: Enter in a fill-in turns the slide instead of a button click */
  onEnterPress?: () => void;
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnterPress) {
                e.preventDefault();
                onEnterPress();
              }
            }}
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
  scope,
  onContinue,
  onRetry,
}: {
  block: GateBlock;
  objectives: Objective[];
  result: GateResult | null;
  remediationHref: (stepId: string) => string;
  scope: "module" | "course";
  onContinue: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("player");
  const forModule = scope === "module";
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
          <p className="text-lg font-semibold">{passed ? (forModule ? t("gatePassedBodyModule") : t("gatePassedBody")) : t("gateFailedBody")}</p>
          <p className="mt-1 text-ink-muted">
            {passed
              ? forModule
                ? t("gatePassedNextModule")
                : t("gatePassedNext")
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
              const ok = o.correct >= Math.max(1, block.min_correct_per_objective);
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
        {passed || DEMO_OPEN ? (
          <Button size="lg" variant={passed ? "brand" : "outline"} onClick={onContinue}>
            {passed ? t("completeContinue") : t("continueAnyway")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </StageShell>
  );
}
