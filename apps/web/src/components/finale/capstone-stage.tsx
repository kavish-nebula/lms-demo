"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ClipboardCheck, Clock, TriangleAlert, UserRound } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { NumberTicker } from "@/components/kit/number-ticker";
import { Button } from "@/components/ui/button";
import { StageShell, Callout } from "@/components/player/stage-shell";
import { ROLE_BRIEF } from "@/lib/world";
import type { CapstoneBlock } from "@/data/types";

/**
 * The course capstone, once, after all modules. The brief lists what the
 * project has to do; the learner builds it with the course's own tools and
 * marks it done here. Once done, this page shows the requirements met.
 */
export function CapstoneStage({
  block,
  preview,
  roleKey,
  roleLabel,
  planBrief,
  done,
  onComplete,
}: {
  block: CapstoneBlock;
  preview: boolean;
  roleKey: string | null;
  roleLabel: string | null;
  /** the learner's plan frames the capstone for their role */
  planBrief: string | null;
  done: boolean;
  onComplete: () => void;
}) {
  if (done) return <Done block={block} onComplete={onComplete} />;
  return <Brief block={block} preview={preview} roleKey={roleKey} roleLabel={roleLabel} planBrief={planBrief} onComplete={onComplete} />;
}

function Brief({
  block,
  preview,
  roleKey,
  roleLabel,
  planBrief,
  onComplete,
}: {
  block: CapstoneBlock;
  preview: boolean;
  roleKey: string | null;
  roleLabel: string | null;
  planBrief: string | null;
  onComplete: () => void;
}) {
  const t = useTranslations("finale");
  // the learner's plan frames the project for their role; without one, the role's standard brief
  const brief = planBrief || (roleKey ? ROLE_BRIEF[roleKey as keyof typeof ROLE_BRIEF] : undefined);

  return (
    <StageShell stage="project" title={block.title} minutes={block.duration_min} hideFooter>
      <Surface pad="lg" className="flex flex-col gap-5">
        <p className="text-lg leading-relaxed">{block.scene}</p>
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" icon={<Clock />}>
            {t("aboutMinutes", { count: block.duration_min })}
          </Chip>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="size-4 text-stage-project" aria-hidden />
            {t("requirements")}
          </h2>
          <ol className="flex flex-col gap-2.5">
            {block.requirements.map((r, i) => (
              <li key={r.id} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-stage-project-line bg-stage-project-soft font-mono text-[11px] text-stage-project">
                  {i + 1}
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </Surface>

      {block.edge_cases.length ? (
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
      ) : null}

      {brief ? (
        <Callout tone="hook" label={roleLabel ? t("forYou", { role: roleLabel }) : t("forYouPlain")} icon={<UserRound />}>
          {brief}
        </Callout>
      ) : null}

      {block.closing ? <p className="leading-relaxed text-ink-muted">{block.closing}</p> : null}

      <Surface pad="md" className="flex flex-wrap items-center justify-between gap-4 border-stage-project-line">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">{t("submitTitle")}</span>
          <span className="text-sm text-ink-muted">{t("submitBody")}</span>
        </div>
        <Button size="lg" variant="brand" disabled={preview} onClick={onComplete}>
          <Check data-icon="inline-start" />
          {t("submitProject")}
        </Button>
      </Surface>
    </StageShell>
  );
}

function Done({ block, onComplete }: { block: CapstoneBlock; onComplete: () => void }) {
  const t = useTranslations("finale");
  const reduce = useReducedMotion();

  return (
    <StageShell stage="project" title={block.title} minutes={block.duration_min} hideFooter done>
      <Surface pad="lg" className="flex flex-col gap-4 border-ok-line">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ok" icon={<Check />}>
            {t("accepted")}
          </Chip>
          <span className="text-sm text-ink-muted">{block.project_name}</span>
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

      {block.hours_saved != null ? (
        <Surface pad="md" className="flex flex-col gap-1">
          <h2 className="font-semibold">{t("timeBack")}</h2>
          <div className="text-4xl font-semibold tracking-tight">
            <NumberTicker value={block.hours_saved} suffix=" h" />
          </div>
          <p className="text-sm text-ink-muted">{t("timeBackBody")}</p>
          <p className="text-xs text-ink-faint">{t("estimateNote")}</p>
        </Surface>
      ) : null}

      {block.reactions.length ? (
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
      ) : null}

      <div className="flex justify-end">
        <Button size="lg" variant="brand" onClick={onComplete}>
          {t("continue")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </StageShell>
  );
}
