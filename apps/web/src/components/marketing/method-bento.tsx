import * as React from "react";
import { cn } from "cn";
import { getTranslations } from "next-intl/server";
import { getCourses } from "@/data";
import { STAGE_META } from "@/lib/stages";
import { moduleTopics } from "@/lib/topics";
import { Reveal } from "@/components/marketing/reveal";

/**
 * How a course works, shown with real topics rather than method names: one
 * module's own topics in order, then the finale that comes once, after all
 * modules (capstone, final check, wrap-up).
 */
export async function MethodBento() {
  const t = await getTranslations("marketing");
  const course = (await getCourses())[0]!;
  const first = course.modules[0]!;
  const topics = moduleTopics(first);

  return (
    <section id="method" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-ink">{t("methodEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{t("methodTitle")}</h2>
          <p className="mt-3 text-lg text-ink-muted">{t("methodBody")}</p>
        </div>

        <div className="mt-12 flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold">{t("methodEveryModule")}</h3>
          <span className="text-sm text-ink-faint">{t("methodExample", { module: first.title })}</span>
        </div>
        <ol className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {topics.map((tp, i) => {
            const meta = STAGE_META[tp.stage];
            const Icon = meta.icon;
            return (
              <li key={tp.stage}>
                <Reveal index={i} className="h-full">
                  <div
                    data-spotlight=""
                    className="glass glass-edge flex h-full flex-col gap-4 rounded-card-lg p-5 transition-transform duration-(--dur-2) hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("flex size-10 items-center justify-center rounded-xl border", meta.chip)}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="font-mono text-sm text-ink-faint">0{i + 1}</span>
                    </div>
                    <div>
                      <h4 className="leading-snug font-semibold">{tp.title}</h4>
                      <p className="mt-1 text-sm text-ink-muted">{tp.summary}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>

        <h3 className="mt-12 text-lg font-semibold">{course.finale.title}</h3>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {course.finale.steps.map((s, i) => {
            const meta = STAGE_META[s.stage];
            const Icon = meta.icon;
            return (
              <li key={s.id}>
                <Reveal index={topics.length + i} className="h-full">
                  <div
                    data-spotlight=""
                    className="glass glass-edge flex h-full flex-col gap-4 rounded-card-lg p-6 transition-transform duration-(--dur-2) hover:-translate-y-1"
                  >
                    <span className={cn("flex size-10 items-center justify-center rounded-xl border", meta.chip)}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-ink-faint">{s.kicker}</p>
                      <h4 className="mt-0.5 text-lg font-semibold">{s.title}</h4>
                      <p className="mt-1 text-ink-muted">{s.summary}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
