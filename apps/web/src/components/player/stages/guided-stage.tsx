"use client";

import * as React from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, ChevronDown, CircleCheck, ClipboardList, Copy, Download, Eye, Hammer, LifeBuoy, Maximize2 } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { ProgressBar } from "@/components/kit/progress-ring";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { N8nScreenView } from "@/components/n8n/screen";
import "@/components/n8n/n8n.css";
import { useLocalJson, writeLocal } from "@/lib/local-store";
import { planModule } from "@/lib/learner-plan";
import type { Adaptation } from "@/lib/setup";
import type { GuideStep, GuidedBlock, N8nScreen } from "@/data/types";
import type { StageProps } from "./types";

/**
 * Guided practice: build the module's workflow in your own n8n, one step at
 * a time. Each step says what to do, shows the n8n screen with the exact
 * button or field numbered, gives values to copy, and says what you should
 * see before moving on. Steps done are kept in the browser.
 */
export function GuidedStage({ block, adaptation, ...nav }: StageProps<GuidedBlock> & { adaptation: Adaptation }) {
  const t = useTranslations("guide");
  const key = `lms-guide:${block.step_id}`;
  const done = useLocalJson<string[]>(key, []);
  const firstOpen = block.steps.find((s) => !done.includes(s.id))?.id ?? null;
  const [openId, setOpenId] = React.useState<string | null>(firstOpen);
  const left = block.steps.filter((s) => !done.includes(s.id)).length;
  const moduleSupport = adaptation.override ?? planModule(adaptation.plan, block.step_id.split(".")[0] ?? "")?.support ?? adaptation.support;
  const tipsOpen = moduleSupport === "extra";

  const complete = (step: GuideStep) => {
    const next = done.includes(step.id) ? done : [...done, step.id];
    writeLocal(key, JSON.stringify(next));
    const after = block.steps.find((s) => !next.includes(s.id));
    setOpenId(after?.id ?? null);
    requestAnimationFrame(() => document.getElementById(`guide-${after?.id ?? "finish"}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <StageShell
      stage="guided"
      title={block.title}
      intro={block.intro}
      minutes={block.duration_min}
      bloom={block.bloom}
      canComplete={left === 0 || nav.done}
      completeHint={t("stepsLeft", { count: left })}
      {...nav}
    >
      <Callout tone="guided" label={t("situation")} icon={<Hammer />}>
        <p className="leading-relaxed">{block.situation}</p>
      </Callout>

      <Surface pad="md" className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("youllBuild")}</h2>
        <ScreenFigure screen={block.goal} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="size-4 text-stage-guided" aria-hidden />
              {t("beforeYouStart")}
            </h3>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
              {block.before.items.map((b) => (
                <li key={b} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-stage-guided" />
                  <Rich text={b} />
                </li>
              ))}
            </ul>
          </div>
          {block.before.downloads.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Download className="size-4 text-stage-guided" aria-hidden />
                {t("downloads")}
              </h3>
              <ul className="flex flex-col gap-2">
                {block.before.downloads.map((d) => (
                  <li key={d.href} className="flex flex-col gap-0.5 rounded-lg border border-line bg-panel-2/40 p-3 text-sm">
                    <a href={d.href} download className="font-medium text-brand-ink underline-offset-4 hover:underline">
                      {d.label}
                    </a>
                    <span className="text-xs text-ink-muted">{d.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Surface>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{t("progress", { done: block.steps.length - left, total: block.steps.length })}</span>
        </div>
        <ProgressBar value={(block.steps.length - left) / block.steps.length} size="sm" aria-label={t("progress", { done: block.steps.length - left, total: block.steps.length })} />
      </div>

      <ol className="flex flex-col gap-3">
        {block.steps.map((s, i) => (
          <StepCard
            key={s.id}
            step={s}
            n={i + 1}
            total={block.steps.length}
            done={done.includes(s.id)}
            open={openId === s.id}
            tipsOpen={tipsOpen}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onDone={() => complete(s)}
          />
        ))}
      </ol>

      {left === 0 ? (
        <Surface id="guide-finish" pad="lg" className="flex flex-col gap-3 border-ok-line">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ok">
            <CircleCheck className="size-5" aria-hidden />
            {block.finish.title}
          </h2>
          <p className="leading-relaxed">{block.finish.body}</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {block.finish.checklist.map((c) => (
              <li key={c} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                <Rich text={c} />
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </StageShell>
  );
}

function StepCard({
  step,
  n,
  total,
  done,
  open,
  tipsOpen,
  onToggle,
  onDone,
}: {
  step: GuideStep;
  n: number;
  total: number;
  done: boolean;
  open: boolean;
  tipsOpen: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("guide");
  const id = `guide-${step.id}`;
  return (
    <li id={id} className={cn("scroll-mt-24 rounded-card border bg-panel/60", open ? "border-stage-guided-line" : done ? "border-ok-line/60" : "border-line")}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-card px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold",
              done ? "border-ok bg-ok text-on-ok" : open ? "border-stage-guided bg-stage-guided-soft text-stage-guided" : "border-line text-ink-muted",
            )}
          >
            {done ? <Check className="size-3.5" aria-hidden /> : n}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-faint">{t("stepOf", { n, total })}</span>
            <span className="block font-semibold">{step.title}</span>
          </span>
          {done ? <span className="sr-only">{t("stepDone")}</span> : null}
          <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h3>
      {open ? (
        <div id={`${id}-body`} className="flex flex-col gap-4 px-4 pb-4">
          <p className="leading-relaxed text-ink-muted">
            <Rich text={step.body} />
          </p>
          <ol className="flex flex-col gap-2.5">
            {step.actions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-(--nx-mark) font-mono text-[11px] font-bold text-(--nx-mark-ink)">{i + 1}</span>
                <span className="leading-relaxed">
                  <Rich text={a} />
                </span>
              </li>
            ))}
          </ol>
          {step.values?.length ? (
            <div className="flex flex-col gap-2">
              {step.values.map((v) => (
                <CopyValue key={v.label} label={v.label} value={v.value} />
              ))}
            </div>
          ) : null}
          <ScreenFigure screen={step.screen} />
          <div className="flex gap-2.5 rounded-lg border border-ok-line bg-ok-soft p-3 text-sm">
            <Eye className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
            <p>
              <span className="font-semibold text-ok">{t("youShouldSee")} </span>
              <Rich text={step.check} />
            </p>
          </div>
          {step.tip ? <Tip text={step.tip} defaultOpen={tipsOpen} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant={done ? "outline" : "brand"} onClick={onDone}>
              <Check data-icon="inline-start" />
              {n === total ? t("doneLast") : t("doneNext")}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Tip({ text, defaultOpen }: { text: string; defaultOpen: boolean }) {
  const t = useTranslations("guide");
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 rounded text-sm font-medium text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        <LifeBuoy className="size-4" aria-hidden />
        {t("stuck")}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 rounded-lg bg-panel-2/60 p-3 text-sm leading-relaxed">
          <Rich text={text} />
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const t = useTranslations("guide");
  const copy = () =>
    navigator.clipboard?.writeText(value).then(
      () => toast.success(t("copied", { label })),
      () => toast.error(t("copyFailed")),
    );
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-panel-2/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <Button variant="ghost" size="xs" onClick={copy} aria-label={t("copyLabel", { label })}>
          <Copy data-icon="inline-start" />
          {t("copy")}
        </Button>
      </div>
      <code className="font-mono text-[13px] break-all whitespace-pre-wrap text-brand-ink">{value}</code>
    </div>
  );
}

/** A recreated n8n screen, with a button to see it larger. */
function ScreenFigure({ screen }: { screen: N8nScreen }) {
  const t = useTranslations("guide");
  const [big, setBig] = React.useState(false);
  return (
    <figure className="flex flex-col gap-2">
      <N8nScreenView screen={screen} />
      <div className="flex items-start justify-between gap-3">
        <figcaption className="text-xs text-ink-faint">{screen.caption}</figcaption>
        <Button variant="ghost" size="xs" className="shrink-0" onClick={() => setBig(true)}>
          <Maximize2 data-icon="inline-start" />
          {t("enlarge")}
        </Button>
      </div>
      <Dialog open={big} onOpenChange={setBig}>
        <DialogContent className="w-[96vw] p-3 sm:max-w-[min(1400px,96vw)]">
          <DialogTitle className="sr-only">{screen.caption}</DialogTitle>
          <DialogDescription className="sr-only">{t("enlargedHelp")}</DialogDescription>
          <N8nScreenView screen={screen} />
        </DialogContent>
      </Dialog>
    </figure>
  );
}

/** **bold** for buttons and fields, `code` for what to type. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith("`") && p.endsWith("`") && p.length > 1 ? (
          <code key={i} className={cn("rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.9em] text-brand-ink [box-decoration-break:clone]", p.length < 28 && "whitespace-nowrap")}>
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}
