"use client";

/**
 * Question and practice primitives shared by concept checks, guided practice
 * and the mastery gate. Feedback is instant (ch13: within 2 seconds) and never
 * just "wrong": every option carries a rationale where the content has one.
 */
import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { CheckCircle2, CircleAlert, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Option } from "@/data/types";

/* ---------------------------------------------------------------- feedback */

export function Feedback({
  ok,
  title,
  children,
  className,
}: {
  ok: boolean;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        ok ? "border-ok-line bg-ok-soft" : "border-warn-line bg-warn-soft",
        className,
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      )}
      <div className="min-w-0">
        <div className={cn("font-semibold", ok ? "text-ok" : "text-warn")}>{title}</div>
        {children ? <div className="mt-0.5 text-ink">{children}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- choice list */

type ChoiceListProps = {
  name: string;
  options: { id: string; text: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** after checking: mark options correct / incorrect */
  marks?: Record<string, "correct" | "incorrect" | undefined>;
  labelledBy?: string;
};

/** Accessible single or multiple choice list with large hit targets. */
export function ChoiceList({ name, options, value, onChange, multiple, disabled, marks, labelledBy }: ChoiceListProps) {
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-labelledby={labelledBy} className="flex flex-col gap-2">
      {options.map((o, i) => {
        const checked = value.includes(o.id);
        const mark = marks?.[o.id];
        const id = `${name}-${o.id}`;
        return (
          <label
            key={o.id}
            htmlFor={id}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-(--dur-1)",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60",
              mark === "correct"
                ? "border-ok-line bg-ok-soft"
                : mark === "incorrect"
                  ? "border-warn-line bg-warn-soft"
                  : checked
                    ? "border-brand-line bg-brand-soft"
                    : "border-line bg-panel hover:border-brand-line",
              disabled && "cursor-default",
            )}
          >
            {multiple ? (
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(c) =>
                  onChange(c ? [...value, o.id] : value.filter((v) => v !== o.id))
                }
              />
            ) : (
              <input
                id={id}
                type="radio"
                name={name}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange([o.id])}
                className="size-4 shrink-0 accent-[var(--accent-deep)]"
              />
            )}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-panel-2 font-mono text-xs text-ink-muted">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="font-mono">{o.text}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- MC with rationale */

export function McQuestion({
  id,
  stem,
  options,
  onAnswered,
  checkLabel,
}: {
  id: string;
  stem: string;
  options: Option[];
  onAnswered?: (correct: boolean) => void;
  checkLabel?: string;
}) {
  const t = useTranslations("player");
  const [value, setValue] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState(false);
  const chosen = options.find((o) => o.id === value[0]);
  const correct = !!chosen?.correct;

  return (
    <div className="flex flex-col gap-3">
      <p id={`${id}-stem`} className="font-medium">
        {stem}
      </p>
      <ChoiceList
        name={id}
        labelledBy={`${id}-stem`}
        options={options}
        value={value}
        onChange={(v) => {
          setValue(v);
          setChecked(false);
        }}
        marks={checked && chosen ? { [chosen.id]: correct ? "correct" : "incorrect" } : undefined}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={!value.length}
          onClick={() => {
            setChecked(true);
            onAnswered?.(correct);
          }}
        >
          {checkLabel ?? t("checkAnswer")}
        </Button>
      </div>
      {checked && chosen ? (
        <Feedback ok={correct} title={correct ? t("correct") : t("notYet")}>
          {chosen.rationale}
        </Feedback>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- fill in */

export function FillQuestion({
  id,
  stem,
  answers,
  feedbackCorrect,
  feedbackWrong,
  onAnswered,
}: {
  id: string;
  stem: string;
  answers: string[];
  feedbackCorrect: string;
  feedbackWrong: string;
  onAnswered?: (correct: boolean) => void;
}) {
  const t = useTranslations("player");
  const [value, setValue] = React.useState("");
  const [result, setResult] = React.useState<boolean | null>(null);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function check() {
    const ok = answers.some((a) => norm(a) === norm(value));
    setResult(ok);
    onAnswered?.(ok);
  }

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={id} className="text-base font-medium">
        {stem}
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) check();
          }}
          className="max-w-xs font-mono"
          autoComplete="off"
        />
        <Button variant="outline" disabled={!value.trim()} onClick={check}>
          {t("checkAnswer")}
        </Button>
      </div>
      {result != null ? (
        <Feedback ok={result} title={result ? t("correct") : t("notYet")}>
          {result ? feedbackCorrect : feedbackWrong}
        </Feedback>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- match */

/**
 * Matching item. Rendered with selects rather than drag and drop so it works
 * with keyboard and screen readers; drag can be layered on later.
 */
export function MatchQuestion({
  id,
  stem,
  pairs,
  onAnswered,
}: {
  id: string;
  stem: string;
  pairs: { left: string; right: string }[];
  onAnswered?: (correct: boolean) => void;
}) {
  const t = useTranslations("player");
  const rights = React.useMemo(() => [...new Set(pairs.map((p) => p.right))].sort(), [pairs]);
  const [picks, setPicks] = React.useState<Record<string, string>>({});
  const [checked, setChecked] = React.useState(false);
  const allPicked = pairs.every((p) => picks[p.left]);
  const correctCount = pairs.filter((p) => picks[p.left] === p.right).length;

  return (
    <div className="flex flex-col gap-3">
      <p id={`${id}-stem`} className="font-medium">
        {stem}
      </p>
      <ul className="flex flex-col gap-2" aria-labelledby={`${id}-stem`}>
        {pairs.map((p, i) => {
          const ok = picks[p.left] === p.right;
          return (
            <li
              key={p.left}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-panel px-3.5 py-2",
                checked ? (ok ? "border-ok-line bg-ok-soft" : "border-warn-line bg-warn-soft") : "border-line",
              )}
            >
              <span id={`${id}-l${i}`} className="font-mono text-sm">
                {p.left}
              </span>
              <Select
                value={picks[p.left] ?? ""}
                onValueChange={(v) => {
                  setPicks((s) => ({ ...s, [p.left]: v }));
                  setChecked(false);
                }}
              >
                <SelectTrigger className="w-32 font-mono" aria-labelledby={`${id}-l${i}`}>
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  {rights.map((r) => (
                    <SelectItem key={r} value={r} className="font-mono">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
      <Button
        variant="outline"
        className="w-fit"
        disabled={!allPicked}
        onClick={() => {
          setChecked(true);
          onAnswered?.(correctCount === pairs.length);
        }}
      >
        {t("checkAnswer")}
      </Button>
      {checked ? (
        <Feedback
          ok={correctCount === pairs.length}
          title={correctCount === pairs.length ? t("correct") : t("matchedSome", { count: correctCount, total: pairs.length })}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- code (self-check) */

/**
 * Code practice item. Until the sandboxed runner exists, the learner runs the
 * code themselves and compares with the expected output (follow-along check).
 */
export function CodeQuestion({
  id,
  stem,
  starter,
  expectedOutput,
  wrongHint,
  onAnswered,
}: {
  id: string;
  stem: string;
  starter: string;
  expectedOutput: string;
  wrongHint?: string;
  onAnswered?: (correct: boolean) => void;
}) {
  const t = useTranslations("player");
  const [code, setCode] = React.useState(starter);
  const [revealed, setRevealed] = React.useState(false);
  const [verdict, setVerdict] = React.useState<boolean | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={id} className="text-base font-medium">
        {stem}
      </Label>
      <Textarea
        id={id}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={4}
        className="bg-plum font-mono text-sm text-[#efeefe] caret-teal"
      />
      {!revealed ? (
        <Button variant="outline" className="w-fit" onClick={() => setRevealed(true)}>
          {t("compareOutput")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel-2/60 p-3">
          <div className="text-sm">
            {t("expectedOutput")}{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-sm">{expectedOutput}</code>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setVerdict(true);
                onAnswered?.(true);
              }}
            >
              {t("outputMatches")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVerdict(false);
                onAnswered?.(false);
              }}
            >
              {t("outputDiffers")}
            </Button>
          </div>
        </div>
      )}
      {verdict != null ? (
        <Feedback ok={verdict} title={verdict ? t("correct") : t("notYet")}>
          {verdict ? t("codeCorrect") : (wrongHint ?? t("codeWrong"))}
        </Feedback>
      ) : null}
      <p className="text-xs text-ink-faint">{t("runnerNote")}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- tiered hints */

/** Hint 1 → 2 → 3, revealed one at a time. Hint use is a behavioural signal. */
export function TieredHints({ hints, onReveal }: { hints: string[]; onReveal?: (level: number) => void }) {
  const t = useTranslations("player");
  const [shown, setShown] = React.useState(0);
  if (!hints.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {hints.slice(0, shown).map((h, i) => (
        <div key={i} className="flex gap-2.5 rounded-lg border border-stage-guided-line bg-stage-guided-soft p-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-stage-guided" aria-hidden />
          <div>
            <div className="text-xs font-semibold text-stage-guided">{t("hintN", { n: i + 1, total: hints.length })}</div>
            <div className="mt-0.5 whitespace-pre-wrap">{h}</div>
          </div>
        </div>
      ))}
      {shown < hints.length ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit text-stage-guided"
          onClick={() => {
            setShown((s) => s + 1);
            onReveal?.(shown + 1);
          }}
        >
          <Lightbulb data-icon="inline-start" />
          {shown === 0 ? t("showHint") : t("nextHint")}
        </Button>
      ) : null}
    </div>
  );
}
