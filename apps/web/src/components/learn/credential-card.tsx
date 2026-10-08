"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Award, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";
import type { Credential } from "@/data/types";

/**
 * Earned credential (prototype CredentialCard). Signed and publicly
 * verifiable once the backend issues Ed25519 credentials.
 */
export function CredentialCard({ credential }: { credential: Credential }) {
  const t = useTranslations("credentials");
  const format = useFormatter();

  async function copy() {
    const url = `${window.location.origin}${credential.verify_url}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <Surface pad="none" className="overflow-hidden">
      <div className="relative flex items-center gap-4 bg-plum p-5 text-white">
        <span className="flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
          <Award className="size-6 text-teal" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-xs tracking-wide text-white/70 uppercase">{t(`kind_${credential.kind}`)}</div>
          <div className="truncate text-lg font-semibold">{credential.title}</div>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="text-sm text-ink-muted">{credential.course_title}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" tone="ok" icon={<ShieldCheck />}>
            {t("verifiable")}
          </Chip>
          <span className="text-xs text-ink-faint">
            {t("issued", {
              date: format.dateTime(new Date(credential.issued_at + "T12:00:00Z"), { dateStyle: "medium" }),
            })}
          </span>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={copy}>
          <Copy data-icon="inline-start" />
          {t("copyLink")}
        </Button>
      </div>
    </Surface>
  );
}
