"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keep preview enrolment guidance and outline access without adaptation status chips. */
export function AdaptedStrip({ enrolled, setupHref, leading }: {
  enrolled: boolean;
  setupHref: string;
  leading?: React.ReactNode;
}) {
  const t = useTranslations("player");

  if (!enrolled) {
    return (
      <div className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-card border border-brand-line bg-brand-soft p-3 pl-4 text-sm">
        {leading}
        <Sparkles className="size-4 shrink-0 text-brand-ink" aria-hidden />
        <span className="min-w-0 flex-1">{t("previewBanner")}</span>
        <Button asChild size="sm" variant="brand">
          <Link href={setupHref}>{t("previewCta")}</Link>
        </Button>
      </div>
    );
  }

  return leading ? <div className="mx-auto mb-6 hidden w-full max-w-3xl items-center nav:flex">{leading}</div> : null;
}