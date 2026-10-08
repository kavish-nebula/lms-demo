"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Segmented } from "@/components/kit/segmented";
import { Button } from "@/components/ui/button";

type Audience = "individual" | "team";

type Plan = { key: "free" | "learner" | "annual" | "team" | "enterprise"; price: string; per?: string; features: string[]; featured?: boolean; cta: string; href: string };

/**
 * Pricing with B2C / B2B tabs (customers are both, ARCHITECTURE.pdf section 2).
 * Prices are placeholders until commercial terms exist.
 */
export function Pricing() {
  const t = useTranslations("marketing");
  const [aud, setAud] = React.useState<Audience>("individual");

  const plans: Record<Audience, Plan[]> = {
    individual: [
      { key: "free", price: "$0", features: [t("pf_preview"), t("pf_tutorLimited"), t("pf_reviews")], cta: t("planStart"), href: "/auth/sign-in" },
      { key: "learner", price: "$19", per: t("perMonth"), featured: true, features: [t("pf_allCourses"), t("pf_tutor"), t("pf_reviews"), t("pf_credentials")], cta: t("planStart"), href: "/auth/sign-in" },
      { key: "annual", price: "$149", per: t("perYear"), features: [t("pf_allCourses"), t("pf_tutor"), t("pf_voice"), t("pf_credentials")], cta: t("planStart"), href: "/auth/sign-in" },
    ],
    team: [
      { key: "team", price: "$12", per: t("perSeat"), featured: true, features: [t("pf_seats"), t("pf_orgDashboard"), t("pf_instructors"), t("pf_assign")], cta: t("planStart"), href: "/auth/sign-in" },
      { key: "enterprise", price: t("custom"), features: [t("pf_sso"), t("pf_languages"), t("pf_retention"), t("pf_support")], cta: t("planContact"), href: "/auth/sign-in" },
    ],
  };

  return (
    <section id="pricing" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm font-medium text-brand-ink">{t("pricingEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("pricingTitle")}</h2>
          <Segmented<Audience>
            className="mt-6"
            aria-label={t("pricingAudience")}
            value={aud}
            onValueChange={setAud}
            options={[
              { value: "individual", label: t("forIndividuals") },
              { value: "team", label: t("forTeams") },
            ]}
          />
        </div>
        <ul className={cn("mx-auto mt-10 grid gap-4", aud === "individual" ? "max-w-5xl md:grid-cols-3" : "max-w-3xl md:grid-cols-2")}>
          {plans[aud].map((p) => (
            <li
              key={p.key}
              data-spotlight=""
              className={cn(
                "flex flex-col gap-6 rounded-card-lg p-6",
                p.featured ? "border border-brand-line bg-[linear-gradient(180deg,rgba(125,108,255,0.18),rgba(125,108,255,0.04))] shadow-lg" : "glass glass-edge",
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t(`plan_${p.key}`)}</h3>
                  {p.featured ? <span className="rounded-pill bg-brand-deep px-2.5 py-0.5 text-xs text-white">{t("popular")}</span> : null}
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                  {p.per ? <span className="text-ink-muted">{p.per}</span> : null}
                </div>
              </div>
              <ul className="flex flex-1 flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" variant={p.featured ? "brand" : "outline"} className={cn(!p.featured && "bg-transparent")}>
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-ink-faint">{t("pricingNote")}</p>
      </div>
    </section>
  );
}
