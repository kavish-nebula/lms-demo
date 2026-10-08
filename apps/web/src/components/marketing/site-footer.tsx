import * as React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/kit/logo";
import { Button } from "@/components/ui/button";

/** CTA band + bento-style footer (21st.dev Footer Bento). */
export async function SiteFooter() {
  const t = await getTranslations("marketing");
  const tc = await getTranslations("common");
  const cols = [
    { title: t("footProduct"), links: [{ l: t("navMethod"), h: "#method" }, { l: t("navPricing"), h: "#pricing" }, { l: t("navTeams"), h: "#teams" }] },
    { title: t("footCompany"), links: [{ l: t("footAbout"), h: "/" }, { l: t("footContact"), h: "/" }] },
    { title: t("footLegal"), links: [{ l: t("footPrivacy"), h: "/" }, { l: t("footTerms"), h: "/" }, { l: t("footA11y"), h: "/" }] },
  ];
  return (
    <footer className="pb-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,var(--accent-deep),#2b2177_60%,#160f33)] p-8 md:p-14">
          <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-coral/30 blur-3xl" />
          <h2 className="relative max-w-xl text-3xl font-semibold tracking-tight text-white md:text-4xl">{t("ctaTitle")}</h2>
          <p className="relative mt-3 max-w-lg text-lg text-white/75">{t("ctaBody")}</p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-[#1b1440] hover:bg-white/90">
              <Link href="/auth/sign-in">{tc("getStarted")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
              <Link href="/learn">{t("tryDemo")}</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="glass glass-edge flex flex-col justify-between gap-6 rounded-card-lg p-6">
            <Logo />
            <p className="text-sm text-ink-muted">{t("footTagline")}</p>
          </div>
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title} className="glass glass-edge rounded-card-lg p-6">
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.l}>
                    <a href={l.h} className="text-ink-muted hover:text-ink">
                      {l.l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">© 2026 Nebula KnowLab</p>
      </div>
    </footer>
  );
}
