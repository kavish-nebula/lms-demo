"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, CircleDashed, ClipboardCheck, Clock, FlaskConical, Hammer, Laptop, Play, TriangleAlert, UserRound, X } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { NumberTicker } from "@/components/kit/number-ticker";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { ROLE_BRIEF } from "@/lib/world";
import { useCapstoneDraft, type CapstoneDraft } from "@/lib/sandbox/draft";
import type { CapstoneBlock } from "@/data/types";

/**
 * The course capstone, once, after all modules. The brief here; the build
 * happens in the sandbox (an n8n-style editor), where the learner runs sample
 * sign-ups and checks the workflow against hidden launch-day data. Every
 * requirement must pass. Once accepted, this page shows the results.
 */
export function CapstoneStage({
  block,
  courseId,
  preview,
  roleKey,
  roleLabel,
  done,
  onComplete,
}: {
  block: CapstoneBlock;
  courseId: string;
  preview: boolean;
  roleKey: string | null;
  roleLabel: string | null;
  done: boolean;
  onComplete: () => void;
}) {
  const draft = useCapstoneDraft(courseId);
  const sandboxHref = `/learn/courses/${courseId}/finale/capstone/sandbox`;
  if (done || draft?.report?.accepted) return <Accepted block={block} draft={draft} sandboxHref={sandboxHref} onComplete={onComplete} />;
  return <Brief block={block} draft={draft} preview={preview} roleKey={roleKey} roleLabel={roleLabel} sandboxHref={sandboxHref} />;
}

function Brief({
  block,
  draft,
  preview,
  roleKey,
  roleLabel,
  sandboxHref,
}: {
  block: CapstoneBlock;
  draft: CapstoneDraft | null;
  preview: boolean;
  roleKey: string | null;
  roleLabel: string | null;
  sandboxHref: string;
}) {
  const t = useTranslations("finale");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const brief = roleKey ? ROLE_BRIEF[roleKey as keyof typeof ROLE_BRIEF] : undefined;
  const report = draft?.report;
  const started = !!draft?.workflow.nodes.length;

  return (
    <StageShell stage="project" title={block.title} minutes={block.duration_min} hideFooter>
      <Surface pad="lg" className="flex flex-col gap-5">
        <p className="text-lg leading-relaxed">{block.scene}</p>
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" icon={<Clock />}>
            {t("aboutMinutes", { count: block.duration_min })}
          </Chip>
          <Chip size="sm" icon={<Hammer />}>
            {t("builtInSandbox")}
          </Chip>
          <Chip size="sm" icon={<FlaskConical />}>
            {t("hiddenTests")}
          </Chip>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="size-4 text-stage-project" aria-hidden />
            {t("requirements")}
          </h2>
          <ol className="flex flex-col gap-2.5">
            {block.requirements.map((r, i) => {
              const res = report?.results.find((x) => x.id === r.id);
              return (
                <li key={r.id} className="flex gap-3">
                  {res ? (
                    <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3", res.passed ? "bg-ok text-on-ok" : "bg-err-soft text-err")}>
                      {res.passed ? <Check aria-hidden /> : <X aria-hidden />}
                      <span className="sr-only">{t(res.passed ? "reqMet" : "reqNotMet")}</span>
                    </span>
                  ) : (
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-stage-project-line bg-stage-project-soft font-mono text-[11px] text-stage-project">
                      {i + 1}
                    </span>
                  )}
                  <span>{r.text}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </Surface>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Surface pad="md" className="flex flex-col gap-2.5">
          <h2 className="font-semibold">{t("dataContract")}</h2>
          <p className="text-sm text-ink-muted">{t("dataContractBody")}</p>
          <dl className="flex flex-col gap-2 text-sm">
            {block.data_contract.map((d) => (
              <div key={d.field} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="font-mono text-brand-ink">{d.field}</dt>
                <dd>
                  {d.rule}
                  <span className="block font-mono text-xs text-ink-faint">{d.example}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Surface>
        <Surface pad="md" className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4 text-warn" aria-hidden />
            {t("edgeCases")}
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
            {block.edge_cases.map((e) => (
              <li key={e} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />
                {e}
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      {brief ? (
        <Callout tone="hook" label={t("forYou", { role: roleLabel ?? "" })} icon={<UserRound />}>
          {brief}
        </Callout>
      ) : null}

      <Surface pad="md" className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("howItWorks")}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {(["howBuild", "howRun", "howCheck"] as const).map((k, i) => (
            <li key={k} className="flex flex-col gap-1 rounded-lg border border-line bg-panel-2/40 p-3 text-sm">
              <span className="font-mono text-xs text-stage-project">{i + 1}</span>
              <span className="font-medium">{t(`${k}Title`)}</span>
              <span className="text-ink-muted">{t(`${k}Body`)}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-ink-muted">{block.closing}</p>
      </Surface>

      <Surface pad="md" className="flex flex-wrap items-center justify-between gap-4 border-stage-project-line">
        <div className="flex min-w-0 flex-col gap-1">
          {started ? (
            <>
              <span className="font-semibold">{t("draftTitle", { name: draft!.workflow.name })}</span>
              <span className="text-sm text-ink-muted">
                {t("draftMeta", { nodes: draft!.workflow.nodes.length, saved: format.relativeTime(new Date(draft!.savedAt), now) })}
                {report ? ` · ${t("lastCheck", { passed: report.passed, total: report.total })}` : ""}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold">{t("readyTitle")}</span>
              <span className="text-sm text-ink-muted">{t("readyBody")}</span>
            </>
          )}
          <span className="flex items-center gap-1.5 text-xs text-ink-faint md:hidden">
            <Laptop className="size-3.5" aria-hidden />
            {t("bestOnLaptop")}
          </span>
        </div>
        {preview ? (
          <Button size="lg" variant="brand" disabled>
            <Play data-icon="inline-start" />
            {t("openSandbox")}
          </Button>
        ) : (
          <Button asChild size="lg" variant="brand">
            <Link href={sandboxHref}>
              <Play data-icon="inline-start" />
              {t(started ? "continueBuilding" : "openSandbox")}
            </Link>
          </Button>
        )}
      </Surface>
    </StageShell>
  );
}

function Accepted({ block, draft, sandboxHref, onComplete }: { block: CapstoneBlock; draft: CapstoneDraft | null; sandboxHref: string; onComplete: () => void }) {
  const t = useTranslations("finale");
  const reduce = useReducedMotion();
  const launch = draft?.report?.launch;
  const lines = launch
    ? [
        t("launchRows", { count: launch.rows }),
        t("launchRejected", { count: launch.rejected }),
        t("launchDuplicates", { count: launch.duplicates }),
        t("launchWritten", { count: launch.written }),
        t("launchAlerts", { count: launch.alerts }),
        t("launchRetried", { count: launch.retried }),
      ]
    : [];

  return (
    <StageShell stage="project" title={block.title} minutes={block.duration_min} hideFooter done>
      <Surface pad="lg" className="flex flex-col gap-4 border-ok-line">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ok" icon={<Check />}>
            {t("accepted")}
          </Chip>
          {draft ? <span className="text-sm text-ink-muted">{draft.workflow.name}</span> : null}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {block.requirements.map((r, i) => (
            <motion.li
              key={r.id}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : 0.1 + i * 0.08 }}
              className="flex gap-2.5 rounded-lg border border-line bg-panel-2/50 p-3 text-sm"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok text-on-ok [&_svg]:size-3">
                <Check aria-hidden />
              </span>
              {r.text}
            </motion.li>
          ))}
        </ul>
      </Surface>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {lines.length ? (
          <Surface pad="md" className="flex flex-col gap-2">
            <h2 className="font-semibold">{t("launchHour")}</h2>
            <p className="text-sm text-ink-muted">{t("launchHourBody")}</p>
            <ol className="flex flex-col gap-1.5 font-mono text-sm">
              {lines.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span aria-hidden className="size-1.5 rounded-full bg-ok" />
                  {line}
                </li>
              ))}
            </ol>
          </Surface>
        ) : null}
        <Surface pad="md" className="flex flex-col gap-1">
          <h2 className="font-semibold">{t("timeBack")}</h2>
          <div className="text-4xl font-semibold tracking-tight">
            <NumberTicker value={block.hours_saved} suffix=" h" />
          </div>
          <p className="text-sm text-ink-muted">{t("timeBackBody")}</p>
          <p className="text-xs text-ink-faint">{t("estimateNote")}</p>
        </Surface>
      </div>

      <Surface pad="md" className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("teamReacts")}</h2>
        <ul className="flex flex-col gap-3">
          {block.reactions.map((m) => (
            <li key={m.who} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-2 text-sm font-semibold">{m.av}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-muted">{m.who}</span>
                <span className="block">{m.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Surface>

      <RealN8n block={block} />

      <div className="flex flex-wrap justify-between gap-3">
        <Button asChild variant="outline">
          <Link href={sandboxHref}>
            <CircleDashed data-icon="inline-start" />
            {t("openSandboxAgain")}
          </Link>
        </Button>
        <Button size="lg" variant="brand" onClick={onComplete}>
          {t("continue")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </StageShell>
  );
}

function RealN8n({ block }: { block: CapstoneBlock }) {
  const t = useTranslations("finale");
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-card border border-line">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-card px-4 py-3 text-left font-medium outline-none hover:bg-panel-2/50 focus-visible:ring-2 focus-visible:ring-ring/60">
        {t("realN8n")}
        <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 px-4 pb-4 text-sm text-ink-muted">
          <p>{block.real_n8n.intro}</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {block.real_n8n.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
