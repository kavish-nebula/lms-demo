"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, Clock, GitBranch } from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { NumberTicker } from "@/components/kit/number-ticker";
import { Button } from "@/components/ui/button";
import { StageShell } from "@/components/player/stage-shell";
import type { CapstoneBlock } from "@/data/types";

/**
 * The course capstone, once, after all modules. The brief is the scene and
 * the requirements the project has to meet; the learner builds it in the
 * workspace and marks it done here. Once done, this page shows the
 * requirements met.
 */
export function CapstoneStage({
  block,
  preview,
  workspace = null,
  done,
  onComplete,
}: {
  block: CapstoneBlock;
  preview: boolean;
  /** where the project is built, for a course whose project is built in the browser */
  workspace?: Workspace | null;
  done: boolean;
  onComplete: () => void;
}) {
  if (done) return <Done block={block} workspace={workspace} onComplete={onComplete} />;
  return <Brief block={block} preview={preview} workspace={workspace} onComplete={onComplete} />;
}

function Brief({
  block,
  preview,
  workspace,
  onComplete,
}: {
  block: CapstoneBlock;
  preview: boolean;
  workspace: Workspace | null;
  onComplete: () => void;
}) {
  const t = useTranslations("finale");

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

      {workspace ? <WorkspaceCard workspace={workspace} preview={preview} /> : null}

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

function Done({ block, workspace, onComplete }: { block: CapstoneBlock; workspace: Workspace | null; onComplete: () => void }) {
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

      {workspace ? <WorkspaceCard workspace={workspace} preview={false} /> : null}

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

type Workspace = { href: string; courseId: string; enrolled: boolean };

/** Opens the workspace, where the learner builds the agent's workflow. */
function WorkspaceCard({ workspace, preview }: { workspace: Workspace; preview: boolean }) {
  const t = useTranslations("finale");
  return (
    <Surface pad="md" className="flex flex-wrap items-center justify-between gap-4 border-brand-line">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-2 font-semibold">
          <GitBranch className="size-4 text-brand-ink" aria-hidden />
          {t("workspaceTitle")}
        </span>
        <span className="text-sm text-ink-muted">{t("workspaceBody")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
      {preview ? (
        <Button size="lg" variant="brand" disabled>
          {t("openWorkspace")}
        </Button>
      ) : (
        <Button asChild size="lg" variant="brand">
          <Link href={workspace.href}>
            {t("openWorkspace")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      )}
      </div>
    </Surface>
  );
}
