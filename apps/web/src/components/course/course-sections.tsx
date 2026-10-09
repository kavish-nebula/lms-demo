"use client";

/**
 * Course details page sections (Coursera layout): About, How it works,
 * Outcomes, Modules, Reviews. Real course data from the content spine;
 * ratings, reviews and career statistics show empty states until real data
 * exists (no invented numbers).
 */
import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  Award,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Globe2,
  Languages,
  Lock,
  MessageSquareText,
  Play,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { NumberTicker } from "@/components/kit/number-ticker";
import { NebulaMark } from "@/components/kit/logo";
import { EmptyState } from "@/components/kit/states";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinaleArt, ModuleArt } from "@/components/course/module-art";
import { LessonOrderPreview } from "@/components/enroll/lesson-order-preview";
import { ModuleMap } from "@/components/player/module-map";
import { useWatchedVideos } from "@/components/player/video/watched";
import { DEMO_OPEN } from "@/lib/demo";
import { useEnrollment } from "@/lib/enrollment";
import { flatParts, type ModuleSection } from "@/lib/module-outline";
import { useCourseProgress, type ModuleProgress } from "@/lib/course-progress";
import { QUESTIONS, lessonOrder } from "@/lib/setup";
import { STAGE_META, type StageId } from "@/lib/stages";
import { moduleTopics } from "@/lib/topics";
import type { Course } from "@/data/types";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

/* ---------------------------------------------------------------- about */

export function AboutSection({ course }: { course: Course }) {
  const t = useTranslations("course");
  const [allSkills, setAllSkills] = React.useState(false);
  const shown = allSkills ? course.skills : course.skills.slice(0, 9);
  return (
    <section id="about" tabIndex={-1} aria-labelledby="about-title" className="flex scroll-mt-40 flex-col gap-8 outline-none">
      <div className="flex flex-col gap-4">
        <SectionTitle id="about">{t("whatYoullLearn")}</SectionTitle>
        <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {course.learn.map((l) => (
            <li key={l} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-brand-ink" aria-hidden />
              <span className="leading-relaxed">{l}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("skillsGain")}</h3>
        <motion.ul layout className="flex flex-wrap items-center gap-2">
          <AnimatePresence initial={false}>
            {shown.map((s) => (
              <motion.li key={s} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Chip>{s}</Chip>
              </motion.li>
            ))}
          </AnimatePresence>
          {course.skills.length > 9 ? (
            <li>
              <Button variant="link" size="sm" onClick={() => setAllSkills((v) => !v)} aria-expanded={allSkills}>
                {allSkills ? t("showLess") : t("showAll", { count: course.skills.length })}
              </Button>
            </li>
          ) : null}
        </motion.ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("toolsLearn")}</h3>
        <ul className="flex flex-wrap gap-2">
          {course.tools.map((s) => (
            <li key={s}>
              <Chip icon={<Wrench />}>{s}</Chip>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">{t("detailsToKnow")}</h3>
        <dl className="grid gap-5 sm:grid-cols-3">
          <Detail icon={<Award />} title={t("detailCredential")} body={t("detailCredentialBody")} />
          <Detail
            icon={<Languages />}
            title={t("detailTaughtIn", { language: course.languages[0]?.name ?? "English" })}
            body={course.languages.length > 1 ? t("detailMoreLanguages", { list: course.languages.slice(1).map((l) => l.name).join(", ") }) : ""}
          />
          <Detail icon={<Clock />} title={t("detailPace")} body={t("detailPaceBody", { hours: course.estimated_hours })} />
        </dl>
      </div>
    </section>
  );
}

function Detail({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink [&_svg]:size-4">{icon}</span>
      <div>
        <dt className="font-semibold">{title}</dt>
        {body ? <dd className="text-sm text-ink-muted">{body}</dd> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- how it works */

export function MethodSection({ course }: { course: Course }) {
  const t = useTranslations("course");
  const [moduleId, setModuleId] = React.useState(course.modules[0]!.module_id);
  const [firstStep, setFirstStep] = React.useState<string>("idea");
  const m = course.modules.find((x) => x.module_id === moduleId)!;
  const topics = moduleTopics(m);
  const ids = course.modules.map((x) => x.module_id);

  return (
    <section id="method" tabIndex={-1} aria-labelledby="method-title" className="flex scroll-mt-40 flex-col gap-8 outline-none">
      <div className="max-w-2xl">
        <SectionTitle id="method">{t("methodTitle")}</SectionTitle>
        <p className="mt-2 text-ink-muted">{t("methodLead")}</p>
      </div>

      {/* every module: its own topics, in the same order */}
      <Surface pad="lg" className="grid-texture flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{t("inEveryModule")}</h3>
          <div role="tablist" aria-label={t("pickModule")} className="flex flex-wrap gap-1 rounded-pill border border-line bg-panel p-1">
            {course.modules.map((x, i) => {
              const on = x.module_id === moduleId;
              return (
                <button
                  key={x.module_id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="module-flow"
                  aria-label={x.title}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setModuleId(x.module_id)}
                  onKeyDown={(e) => {
                    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                    if (!step) return;
                    e.preventDefault();
                    const next = ids[(i + step + ids.length) % ids.length]!;
                    setModuleId(next);
                    (e.currentTarget.parentElement?.children[ids.indexOf(next)] as HTMLElement | undefined)?.focus();
                  }}
                  className="relative rounded-pill px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {on ? (
                    <motion.span
                      layoutId="module-flow-tab"
                      className="absolute inset-0 rounded-pill bg-brand-soft"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className={cn("relative", on ? "text-brand-ink" : "text-ink-muted")}>M{i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{m.title}</span> · {t("topicsCount", { count: topics.length })}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={moduleId}
            id="module-flow"
            role="tabpanel"
            aria-label={m.title}
            initial="hidden"
            animate="show"
            exit="exit"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className={cn("grid gap-3 sm:grid-cols-2", topics.length > 2 && "xl:grid-cols-5")}
          >
            {topics.map((tp, i) => {
              const meta = STAGE_META[tp.stage];
              const Icon = meta.icon;
              return (
                <motion.li
                  key={tp.stage}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0.12 } } }}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("flex size-8 items-center justify-center rounded-lg border", meta.chip)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="font-mono text-xs text-ink-faint">{i + 1}</span>
                  </div>
                  <div className="leading-snug font-semibold">{tp.title}</div>
                  <p className="text-sm text-ink-muted">{tp.summary}</p>
                  {tp.stage === "explainer" ? (
                    <ul className="mt-auto flex flex-col gap-0.5 pt-1 text-xs text-ink-faint">
                      {m.lessons.map((l) => (
                        <li key={l.id}>
                          <span className="font-mono">{l.id}</span> {l.title}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </motion.li>
              );
            })}
          </motion.ol>
        </AnimatePresence>
      </Surface>

      {/* once, after all modules */}
      <Surface pad="lg" className="flex flex-col gap-5">
        <div>
          <h3 className="text-lg font-semibold">{course.finale.title}</h3>
          <p className="text-sm text-ink-muted">{course.finale.summary}</p>
        </div>
        <ol className="relative grid gap-4 sm:grid-cols-3">
          <span
            aria-hidden
            className="absolute top-5 right-8 left-8 hidden h-px bg-[linear-gradient(90deg,var(--stage-project),var(--stage-gate),var(--stage-reflection))] sm:block"
          />
          {course.finale.steps.map((s, i) => {
            const meta = STAGE_META[s.stage];
            const Icon = meta.icon;
            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.12 }}
                className="relative flex flex-col gap-2"
              >
                <span className={cn("relative flex size-10 items-center justify-center rounded-full border bg-panel", meta.chip)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-ink-faint">{s.kicker}</span>
                <span className="font-semibold">{s.title}</span>
                <span className="text-sm text-ink-muted">{s.summary}</span>
              </motion.li>
            );
          })}
        </ol>
      </Surface>

      {/* adaptivity: the setup questions and a live sample of one effect */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Surface pad="lg" className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" aria-hidden />
            <h3 className="text-lg font-semibold">{t("adaptTitle")}</h3>
          </div>
          <p className="text-ink-muted">{t("adaptBody", { count: QUESTIONS.length })}</p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {QUESTIONS.map((q, i) => (
              <li key={q.id} className="flex items-start gap-3 rounded-lg border border-line bg-panel-2/40 p-3">
                <span className="font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-sm font-semibold">{q.label}</span>
                  <span className="block text-sm text-ink-muted">{q.q}</span>
                </span>
              </li>
            ))}
          </ol>
        </Surface>
        <Surface pad="lg" className="flex flex-col gap-4">
          <h3 className="font-semibold">{t("tryOneAnswer")}</h3>
          <p id="try-q" className="text-sm text-ink-muted">
            {QUESTIONS.find((q) => q.id === "firstStep")!.q}
          </p>
          <div role="radiogroup" aria-labelledby="try-q" className="flex flex-wrap gap-1.5">
            {QUESTIONS.find((q) => q.id === "firstStep")!.options.map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={firstStep === o.v}
                onClick={() => setFirstStep(o.v)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  firstStep === o.v ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-muted hover:border-brand-line",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <LessonOrderPreview order={lessonOrder({ firstStep })} />
        </Surface>
      </div>

      {/* recall checks, then the final check */}
      <Surface pad="lg" className="flex flex-col gap-5">
        <h3 className="text-lg font-semibold">{t("retainTitle")}</h3>
        <ol className="relative grid gap-4 sm:grid-cols-4">
          <span aria-hidden className="absolute top-5 right-6 left-6 hidden h-px bg-[linear-gradient(90deg,var(--stage-review),var(--stage-gate))] sm:block" />
          {[
            { stage: "review" as StageId, title: t("retainDay", { days: 3 }), body: t("retainReviewBody") },
            { stage: "review" as StageId, title: t("retainDay", { days: 10 }), body: t("retainHarder") },
            { stage: "review" as StageId, title: t("retainDay", { days: 30 }), body: t("retainHarder") },
            { stage: "gate" as StageId, title: t("retainFinal"), body: t("retainFinalBody") },
          ].map((s, i) => {
            const meta = STAGE_META[s.stage];
            const SIcon = meta.icon;
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.12 }}
                className="relative flex flex-col gap-2"
              >
                <span className={cn("relative flex size-10 items-center justify-center rounded-full border bg-panel", meta.chip)}>
                  <SIcon className="size-4" aria-hidden />
                </span>
                <span className="font-semibold">{s.title}</span>
                <span className="text-sm text-ink-muted">{s.body}</span>
              </motion.li>
            );
          })}
        </ol>
      </Surface>
    </section>
  );
}

/* ---------------------------------------------------------------- outcomes */

export function OutcomesSection({ course }: { course: Course }) {
  const t = useTranslations("course");
  // hours of manual work only apply to courses that estimate them
  const hasHours = course.modules.some((m) => m.hours_saved != null);
  const max = Math.max(1, ...course.modules.map((m) => m.hours_saved ?? 0));
  return (
    <section id="outcomes" tabIndex={-1} aria-labelledby="outcomes-title" className="flex scroll-mt-40 flex-col gap-6 outline-none">
      <SectionTitle id="outcomes">{t("outcomesTitle")}</SectionTitle>
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-6", hasHours && "lg:grid-cols-2")}>
        <Surface pad="lg" className="flex flex-col gap-4">
          <p className="text-lg leading-relaxed">{course.goal}</p>
          <ul className="flex flex-col gap-2">
            {[t("outcomeBuild"), t("outcomeCredential"), t("outcomePortfolio")].map((o) => (
              <li key={o} className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </Surface>
        {hasHours ? (
        <Surface pad="lg" className="flex flex-col gap-4">
          <div>
            <h3 className="font-semibold">{t("hoursTitle")}</h3>
            <p className="text-sm text-ink-muted">{t("hoursBody")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {course.modules.map((m, i) => (
              <li key={m.module_id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                <span className="font-mono text-xs text-ink-faint">M{i + 1}</span>
                <span className="relative h-2.5 overflow-hidden rounded-pill bg-chart-track">
                  <motion.span
                    className="absolute inset-y-0 left-0 origin-left rounded-pill bg-[linear-gradient(90deg,var(--accent-deep),var(--accent))]"
                    style={{ width: `${((m.hours_saved ?? 0) / max) * 100}%` }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums">
                  <NumberTicker value={m.hours_saved ?? 0} suffix=" h" />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-faint">{t("hoursNote")}</p>
        </Surface>
        ) : null}
      </div>
      <EmptyState icon={<BarChart3 />} title={t("careerEmptyTitle")} description={t("careerEmptyBody")} />
    </section>
  );
}

/* ---------------------------------------------------------------- modules */

/**
 * The course outline as one list (Coursera's course rows): the five modules,
 * then the capstone, final check and wrap-up. Each row's arrow opens what you
 * will learn there.
 */
export function ModulesSection({ course, outlines }: { course: Course; outlines: Record<string, ModuleSection[]> }) {
  const t = useTranslations("course");
  const tc = useTranslations("common");
  const { enrolled } = useEnrollment(course.course_id);
  const progress = useCourseProgress(course);
  const [open, setOpen] = React.useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  // open the row named in the URL hash (catalog carousel, finale links)
  React.useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.slice(1);
      const id =
        hash === "finale"
          ? `finale-${course.finale.steps[0]!.id}`
          : course.modules.some((m) => `module-${m.module_id}` === hash) || course.finale.steps.some((s) => `finale-${s.id}` === hash)
            ? hash
            : null;
      if (!id) return;
      setOpen(id);
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [course]);

  return (
    <section id="modules" tabIndex={-1} aria-labelledby="modules-title" className="flex scroll-mt-40 flex-col gap-6 outline-none">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle id="modules">{t("modulesTitle", { count: course.modules.length })}</SectionTitle>
        {enrolled ? (
          <span className="text-sm text-ink-muted">{t("modulesDoneOf", { done: progress.modulesDone, total: course.modules.length })}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Surface pad="none" className="divide-y divide-line overflow-hidden">
          {progress.modules.map((m) => {
            const id = `module-${m.module_id}`;
            return (
              <OutlineRow
                key={id}
                id={id}
                open={open === id}
                onToggle={() => toggle(id)}
                art={<ModuleArt index={m.index} size="sm" className="h-16 w-24" />}
                title={m.title}
                meta={
                  <>
                    <span>{t("moduleN", { n: m.index })}</span>
                    <span aria-hidden>•</span>
                    <span>{tc("minutes", { count: m.minutes })}</span>
                    {enrolled ? (
                      <span className={cn("inline-flex items-center gap-1", m.liveState === "done" ? "text-ok" : "text-brand-ink")}>
                        {m.liveState === "done" ? <Check className="size-3" aria-hidden /> : null}
                        {t(`state_${m.liveState}`)}
                      </span>
                    ) : null}
                  </>
                }
              >
                <ModulePanel course={course} module={m} enrolled={enrolled} sections={outlines[m.module_id] ?? []} />
              </OutlineRow>
            );
          })}
          <div id="finale" className="scroll-mt-40 divide-y divide-line">
            {progress.finale.map((f, i) => {
              const id = `finale-${f.step.id}`;
              const status = f.done ? "done" : f.locked ? "locked" : "ready";
              return (
                <OutlineRow
                  key={id}
                  id={id}
                  open={open === id}
                  onToggle={() => toggle(id)}
                  art={<FinaleArt steps={[f.step]} className="h-16 w-24" />}
                  title={`${f.step.kicker}: ${f.step.title}`}
                  meta={
                    <>
                      <span>{t("afterAllModules", { n: i + 1, total: progress.finale.length })}</span>
                      <span aria-hidden>•</span>
                      <span>{tc("minutes", { count: f.step.minutes })}</span>
                      {enrolled ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            status === "done" ? "text-ok" : status === "ready" ? "text-brand-ink" : "text-ink-faint",
                          )}
                        >
                          {status === "done" ? <Check className="size-3" aria-hidden /> : status === "locked" ? <Lock className="size-3" aria-hidden /> : null}
                          {t(`finale_${status}`)}
                        </span>
                      ) : null}
                    </>
                  }
                >
                  <div className="flex flex-col gap-5">
                    <p className="text-ink-muted">{f.step.summary}</p>
                    <Learn outcomes={f.step.outcomes} />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button asChild variant={f.locked ? "outline" : "brand"} className={cn("w-fit", f.locked && "bg-transparent")}>
                        <Link href={`/learn/courses/${course.course_id}/finale/${f.step.id}`}>
                          {f.locked ? <Lock data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                          {f.done ? t("revisit") : f.locked ? t("previewIt") : t("startModule")}
                        </Link>
                      </Button>
                      {f.locked ? (
                        <span className="text-sm text-ink-faint">
                          {progress.allModulesDone
                            ? t("finaleAfterPrev", { step: progress.finale[i - 1]?.step.kicker ?? "" })
                            : t("finaleUnlocks", { done: progress.modulesDone, total: progress.modules.length })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </OutlineRow>
              );
            })}
          </div>
        </Surface>
        <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Surface pad="md" className="flex flex-col gap-3">
            <h3 className="font-semibold">{t("offeredBy")}</h3>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-panel-2">
                <NebulaMark size={28} />
              </span>
              <div>
                <div className="font-semibold">{course.provider}</div>
                <div className="text-sm text-ink-muted">{course.domain}</div>
              </div>
            </div>
          </Surface>
          <Surface pad="md" className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-ink-faint" aria-hidden />
              {course.languages.map((l) => l.native).join(" · ")}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-ink-faint" aria-hidden />
              {t("aboutHours", { hours: course.estimated_hours })}
            </div>
          </Surface>
        </aside>
      </div>
    </section>
  );
}

/** One row of the outline: art, underlined title, meta line, and a down arrow that opens the details. */
function OutlineRow({
  id,
  open,
  onToggle,
  art,
  title,
  meta,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  art: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("course");
  const panelId = `${id}-panel`;
  return (
    <div id={id} className="scroll-mt-40">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group flex w-full items-center gap-4 p-4 text-left outline-none hover:bg-panel-2/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset sm:p-5"
        >
          <span className="hidden shrink-0 sm:block">{art}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg leading-snug font-semibold underline decoration-ink-faint/50 underline-offset-4 group-hover:decoration-ink">
              {title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">{meta}</span>
          </span>
          <span className="sr-only">{open ? t("hideLearn") : t("showLearn")}</span>
          <ChevronDown
            className={cn("size-5 shrink-0 text-brand-ink transition-transform duration-(--dur-2)", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-6 sm:px-5 sm:pl-[9.25rem]">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** "What you'll learn": two columns of outcomes with check marks. */
function Learn({ outcomes }: { outcomes: string[] }) {
  const t = useTranslations("course");
  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-semibold">{t("whatYoullLearn")}</h4>
      <ul className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
        {outcomes.map((o, i) => (
          <motion.li
            key={o}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            className="flex gap-2.5 text-sm leading-relaxed"
          >
            <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
            {o}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function ModulePanel({
  course,
  module: m,
  enrolled,
  sections,
}: {
  course: Course;
  module: ModuleProgress;
  enrolled: boolean;
  /** the module under its side headings, part by part */
  sections: ModuleSection[];
}) {
  const t = useTranslations("course");
  const to = useTranslations("outline");
  const moduleHref = `/learn/courses/${course.course_id}/${m.module_id}`;
  const href = `${moduleHref}/${m.next ?? m.stages[0]}`;
  const [showTopics, setShowTopics] = React.useState(false);
  const { watched } = useWatchedVideos();
  const parts = flatParts(sections);
  const doneKeys = new Set(parts.filter((p) => (p.video ? watched.includes(p.video.id) || m.done.includes("explainer") : m.done.includes(p.stage))).map((p) => p.key));
  const nextKey = enrolled ? parts.find((p) => !doneKeys.has(p.key))?.key : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Learn outcomes={m.outcomes} />
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">{t("skillsGain")}</h4>
        <ul className="flex flex-wrap gap-2">
          {m.skills.map((s) => (
            <li key={s}>
              <Chip size="sm">{s}</Chip>
            </li>
          ))}
        </ul>
      </div>
      <blockquote className="rounded-lg border-l-2 border-coral bg-panel-2/50 px-4 py-3 text-sm text-ink">
        <span className="mb-1 block text-xs font-semibold text-coral">{t("theProblem")}</span>
        {m.pain}
      </blockquote>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowTopics((v) => !v)}
          aria-expanded={showTopics}
          className="flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-brand-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {to("partsCount", { count: parts.length })}
          <ChevronDown className={cn("size-4 transition-transform", showTopics && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {showTopics ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <ModuleMap sections={sections} moduleHref={moduleHref} doneKeys={doneKeys} nextKey={nextKey} variant="page" label={m.title} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {enrolled ? (
          <Button asChild variant="brand" className="w-fit">
            <Link href={href}>
              <Play data-icon="inline-start" />
              {m.liveState === "done" ? t("revisit") : m.done.length ? t("continueModule") : t("startModule")}
            </Link>
          </Button>
        ) : m.index === 1 || DEMO_OPEN ? (
          <Button asChild variant="outline" className="w-fit bg-transparent">
            <Link href={href}>
              <Play data-icon="inline-start" />
              {t("previewModule")}
            </Link>
          </Button>
        ) : null}
        {m.hours_saved != null ? (
          <Chip size="sm" tone="ok">
            {t("hoursSaved", { hours: m.hours_saved })}
          </Chip>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- reviews */

export function ReviewsSection({ course }: { course: Course }) {
  const t = useTranslations("course");
  return (
    <section id="reviews" tabIndex={-1} aria-labelledby="reviews-title" className="flex scroll-mt-40 flex-col gap-6 outline-none">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <SectionTitle id="reviews">{t("reviewsTitle")}</SectionTitle>
          <div className="flex items-center gap-2">
            <Star className="size-6 text-ink-faint" aria-hidden />
            <span className="text-3xl font-semibold text-ink-faint">—</span>
          </div>
          <p className="text-sm text-ink-muted">{t("noRatingsYet")}</p>
          <ul className="flex flex-col gap-2" aria-label={t("ratingBreakdown")}>
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                <span>{t("stars", { count: n })}</span>
                <span className="h-2 rounded-pill bg-chart-track" />
                <span className="text-right text-ink-faint tabular-nums">0%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <Select disabled defaultValue="all">
            <SelectTrigger className="w-fit min-w-40" aria-label={t("filterReviews")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allModules")}</SelectItem>
              {course.modules.map((m, i) => (
                <SelectItem key={m.module_id} value={m.module_id}>
                  {t("moduleN", { n: i + 1 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <EmptyState icon={<MessageSquareText />} title={t("reviewsEmptyTitle")} description={t("reviewsEmptyBody")} />
        </div>
      </div>
    </section>
  );
}
