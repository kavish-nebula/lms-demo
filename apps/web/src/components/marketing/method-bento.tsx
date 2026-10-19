import * as React from "react";
import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import { STAGE_META, type StageId } from "@/lib/stages";
import { Reveal } from "@/components/marketing/reveal";

/**
 * How a course works, kept to one row: the four moves every module makes,
 * then a single line for the finale. Short on purpose: the home page should
 * read at a glance, and the course page carries the detail.
 */
const STEPS: { stage: StageId; key: "methodStep1" | "methodStep2" | "methodStep3" | "methodStep4" }[] = [
  { stage: "hook", key: "methodStep1" },
  { stage: "explainer", key: "methodStep2" },
  { stage: "guided", key: "methodStep3" },
  { stage: "review", key: "methodStep4" },
];

export async function MethodBento() {
  const t = await getTranslations("marketing");

  return (
    <section id="method" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-ink">{t("methodEyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-[2.25rem] md:leading-tight">{t("methodTitle")}</h2>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const meta = STAGE_META[s.stage];
            const Icon = meta.icon;
            return (
              <li key={s.key}>
                <Reveal index={i} className="h-full">
                  <div className="glass glass-edge flex h-full items-center gap-4 rounded-card-lg p-5">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", meta.chip)}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-ink-faint">0{i + 1}</span>
                      <h3 className="leading-snug font-semibold">{t(s.key)}</h3>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>

        <p className="mt-6 text-ink-muted">{t("methodFinale")}</p>
      </div>
    </section>
  );
}
