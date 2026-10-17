"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Check, MousePointer2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
export type HeroPreview = { course: string; module: string; modules: number; topics: { stage: StageId; title: string }[] };

export function Hero({ preview }: { preview: HeroPreview | null }) {
  const t = useTranslations("marketing");
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);

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

      <div className={cn("mx-auto grid max-w-6xl items-center gap-14 px-4 md:px-6", preview && "lg:grid-cols-[1.05fr_1fr]")}>
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
            className="text-[2.25rem] leading-tight font-semibold tracking-tight text-balance sm:text-[2.75rem] lg:text-[3.25rem]"
          >
            {t("heroLead")} <span className="text-brand-ink">{t("heroAccent")}</span>
          </motion.h1>
          <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="max-w-lg text-base text-ink-muted">
            {t("heroSubtitle")}
          </motion.p>


          <motion.div custom={4} variants={rise} initial="hidden" animate="show" className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="brand">
              <Link href="/auth/sign-in">{t("heroCtaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-brand-line bg-transparent">
              <a href="#method">{t("heroCtaSecondary")}</a>
            </Button>
          </motion.div>

        </div>

        {/* Product preview: assembled from the same stage tokens the app uses. */}
        {preview ? (
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
              {preview.topics.slice(0, 4).map((tp, i) => {
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

          <MousePointer2 className="absolute right-10 bottom-4 size-6 fill-brand text-brand-ink" />
        </motion.div>
        ) : null}
      </div>
    </section>
  );
}
