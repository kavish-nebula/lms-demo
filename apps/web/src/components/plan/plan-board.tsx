"use client";

import * as React from "react";
import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarCheck2, CalendarPlus, Clock3, HeartPulse, ListTodo, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Surface } from "@/components/kit/surface";
import { Segmented } from "@/components/kit/segmented";
import { StatTile } from "@/components/kit/stat-tile";
import { Stagger, StaggerItem } from "@/components/kit/stagger";
import { PlanCalendar } from "@/components/plan/plan-calendar";
import { PlanOutline } from "@/components/plan/plan-outline";
import { UpNextTicker } from "@/components/plan/up-next-ticker";
import { keyDate, useCourseUnits, usePlanState } from "@/components/plan/use-plan";
import {
  addDays,
  autoFill,
  dayItems,
  SESSION_LENGTHS,
  sessionId,
  WEEK_ORDER,
  type PlanSession,
  type PlanUnit,
} from "@/lib/plan";
import type { Assignment, Course, DueReview, HistoryEntry } from "@/data/types";

export type PlanBoardProps = {
  courses: Course[];
  reviews: DueReview[];
  history: HistoryEntry[];
  assignments: Assignment[];
  today: string;
};

/**
 * S2b Learning plan (ported from the prototype's /plan): add a session on a
 * chosen day, set study days and session length, "Plan it for me", a course
 * outline, and the study calendar. Nothing here is a deadline.
 */
export function PlanBoard({ courses, reviews, history, assignments, today }: PlanBoardProps) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { plan, setPlan } = usePlanState();
  const { byCourse, all } = useCourseUnits(courses);

  const firstOpen = courses.find((c) => byCourse.get(c.course_id)?.some((u) => !u.done)) ?? courses[0]!;
  const [courseId, setCourseId] = React.useState(firstOpen.course_id);
  const [selected, setSelected] = React.useState(today);
  const [picked, setPicked] = React.useState<string | null>(null);

  const course = courses.find((c) => c.course_id === courseId) ?? courses[0]!;
  const units = byCourse.get(course.course_id) ?? [];
  const remaining = units.filter((u) => !u.done);
  const plannedOn = Object.fromEntries(plan.sessions.map((s) => [s.unitId, s.date]));
  const unplanned = remaining.filter((u) => !plannedOn[u.id]);
  const unitId = remaining.some((u) => u.id === picked) ? picked! : (unplanned[0] ?? remaining[0])?.id;
  const nextUp = remaining[0];

  const days = React.useMemo(
    () => dayItems({ sessions: plan.sessions, units: all, reviews, history, today }),
    [plan.sessions, all, reviews, history, today],
  );

  // stats across every course
  const openSessions = plan.sessions.filter((s) => s.date >= today && !all.get(s.unitId)?.done);
  const minutesPlanned = openSessions.reduce((n, s) => n + (all.get(s.unitId)?.minutes ?? 0), 0);
  const weekEnd = addDays(today, 7);
  const checksThisWeek = reviews.filter((r) => r.due <= weekEnd).length;

  const short = (key: string) => format.dateTime(keyDate(key), { weekday: "short", day: "numeric", month: "short" });
  const label = (u: PlanUnit) => `${u.label} · ${u.moduleTitle}`;
  const playerHref = (u: PlanUnit) => u.href;

  function replaceSessions(next: PlanSession[], undoTo?: PlanSession[], message?: string) {
    setPlan({ ...plan, sessions: next });
    if (message && undoTo) {
      toast.success(message, {
        action: { label: t("undo"), onClick: () => setPlan({ ...plan, sessions: undoTo }) },
      });
    }
  }

  function addOn(date: string, u: PlanUnit) {
    if (plan.sessions.some((s) => s.unitId === u.id && s.date === date)) {
      toast.info(t("alreadyPlanned", { date: short(date) }));
      return;
    }
    const before = plan.sessions;
    replaceSessions([...before, { id: sessionId(date, u.id), date, unitId: u.id }], before, t("toastPlanned", { step: label(u), date: short(date) }));
    const after = unplanned.find((x) => x.id !== u.id);
    if (after) setPicked(after.id);
  }

  function planSession() {
    const u = remaining.find((x) => x.id === unitId);
    if (u && selected >= today) addOn(selected, u);
  }

  function fill() {
    const extra = autoFill(remaining, plan, today);
    const before = plan.sessions;
    replaceSessions([...before, ...extra], before, t("toastAuto", { count: extra.length }));
    if (extra[0]) setSelected(extra[0].date);
  }

  function clearPlanned() {
    const ids = new Set(remaining.map((u) => u.id));
    const before = plan.sessions;
    const kept = before.filter((s) => !ids.has(s.unitId));
    replaceSessions(kept, before, t("toastCleared", { count: before.length - kept.length }));
  }

  function removeSession(id: string) {
    const before = plan.sessions;
    replaceSessions(before.filter((s) => s.id !== id), before, t("removed"));
  }

  function toggleDay(d: number) {
    const studyDays = plan.studyDays.includes(d) ? plan.studyDays.filter((x) => x !== d) : [...plan.studyDays, d].sort();
    setPlan({ ...plan, studyDays });
  }

  const courseOpenSessions = plan.sessions.filter((s) => remaining.some((u) => u.id === s.unitId));
  const weekdayName = (d: number) => format.dateTime(new Date(Date.UTC(2026, 9, 4 + d, 12)), { weekday: "short" }); // 2026-10-04 is a Sunday

  return (
    <div className="flex flex-col gap-6">
      <UpNextTicker courses={courses} reviews={reviews} assignments={assignments} today={today} />

      <Stagger className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StaggerItem>
          <StatTile icon={<CalendarCheck2 />} value={openSessions.length} label={t("statPlanned")} />
        </StaggerItem>
        <StaggerItem>
          <StatTile icon={<Clock3 />} value={minutesPlanned} suffix=" min" label={t("statMinutes")} />
        </StaggerItem>
        <StaggerItem>
          <StatTile icon={<ListTodo />} value={unplanned.length} label={t("statLeft")} hint={course.title} />
        </StaggerItem>
        <StaggerItem>
          <StatTile icon={<HeartPulse />} value={checksThisWeek} label={t("statChecks")} />
        </StaggerItem>
      </Stagger>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ---------------- add a session ---------------- */}
        <Surface pad="lg" spotlight className="flex flex-col gap-5 xl:col-start-1 xl:row-start-1">
          <div>
            <div className="text-xs font-semibold tracking-[0.14em] text-brand-ink uppercase">{t("addTitle")}</div>
            <p className="mt-1 text-sm text-ink-muted">{t("addBody")}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="plan-course">{t("course")}</Label>
              <Select
                value={course.course_id}
                onValueChange={(v) => {
                  setCourseId(v);
                  setPicked(null);
                }}
              >
                <SelectTrigger id="plan-course" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.course_id} value={c.course_id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-day">{t("day")}</Label>
              <Input
                id="plan-day"
                type="date"
                min={today}
                value={selected}
                onChange={(e) => e.target.value && setSelected(e.target.value)}
                className="h-10"
                aria-describedby={selected < today ? "plan-day-error" : undefined}
                aria-invalid={selected < today || undefined}
              />
            </div>
          </div>

          {remaining.length ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="plan-unit">{t("session")}</Label>
                <Select value={unitId} onValueChange={setPicked}>
                  <SelectTrigger id="plan-unit" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {remaining.map((u, i) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.moduleIndex ? t("moduleN", { n: u.moduleIndex }) : t("finaleShort")} · {u.label} · {tc("minutes", { count: u.minutes })}
                        {i === 0 ? ` · ${t("nextUp")}` : ""}
                        {plannedOn[u.id] ? ` · ${t("optionPlanned", { date: short(plannedOn[u.id]!) })}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="lg" variant="brand" className="h-10" onClick={planSession} disabled={selected < today || !unitId}>
                <CalendarPlus data-icon="inline-start" />
                {t("planSession")}
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-ok-line bg-ok-soft p-3 text-sm">{t("allDone")}</p>
          )}
          {selected < today ? (
            <p id="plan-day-error" className="-mt-2 text-sm text-err">
              {t("pastDay")}
            </p>
          ) : null}

          <div className="grid gap-5 border-t border-line pt-5 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div role="group" aria-labelledby="study-days-label" className="flex flex-col gap-2">
              <span id="study-days-label" className="font-mono text-xs text-ink-faint">
                {t("studyDays")}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_ORDER.map((d) => {
                  const on = plan.studyDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(d)}
                      className={cn(
                        "h-9 min-w-12 rounded-pill border px-3 text-sm font-medium transition-[transform,background-color,border-color] duration-(--dur-1) outline-none active:scale-95",
                        "focus-visible:ring-2 focus-visible:ring-ring/60",
                        on
                          ? "border-transparent bg-[linear-gradient(140deg,var(--accent-deep),var(--accent))] text-on-brand shadow-[0_8px_20px_-10px_var(--accent)]"
                          : "border-line bg-panel text-ink-muted hover:border-brand-line hover:text-ink",
                      )}
                    >
                      {weekdayName(d)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span id="session-length-label" className="font-mono text-xs text-ink-faint">
                {t("sessionLength")}
              </span>
              <Segmented
                aria-label={t("sessionLength")}
                value={String(plan.sessionMinutes)}
                onValueChange={(v) => setPlan({ ...plan, sessionMinutes: Number(v) })}
                options={SESSION_LENGTHS.map((m) => ({ value: String(m), label: tc("minutes", { count: m }) }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs text-ink-faint">{plan.studyDays.length ? t("hintAuto") : t("hintNoDays")}</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={clearPlanned} disabled={courseOpenSessions.length === 0}>
                {t("clearPlanned")}
              </Button>
              <Button variant="outline" onClick={fill} disabled={plan.studyDays.length === 0 || unplanned.length === 0}>
                <Wand2 data-icon="inline-start" />
                {t("planForMe")}
              </Button>
            </div>
          </div>
        </Surface>

        {/* ---------------- calendar ---------------- */}
        <Surface pad="lg" className="grid-texture h-fit xl:sticky xl:top-[calc(var(--nav-h)+24px)] xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <PlanCalendar
            days={days}
            today={today}
            selected={selected}
            onSelect={setSelected}
            nextUp={nextUp}
            suggestion={unplanned[0]}
            onPlanHere={(key) => unplanned[0] && addOn(key, unplanned[0])}
            onRemove={removeSession}
            playerHref={playerHref}
          />
        </Surface>

        {/* ---------------- outline ---------------- */}
        <Surface pad="lg" className="xl:col-start-1 xl:row-start-2">
          <PlanOutline
            title={course.title}
            units={units}
            plannedOn={plannedOn}
            nextUpId={nextUp?.id}
            pickedId={unitId}
            onPick={(id) => {
              setPicked(id);
              const date = plannedOn[id];
              if (date) setSelected(date);
            }}
          />
        </Surface>
      </div>
    </div>
  );
}

