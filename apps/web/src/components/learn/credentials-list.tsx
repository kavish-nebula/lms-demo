"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Award } from "lucide-react";
import { CardSkeleton, EmptyState } from "@/components/kit/states";
import { CredentialCard } from "@/components/learn/credential-card";
import { courseCredential } from "@/components/finale/wrap-up-stage";
import { useLocalPrefix, useHydrated } from "@/lib/local-store";
import { FINALE_PREFIX, type FinaleState } from "@/lib/finale";
import type { Course, Credential } from "@/data/types";

/**
 * Issued credentials plus any course credential earned in this browser by
 * finishing a course's wrap-up (kept locally until the API issues them).
 */
export function CredentialsList({ issued, courses }: { issued: Credential[]; courses: Course[] }) {
  const t = useTranslations("credentials");
  const hydrated = useHydrated();
  const finales = useLocalPrefix<FinaleState>(FINALE_PREFIX);
  const local = courses
    .map((c) => {
      const at = finales[`${FINALE_PREFIX}${c.course_id}`]?.completedAt;
      return at ? courseCredential(c, at) : null;
    })
    .filter((c): c is Credential => !!c);
  const all = [...local, ...issued];

  if (!hydrated) return <CardSkeleton lines={3} />;
  if (!all.length) return <EmptyState icon={<Award />} title={t("empty")} description={t("emptyHint")} />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {all.map((c) => (
        <CredentialCard key={c.credential_id} credential={c} />
      ))}
    </div>
  );
}
