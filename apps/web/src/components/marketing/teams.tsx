import * as React from "react";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { NumberTicker } from "@/components/kit/number-ticker";

/** B2B section: what org admins and instructors get, with a dashboard preview. */
export async function Teams() {
  const t = await getTranslations("marketing");
  const points = [t("teamsPoint1"), t("teamsPoint2"), t("teamsPoint3"), t("teamsPoint4")];
  const bars = [62, 48, 74, 55, 81, 69, 88];

  return (
    <section id="teams" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-brand-ink">{t("teamsEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("teamsTitle")}</h2>
          <p className="mt-3 text-lg text-ink-muted">{t("teamsBody")}</p>
          <ul className="mt-8 flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <Reveal>
          <div className="glass glass-edge rounded-[28px] p-5" aria-hidden>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-semibold">Acme Logistics · Q4 cohort</div>
              <span className="rounded-pill bg-white/5 px-2.5 py-1 text-xs text-ink-muted">42 / 50 seats</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: 74, s: "%", l: "Completion", c: "text-ok" },
                { v: 68, s: "%", l: "Gate pass, 1st try", c: "text-brand-ink" },
                { v: 5, s: "", l: "Stuck > 7 days", c: "text-coral" },
              ].map((k, i) => (
                <div key={k.l} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className={`text-2xl font-semibold ${k.c}`}>
                    <NumberTicker value={k.v} suffix={k.s} delay={i * 0.1} />
                  </div>
                  <div className="mt-1 text-xs text-ink-faint">{k.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-xs text-ink-faint">Weekly active learners</div>
              <div className="flex h-28 items-end gap-2">
                {bars.map((b, i) => (
                  <div key={i} className="flex-1 origin-bottom rounded-t-md bg-[linear-gradient(180deg,var(--accent),var(--accent-deep))] motion-safe:animate-[grow_0.9s_var(--ease-out)_both]" style={{ height: `${b}%`, animationDelay: `${i * 70}ms` }} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
