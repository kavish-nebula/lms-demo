"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, MousePointer2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/kit/number-ticker";
import { STAGE_META, type StageId } from "@/lib/stages";
import { cn } from "cn";

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const } }),
};

/**
 * Aurora hero (reference image 1): headline with an accent phrase, prompt-style
 * input as the primary CTA, ghost + filled buttons, a stat pair, and a product
 * preview built from real UI pieces. A soft glow follows the pointer
 * (GetLayers-style) and stays still under reduced motion.
 */
export type HeroPreview = { course: string; module: string; topics: { stage: StageId; title: string }[] };

export function Hero({ preview }: { preview: HeroPreview }) {
  const t = useTranslations("marketing");
  const router = useRouter();
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const [goal, setGoal] = React.useState("");

  function onPointer(e: React.PointerEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  return (
    <section
      ref={ref}
      onPointerMove={onPointer}
      className="relative isolate overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28 [--mx:70%] [--my:30%]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(600px_circle_at_var(--mx)_var(--my),rgba(143,128,255,0.22),transparent_60%)] transition-[background] duration-300"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(125,108,255,0.45),transparent)] blur-2xl"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 md:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-7">
          <motion.div custom={0} variants={rise} initial="hidden" animate="show">
            <span className="inline-flex items-center gap-2 rounded-pill border border-brand-line bg-brand-soft px-3 py-1 text-sm text-brand-ink">
              <Sparkles className="size-3.5" aria-hidden />
              {t("heroBadge")}
            </span>
          </motion.div>
          <motion.h1
            custom={1}
            variants={rise}
            initial="hidden"
            animate="show"
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[64px] lg:leading-[1.02]"
          >
            {t("heroLead")} <span className="text-brand-ink">{t("heroAccent")}</span>
          </motion.h1>
          <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="max-w-xl text-lg text-ink-muted">
            {t("heroSubtitle")}
          </motion.p>

          <motion.form
            custom={3}
            variants={rise}
            initial="hidden"
            animate="show"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/auth/sign-in");
            }}
            className="glass glass-edge flex max-w-xl items-center gap-2 rounded-pill p-1.5 pl-5"
          >
            <label htmlFor="goal" className="sr-only">
              {t("heroPrompt")}
            </label>
            <input
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("heroPrompt")}
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
            />
            <Button type="submit" size="icon-lg" variant="brand" className="rounded-full" aria-label={t("heroCtaPrimary")}>
              <ArrowRight />
            </Button>
          </motion.form>

          <motion.div custom={4} variants={rise} initial="hidden" animate="show" className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="brand">
              <Link href="/auth/sign-in">{t("heroCtaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-brand-line bg-transparent">
              <a href="#method">{t("heroCtaSecondary")}</a>
            </Button>
          </motion.div>

          <motion.dl custom={5} variants={rise} initial="hidden" animate="show" className="mt-2 grid max-w-md grid-cols-3 gap-6">
            {[
              { v: 5, suffix: "", l: t("statSteps") },
              { v: 80, suffix: "%", l: t("statGate") },
              { v: 3, suffix: "×", l: t("statReviews") },
            ].map((s, i) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="text-3xl font-semibold text-brand-ink">
                  <NumberTicker value={s.v} suffix={s.suffix} delay={0.5 + i * 0.12} />
                </dd>
                <dd className="mt-1 text-sm text-ink-muted">{s.l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Product preview: assembled from the same stage tokens the app uses. */}
        <motion.div
          initial={{ opacity: 0, y: 24, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          aria-hidden
        >
          <div className="glass glass-edge rounded-[28px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-ink-faint">{preview.course}</div>
                <div className="font-semibold">{preview.module}</div>
              </div>
              <span className="rounded-pill bg-brand-soft px-2.5 py-1 text-xs text-brand-ink">3 / {preview.topics.length}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {preview.topics.map((tp, i) => {
                const meta = STAGE_META[tp.stage];
                const Icon = meta.icon;
                const state = i < 2 ? "done" : i === 2 ? "current" : "todo";
                return (
                  <li
                    key={tp.stage}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", state === "current" && "bg-brand-soft text-brand-ink")}
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg border",
                        state === "done" ? "border-transparent bg-ok text-on-ok" : "border-white/15 bg-white/5",
                      )}
                    >
                      {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <span className="flex-1">{tp.title}</span>
                    <span className="text-xs text-ink-faint tabular-nums">{i + 1}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="glass glass-edge absolute -bottom-10 -left-4 w-64 rounded-2xl p-4 sm:-left-10">
            <div className="mb-2 text-xs font-medium text-brand-ink">Quick check</div>
            <div className="mb-3 text-sm">Which node starts every workflow?</div>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <span className="rounded-lg border border-white/15 px-2 py-1.5 text-center">Filter</span>
              <span className="rounded-lg border border-ok-line bg-ok-soft px-2 py-1.5 text-center text-ok">Trigger</span>
              <span className="rounded-lg border border-white/15 px-2 py-1.5 text-center">Action</span>
            </div>
          </div>

          <div className="glass glass-edge absolute -top-6 -right-2 flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm sm:-right-6">
            <ShieldCheck className="size-4 text-ok" />
            {t("heroAccepted")}
          </div>
          <MousePointer2 className="absolute right-10 bottom-4 size-6 fill-brand text-brand-ink" />
        </motion.div>
      </div>
    </section>
  );
}
