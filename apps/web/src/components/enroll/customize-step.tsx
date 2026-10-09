"use client";

import * as React from "react";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Check,
  Contrast,
  Globe2,
  LifeBuoy,
  ListOrdered,
  RotateCcw,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { Surface } from "@/components/kit/surface";
import { Chip } from "@/components/kit/chip";
import { Segmented } from "@/components/kit/segmented";
import { NumberTicker } from "@/components/kit/number-ticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LessonOrderPreview } from "@/components/enroll/lesson-order-preview";
import { SESSION_LENGTHS, WEEK_ORDER } from "@/lib/plan";
import {
  QUESTIONS,
  adaptationOf,
  precheckSupportFor,
  supportFor,
  type PrecheckResult,
  type SetupAnswers,
  type Support,
  type SupportOverride,
} from "@/lib/setup";
import { ROLE_HOOK, WORLD } from "@/lib/world";
import type { Course } from "@/data/types";

export type Pace = { sessionMinutes: number; studyDays: number[]; addToPlan: boolean };

const q = (id: string) => QUESTIONS.find((x) => x.id === id)!;

/**
 * Customise the course: every change the profile and the quick check made,
 * shown as a control the learner can adjust, with a live sample beside it.
 * Nothing is saved until "Build my course" (or "Save changes" when editing).
 */
export function CustomizeStep({
  course,
  answers,
  setAnswers,
  needs,
  setNeeds,
  precheck,
  override,
  setOverride,
  pace,
  setPace,
  editing,
  onRetakeCheck,
  onEditProfile,
  onSubmit,
}: {
  course: Course;
  answers: SetupAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<SetupAnswers>>;
  needs: string[];
  setNeeds: React.Dispatch<React.SetStateAction<string[]>>;
  precheck: PrecheckResult | null;
  override: SupportOverride;
  setOverride: (v: SupportOverride) => void;
  pace: Pace;
  setPace: React.Dispatch<React.SetStateAction<Pace>>;
  editing: boolean;
  onRetakeCheck: () => void;
  onEditProfile: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("enroll");
  const tc = useTranslations("common");
  const format = useFormatter();
  const a = adaptationOf(answers, { precheck, override });
  const set = (patch: Partial<SetupAnswers>) => setAnswers((x) => ({ ...x, ...patch }));
  const toggleNeed = (v: string, on: boolean) =>
    setNeeds((n) => (on ? [...n.filter((x) => x !== "none" && x !== v), v] : n.filter((x) => x !== v)));

  const totalMinutes = course.modules.reduce((n, m) => n + m.minutes, 0) + course.finale.steps.reduce((n, s) => n + s.minutes, 0);
  const perWeek = pace.sessionMinutes * pace.studyDays.length;
  const weeks = perWeek ? Math.max(1, Math.ceil(totalMinutes / perWeek)) : 0;
  const dayName = (d: number) => format.dateTime(new Date(Date.UTC(2026, 9, 4 + d, 12)), { weekday: "short" });
  const supportLabel = (s: Support) => t(`support_${s}`);
  const orderLabel = q("firstStep").options.find((o) => o.v === (answers.firstStep ?? "idea"))!.label;

  const roleHook = a.roleKey ? ROLE_HOOK[1]?.[a.roleKey as keyof (typeof ROLE_HOOK)[1]] : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <div className="text-sm font-medium text-brand-ink">{t("customizeKicker")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{t("customizeTitle", { course: course.title })}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t("customizeBody")}</p>
        </div>

        {/* lesson order */}
        <Section icon={<ListOrdered />} title={t("cLessonOrder")} body={t("cLessonOrderBody")}>
          <Segmented
            className="flex-wrap rounded-2xl!"
            aria-label={t("cLessonOrder")}
            value={answers.firstStep ?? "idea"}
            onValueChange={(v) => set({ firstStep: v })}
            options={q("firstStep").options.map((o) => ({ value: o.v, label: o.label }))}
          />
          <LessonOrderPreview order={a.order} />
        </Section>

        {/* field examples */}
        <Section icon={<Globe2 />} title={t("cField")} body={t("cFieldBody")}>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={answers.domain ?? "none"} onValueChange={(v) => set({ domain: v === "none" ? null : v })}>
              <SelectTrigger className="h-10 w-60" aria-label={t("cField")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {q("domain").options.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.label}
                  </SelectItem>
                ))}
                <SelectItem value="none">{t("cNoField")}</SelectItem>
              </SelectContent>
            </Select>
            {answers.domain === "other" ? (
              <Input
                aria-label={q("domain").options.find((o) => o.free)!.free}
                placeholder={q("domain").options.find((o) => o.free)!.free}
                maxLength={40}
                value={answers.domainOther ?? ""}
                onChange={(e) => set({ domainOther: e.target.value })}
                className="h-10 w-60"
              />
            ) : null}
          </div>
          <Sample show={!!a.domain && !!WORLD["1.1"]} tone="worked" label={t("worldSample", { field: a.domain?.label ?? "" })}>
            {a.domain && WORLD["1.1"] ? WORLD["1.1"](a.domain) : null}
          </Sample>
        </Section>

        {/* role framing */}
        <Section icon={<UserRound />} title={t("cRole")} body={t("cRoleBody")}>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={answers.role ?? "none"} onValueChange={(v) => set({ role: v === "none" ? null : v })}>
              <SelectTrigger className="h-10 w-60" aria-label={t("cRole")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {q("role").options.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.label}
                  </SelectItem>
                ))}
                <SelectItem value="none">{t("cNoRole")}</SelectItem>
              </SelectContent>
            </Select>
            {answers.role === "other" ? (
              <Input
                aria-label={q("role").options.find((o) => o.free)!.free}
                placeholder={q("role").options.find((o) => o.free)!.free}
                maxLength={40}
                value={answers.roleOther ?? ""}
                onChange={(e) => set({ roleOther: e.target.value })}
                className="h-10 w-60"
              />
            ) : null}
          </div>
          <Sample show={!!roleHook} tone="accent" label={t("roleSample", { role: a.roleLabel ?? "" })}>
            {roleHook}
          </Sample>
        </Section>

        {/* support per lesson */}
        <Section icon={<LifeBuoy />} title={t("cSupport")} body={t("cSupportBody")}>
          <Segmented
            className="flex-wrap rounded-2xl!"
            aria-label={t("cSupport")}
            value={override}
            onValueChange={(v) => setOverride(v as SupportOverride)}
            options={[
              { value: "auto", label: precheck && !precheck.skipped ? t("cFollowCheck") : t("cFollowExperience") },
              { value: "extra", label: t("support_extra") },
              { value: "standard", label: t("support_standard") },
              { value: "light", label: t("support_light") },
            ]}
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {course.modules.map((m, i) => (
              <li key={m.module_id} className="rounded-lg border border-line p-3">
                <div className="mb-2 text-xs font-semibold text-ink-faint">
                  {t("moduleShort", { n: i + 1 })} · {m.title}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {m.lessons.map((l) => {
                    const s = supportFor(a, l.id);
                    const fromCheck = !a.override && precheckSupportFor(a, l.id) !== undefined;
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="mr-1.5 font-mono text-xs text-ink-faint">{l.id}</span>
                          {l.title}
                        </span>
                        <motion.span key={s} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                          <Chip size="sm" tone={s === "extra" ? "warn" : s === "light" ? "ok" : "neutral"} title={fromCheck ? t("fromCheck") : undefined}>
                            {supportLabel(s)}
                            {fromCheck ? <span aria-hidden className="ml-0.5 size-1 rounded-full bg-current" /> : null}
                          </Chip>
                        </motion.span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
            <span>{precheck && !precheck.skipped ? (precheck.isNew ? t("cCheckNew") : t("cCheckDot")) : t("cNoCheck")}</span>
            <Button variant="ghost" size="sm" onClick={onRetakeCheck}>
              <RotateCcw data-icon="inline-start" />
              {precheck && !precheck.skipped ? t("cRetakeCheck") : t("cTakeCheck")}
            </Button>
          </div>
        </Section>

        {/* explanations and comfort */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
          <Section icon={<BookOpenText />} title={t("cExplain")} body={t("cExplainBody")}>
            <SwitchRow
              id="c-analogy"
              label={t("cAnalogy")}
              checked={answers.style === "steps"}
              onChange={(on) => set({ style: on ? "steps" : "short" })}
            />
          </Section>
          <Section icon={<Contrast />} title={t("cComfort")} body={t("cComfortBody")}>
            <SwitchRow id="c-text" label={t("cLargerText")} checked={needs.includes("text")} onChange={(on) => toggleNeed("text", on)} />
            <SwitchRow id="c-motion" label={t("cLessMotion")} checked={needs.includes("motion")} onChange={(on) => toggleNeed("motion", on)} />
          </Section>
        </div>

        {/* pace */}
        <Section icon={<CalendarDays />} title={t("cPace")} body={t("cPaceBody")}>
          <div role="group" aria-label={t("cStudyDays")} className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((d) => {
              const on = pace.studyDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setPace((p) => ({ ...p, studyDays: on ? p.studyDays.filter((x) => x !== d) : [...p.studyDays, d].sort() }))
                  }
                  className={cn(
                    "h-9 min-w-12 rounded-pill border px-3 text-sm font-medium transition-[transform,background-color,border-color] duration-(--dur-1) outline-none active:scale-95",
                    "focus-visible:ring-2 focus-visible:ring-ring/60",
                    on
                      ? "border-transparent bg-[linear-gradient(140deg,var(--accent-deep),var(--accent))] text-on-brand"
                      : "border-line bg-panel text-ink-muted hover:border-brand-line hover:text-ink",
                  )}
                >
                  {dayName(d)}
                </button>
              );
            })}
          </div>
          <Segmented
            className="flex-wrap rounded-2xl!"
            aria-label={t("cSessionLength")}
            value={String(pace.sessionMinutes)}
            onValueChange={(v) => setPace((p) => ({ ...p, sessionMinutes: Number(v) }))}
            options={SESSION_LENGTHS.map((m) => ({ value: String(m), label: tc("minutes", { count: m }) }))}
          />
          <p className="text-sm text-ink-muted" aria-live="polite">
            {weeks ? t("cWeeks", { weeks, minutes: totalMinutes }) : t("cNoDays")}
          </p>
          <div className="flex items-center gap-2">
            <Checkbox id="c-plan" checked={pace.addToPlan} onCheckedChange={(v) => setPace((p) => ({ ...p, addToPlan: v === true }))} />
            <Label htmlFor="c-plan" className="font-normal">
              {t("cAddToPlan")}
            </Label>
          </div>
        </Section>
      </div>

      {/* ---------------- live summary ---------------- */}
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+32px)] lg:h-fit" aria-label={t("yourCourse")}>
        <Surface pad="lg" spotlight className="grid-texture flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" aria-hidden />
            <h2 className="font-semibold">{t("yourCourse")}</h2>
          </div>
          <p className="text-sm font-medium">{course.title}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <AnimatePresence initial={false} mode="popLayout">
              {[
                { k: "role", show: !!a.roleLabel, text: t("sumRole", { role: a.roleLabel ?? "" }) },
                { k: "field", show: !!a.domain, text: t("sumField", { field: a.domain?.label ?? "" }) },
                { k: "order", show: true, text: t("sumOrder", { first: orderLabel }) },
                { k: `support-${a.support}-${a.supportSource}`, show: true, text: t(`sumSupport_${a.supportSource}`, { level: supportLabel(a.support) }) },
                { k: `analogy-${a.analogyOpen}`, show: true, text: a.analogyOpen ? t("sumAnalogyOpen") : t("sumAnalogyClosed") },
                { k: `pace-${pace.sessionMinutes}-${pace.studyDays.length}`, show: perWeek > 0, text: t("sumPace", { minutes: pace.sessionMinutes, days: pace.studyDays.length }) },
              ]
                .filter((r) => r.show)
                .map((r) => (
                  <motion.li
                    key={r.k}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="flex gap-2"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                    {r.text}
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
          {weeks ? (
            <div className="rounded-lg border border-line bg-panel p-3">
              <div className="text-xs text-ink-faint">{t("finishIn")}</div>
              <div className="text-2xl font-semibold tracking-tight">
                <NumberTicker value={weeks} /> <span className="text-base font-medium text-ink-muted">{t("weeksUnit", { count: weeks })}</span>
              </div>
            </div>
          ) : null}
          <Button size="lg" variant="brand" onClick={onSubmit}>
            <Wand2 data-icon="inline-start" />
            {editing ? t("saveChanges") : t("buildCourse")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEditProfile}>
            {t("editProfileAnswers")}
          </Button>
        </Surface>
      </aside>
    </div>
  );
}

function Section({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <Surface pad="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-ink-muted">{body}</p>
        </div>
      </div>
      {children}
    </Surface>
  );
}

function Sample({ show, tone, label, children }: { show: boolean; tone: "worked" | "accent"; label: string; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              tone === "worked" ? "border-stage-worked-line bg-stage-worked-soft" : "border-brand-line bg-brand-soft",
            )}
          >
            <div className={cn("mb-1 text-xs font-semibold", tone === "worked" ? "text-stage-worked" : "text-brand-ink")}>{label}</div>
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SwitchRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
