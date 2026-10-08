"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings2, Sparkles } from "lucide-react";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Adaptation } from "@/lib/setup";
import type { StageId } from "@/lib/stages";

/**
 * "This lesson is adapted because…" (prototype AdaptedStrip). Product rule:
 * every adaptation is visible and explained. Before enrolment it becomes a
 * preview banner that invites the learner to set the course up.
 */
export function AdaptedStrip({
  stage,
  adaptation,
  enrolled,
  setupHref,
}: {
  stage: StageId;
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

  const chips: { text: string; why: string }[] = [];
  const a = adaptation;
  if (stage === "hook" && a.roleLabel) chips.push({ text: t("chipRole", { role: a.roleLabel }), why: t("whyRole") });
  if (stage === "explainer" && a.domain) chips.push({ text: t("chipWorld", { field: a.domain.label }), why: t("whyWorld") });
  if (stage === "explainer" && a.analogyOpen) chips.push({ text: t("chipAnalogy"), why: t("whyAnalogy") });
  if (stage === "explainer" && a.order[0] === "try") chips.push({ text: t("chipTryFirst"), why: t("whyOrder") });
  if (stage === "worked" && a.order[0] === "example") chips.push({ text: t("chipExampleFirst"), why: t("whyOrder") });
  if (stage === "guided" && a.support === "extra") chips.push({ text: t("chipTipsOpen"), why: t("whySupport") });
  if (stage !== "gate" && a.support !== "standard")
    chips.push({ text: a.support === "extra" ? t("chipExtra") : t("chipLight"), why: t("whySupport") });

  if (!chips.length) return null;

  return (
    <div className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center gap-2" aria-label={t("adaptedFor")}>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint">
        <Sparkles className="size-3.5 text-brand-ink" aria-hidden />
        {t("adaptedFor")}
      </span>
      {chips.map((c) => (
        <Tooltip key={c.text}>
          <TooltipTrigger asChild>
            <button type="button" className="rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <Chip size="sm" tone="accent">
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
