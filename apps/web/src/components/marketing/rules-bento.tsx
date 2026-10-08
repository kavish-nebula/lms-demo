import * as React from "react";
import { getTranslations } from "next-intl/server";
import { Brain, Clock4, Layers3, Timer } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Stats-bento of the design rules every module follows (21st.dev Stats Bento).
 * The figures are ch13 production rules, not outcome claims.
 */
export async function RulesBento() {
  const t = await getTranslations("marketing");
  const rules = [
    { icon: Timer, value: "< 2s", label: t("ruleFeedback"), big: true },
    { icon: Clock4, value: "3–5 min", label: t("ruleChecks") },
    { icon: Layers3, value: "4–5", label: t("ruleChunk") },
    { icon: Brain, value: "+1 · +2 · +4", label: t("ruleSpacing") },
  ];
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-ink">{t("rulesEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("rulesTitle")}</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-4 md:grid-rows-2">
          {rules.map((r, i) => {
            const Icon = r.icon;
            return (
              <Reveal
                key={r.label}
                index={i}
                className={r.big ? "md:col-span-2 md:row-span-2" : i === 3 ? "md:col-span-2" : ""}
              >
                <div
                  data-spotlight=""
                  className={
                    r.big
                      ? "flex h-full flex-col justify-between gap-10 rounded-card-lg bg-[linear-gradient(140deg,var(--accent-deep),#3a2f9e)] p-8 text-white shadow-lg"
                      : "glass glass-edge flex h-full flex-col justify-between gap-6 rounded-card-lg p-6"
                  }
                >
                  <Icon className={r.big ? "size-7 text-white/80" : "size-5 text-brand-ink"} aria-hidden />
                  <div>
                    <div className={r.big ? "text-6xl font-semibold tracking-tight" : "text-3xl font-semibold tracking-tight"}>
                      {r.value}
                    </div>
                    <p className={r.big ? "mt-3 max-w-sm text-lg text-white/80" : "mt-2 text-ink-muted"}>{r.label}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
