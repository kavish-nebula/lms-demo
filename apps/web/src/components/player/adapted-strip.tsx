"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RefreshCw, Settings2, Sparkles } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { planModule } from "@/lib/learner-plan";
import type { Adaptation } from "@/lib/setup";
import type { StageId } from "@/lib/stages";

/**
 * "This lesson is adapted because…" (prototype AdaptedStrip). Product rule:
 * every adaptation is visible and explained. With a plan, the reasons are the
 * plan's own (the AI planner's, or the rules'), and a recent revision of this module
 * says what changed and why. Before enrolment it becomes a preview banner
 * that invites the learner to set the course up.
 */
export function AdaptedStrip({
  stage,
  moduleId,
  adaptation,
  enrolled,
  setupHref,
}: {
  stage: StageId;
  moduleId: string;
  adaptation: Adaptation;
  enrolled: boolean;
  setupHref: string;
}) {
  const t = useTranslations("player");

  if (!enrolled) {
    return (
      <div className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-card border border-brand-line bg-brand-soft p-3 pl-4 text-sm">
        <Sparkles className="size-4 shrink-0 text-brand-ink" aria-hidden />
        <span className="min-w-0 flex-1">{t("previewBanner")}</span>
        <Button asChild size="sm" variant="brand">
          <Link href={setupHref}>{t("previewCta")}</Link>
        </Button>
      </div>
    );
  }

  const chips: { text: string; why: string; updated?: boolean }[] = [];
  const a = adaptation;
  const mod = planModule(a.plan, moduleId);
  const support = a.override ?? mod?.support ?? a.support;
  const supportWhy = a.override ? t("whySupport") : (mod?.lessons.find((l) => l.support === support)?.why ?? t("whySupport"));
  const updates = (a.plan?.changes ?? []).filter((c) => c.target.includes(moduleId) || !!mod?.lessons.some((l) => c.target.includes(l.lessonId)));

  for (const c of updates.slice(0, 2)) chips.push({ text: t("chipUpdated", { target: c.target }), why: c.reason, updated: true });
  if (mod && mod.emphasis !== "standard") chips.push({ text: t(mod.emphasis === "deep" ? "chipDeep" : "chipSkim"), why: mod.why });
  if (stage === "hook" && a.roleLabel) chips.push({ text: t("chipRole", { role: a.roleLabel }), why: t("whyRole") });
  if (stage === "explainer" && a.domain) chips.push({ text: t("chipWorld", { field: a.domain.label }), why: t("whyWorld") });
  if (stage === "explainer" && a.order[0] === "try") chips.push({ text: t("chipTryFirst"), why: t("whyOrder") });
  if (stage === "worked" && a.order[0] === "example") chips.push({ text: t("chipExampleFirst"), why: t("whyOrder") });
  if (stage === "guided" && support === "extra") chips.push({ text: t("chipTipsOpen"), why: supportWhy });
  if (stage !== "gate" && support !== "standard") chips.push({ text: support === "extra" ? t("chipExtra") : t("chipLight"), why: supportWhy });

  if (!chips.length) return null;

  return (
    <div className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center gap-2" aria-label={t("adaptedFor")}>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint">
        <Sparkles className="size-3.5 text-brand-ink" aria-hidden />
        {a.planSource === "ai" ? t("adaptedByAi") : t("adaptedFor")}
      </span>
      {chips.map((c) => (
        <Tooltip key={c.text}>
          <TooltipTrigger asChild>
            <button type="button" className="rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <Chip size="sm" tone={c.updated ? "ok" : "accent"} icon={c.updated ? <RefreshCw /> : undefined}>
                {c.text}
              </Chip>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{c.why}</TooltipContent>
        </Tooltip>
      ))}
      <Button asChild variant="ghost" size="xs" className="ml-auto">
        <Link href={setupHref}>
          <Settings2 data-icon="inline-start" />
          {t("editSetup")}
        </Link>
      </Button>
    </div>
  );
}
