"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Globe2, Pencil, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/kit/surface";
import { LessonOrderPreview } from "@/components/enroll/lesson-order-preview";
import {
  COMFORT_QUESTION,
  QUESTIONS,
  adaptationOf,
  answerLabel,
  changeFor,
  comfortChange,
  comfortLabel,
  type SetupAnswers,
} from "@/lib/setup";
import { ROLE_HOOK, WORLD } from "@/lib/world";

type Q = { id: string; label: string; q: string; options: { v: string; label: string; free?: string }[]; multi?: boolean };
const ALL: Q[] = [...QUESTIONS, { ...COMFORT_QUESTION, multi: true }];

/**
 * "About you": the seven profile questions, one per screen, each skippable.
 * A live panel shows what every answer changes; the last screen sums it up.
 * Asked once; later courses reuse the saved profile.
 */
export function ProfileStep({
  name,
  answers,
  setAnswers,
  needs,
  setNeeds,
  continueLabel,
  onDone,
}: {
  name: string;
  answers: SetupAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<SetupAnswers>>;
  needs: string[];
  setNeeds: React.Dispatch<React.SetStateAction<string[]>>;
  continueLabel: string;
  onDone: () => void;
}) {
  const t = useTranslations("enroll");
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const total = ALL.length;
  const summary = step === total;
  const q = ALL[Math.min(step, total - 1)]!;
  const adaptation = adaptationOf(answers);

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(Math.max(0, Math.min(total, to)));
  };

  const valueOf = (qq: Q) => (qq.multi ? null : ((answers as Record<string, string | null | undefined>)[qq.id] ?? null));

  // a pointer pick moves on by itself; arrow keys only change the selection
  const byPointer = React.useRef(false);
  function choose(v: string) {
    if (q.multi) {
      setNeeds((n) => (v === "none" ? (n.includes("none") ? [] : ["none"]) : n.includes(v) ? n.filter((x) => x !== v) : [...n.filter((x) => x !== "none"), v]));
      byPointer.current = false;
      return;
    }
    setAnswers((a) => ({ ...a, [q.id]: v }));
    const opt = q.options.find((o) => o.v === v);
    if (byPointer.current && !opt?.free) setTimeout(() => go(step + 1), 260);
    byPointer.current = false;
  }

  // number keys pick an option on the question screens
  React.useEffect(() => {
    if (summary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const opt = q.options[Number(e.key) - 1];
      if (!opt) return;
      e.preventDefault();
      if (q.multi) setNeeds((n) => (opt.v === "none" ? ["none"] : n.includes(opt.v) ? n.filter((x) => x !== opt.v) : [...n.filter((x) => x !== "none"), opt.v]));
      else setAnswers((a) => ({ ...a, [q.id]: opt.v }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, summary, setAnswers, setNeeds]);

  const value = valueOf(q);
  const freeOpt = q.options.find((o) => o.v === value && o.free);
  const freeKey = q.id === "domain" ? "domainOther" : q.id === "role" ? "roleOther" : null;

  const rows = ALL.map((qq) => {
    if (qq.multi) return { q: qq, answer: comfortLabel(needs), change: comfortChange(needs) };
    const sq = QUESTIONS.find((x) => x.id === qq.id)!;
    return { q: qq, answer: answerLabel(sq, answers), change: changeFor(sq, answers) };
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={summary ? "summary" : q.id}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col gap-6"
            aria-labelledby="setup-q"
          >
            {summary ? (
              <>
                <div>
                  <div className="text-sm font-medium text-brand-ink">{t("profileKicker")}</div>
                  <h1 id="setup-q" className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                    {t("profileSummaryTitle", { name })}
                  </h1>
                  <p className="mt-2 max-w-2xl text-ink-muted">{t("profileSummaryBody")}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {rows.map((r, i) => (
                    <li key={r.q.id}>
                      <Surface pad="md" className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="text-ink-faint">{r.q.label}</span>
                            <span className={cn("font-medium", !r.answer && "text-ink-faint")}>{r.answer ?? t("skipped")}</span>
                          </div>
                          <p className={cn("mt-1 text-sm", r.change.skipped ? "text-ink-faint" : "text-ink-muted")}>{r.change.text}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => go(i)} aria-label={t("editAnswer", { label: r.q.label })}>
                          <Pencil />
                        </Button>
                      </Surface>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                  <Button variant="ghost" onClick={() => go(0)}>
                    <ArrowLeft data-icon="inline-start" />
                    {t("changeAnswers")}
                  </Button>
                  <Button variant="brand" size="lg" className="ml-auto" onClick={onDone}>
                    {continueLabel}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-brand-ink">
                    {t("aboutYouOf", { n: step + 1, total })} · {q.label}
                    <span className="rounded-pill border border-line px-2 py-0.5 text-xs font-normal text-ink-faint">{t("optional")}</span>
                  </div>
                  <h1 id="setup-q" className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                    {q.q}
                  </h1>
                  {q.multi ? <p className="mt-2 text-ink-muted">{t("pickAny")}</p> : null}
                </div>

                <div role={q.multi ? "group" : "radiogroup"} aria-labelledby="setup-q" className="grid gap-2.5 sm:grid-cols-2">
                  {q.options.map((o, i) => {
                    const on = q.multi ? needs.includes(o.v) : value === o.v;
                    return (
                      <label
                        key={o.v}
                        onPointerDown={() => {
                          byPointer.current = true;
                        }}
                        data-state={on ? "checked" : "unchecked"}
                        className={cn(
                          "group relative flex min-h-14 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 transition-[transform,border-color,background-color] duration-(--dur-1)",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60 hover:-translate-y-0.5 active:scale-[0.99]",
                          on ? "border-brand bg-brand-soft" : "border-line bg-panel hover:border-brand-line",
                        )}
                      >
                        <input
                          type={q.multi ? "checkbox" : "radio"}
                          name={q.id}
                          value={o.v}
                          checked={on}
                          onChange={() => choose(o.v)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs",
                            on ? "border-transparent bg-brand text-on-brand" : "border-line bg-panel-2 text-ink-faint",
                          )}
                        >
                          {on ? <Check className="size-4" aria-hidden /> : i + 1}
                        </span>
                        <span className="font-medium">{o.label}</span>
                      </label>
                    );
                  })}
                </div>

                {freeOpt && freeKey ? (
                  <div className="flex max-w-md flex-col gap-1.5">
                    <label htmlFor="setup-free" className="text-sm font-medium">
                      {freeOpt.free}
                    </label>
                    <Input
                      id="setup-free"
                      autoFocus
                      maxLength={40}
                      value={answers[freeKey] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [freeKey]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") go(step + 1);
                      }}
                      className="h-11"
                    />
                  </div>
                ) : null}

                <p className="text-sm text-ink-faint">
                  {t("ifSkipped", { what: q.multi ? COMFORT_QUESTION.ifSkipped : QUESTIONS[step]!.ifSkipped })}
                </p>

                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                  <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
                    <ArrowLeft data-icon="inline-start" />
                    {t("back")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="ml-auto text-ink-muted"
                    onClick={() => {
                      if (q.multi) setNeeds([]);
                      else setAnswers((a) => ({ ...a, [q.id]: null }));
                      go(step + 1);
                    }}
                  >
                    {t("skip")}
                  </Button>
                  <Button variant="brand" size="lg" onClick={() => go(step + 1)}>
                    {step === total - 1 ? t("seeHowItAdapts") : t("next")}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* ---------------- live preview ---------------- */}
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+32px)] lg:h-fit" aria-label={t("previewLabel")}>
        <Surface pad="lg" className="grid-texture flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" aria-hidden />
            <h2 className="font-semibold">{t("previewTitle")}</h2>
            <span className="ml-auto font-mono text-xs text-ink-faint">
              {t("answeredOf", { n: adaptation.answered + (needs.length ? 1 : 0), total })}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-ink-faint">{t("lessonOrder")}</div>
            <LessonOrderPreview order={adaptation.order} />
          </div>

          <AnimatePresence initial={false}>
            {adaptation.domain && WORLD["1.1"] ? (
              <motion.div key="world" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-lg border border-stage-worked-line bg-stage-worked-soft p-3 text-sm">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-stage-worked">
                    <Globe2 className="size-3.5" aria-hidden />
                    {t("worldSample", { field: adaptation.domain.label })}
                  </div>
                  {WORLD["1.1"]!(adaptation.domain)}
                </div>
              </motion.div>
            ) : null}
            {adaptation.roleKey && ROLE_HOOK[1]?.[adaptation.roleKey as keyof (typeof ROLE_HOOK)[1]] ? (
              <motion.div key="role" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-lg border border-brand-line bg-brand-soft p-3 text-sm">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
                    <UserRound className="size-3.5" aria-hidden />
                    {t("roleSample", { role: adaptation.roleLabel ?? "" })}
                  </div>
                  {ROLE_HOOK[1]![adaptation.roleKey as keyof (typeof ROLE_HOOK)[1]]}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <LayoutGroup>
            <ul className="flex flex-col gap-1" aria-live="polite">
              {rows.map((r, i) => {
                const current = !summary && i === step;
                return (
                  <motion.li
                    layout
                    key={r.q.id}
                    className={cn("rounded-lg border px-3 py-2 text-sm transition-colors duration-(--dur-2)", current ? "border-brand-line bg-panel" : "border-transparent")}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">{r.q.label}</span>
                      <span className={cn("truncate", r.change.skipped ? "text-ink-faint" : "text-brand-ink")}>{r.answer ?? t("notSet")}</span>
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={r.change.text}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className={cn("mt-0.5 leading-snug", r.change.skipped ? "text-ink-faint" : "text-ink-muted")}
                      >
                        {r.change.text}
                      </motion.p>
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </LayoutGroup>
        </Surface>
      </aside>
    </div>
  );
}
