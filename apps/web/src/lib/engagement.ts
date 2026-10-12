/** Platform activity is independent of assessment and adaptation signals. */
export type StudyLog = { id: string; date: string; timezone: string; courseId: string | null; minutes: number; reflection: string; createdAt: string };
export type ActivityEvent = { key: string; date: string; timezone: string; courseId: string };
export type NotificationState = { read: boolean; dismissed: boolean };
export type PlatformMetric = "visit" | "planner_action" | "reward_details" | "sync_recovered";
export type EngagementState = {
  revision?: number;
  version: 1; activatedAt: string; timezone: string; timezoneHistory: { at: string; zone: string }[]; targets: { week: string; days: number }[]; goalConfigured?: boolean; savedCourses: string[]; noticeStates: Record<string, NotificationState>; deletedLogs: string[];
  showRewards: boolean; celebrations: boolean; cosmetic: string;
  logs: StudyLog[]; completions: ActivityEvent[]; baseline: string[]; grace: string[];
  ledger: { key: string; date: string; kind: "study" | "course" | "goal"; points: number }[];
  achievements: { id: string; date: string }[]; unlocked: string[];
  metrics?: { ids: string[]; counts: Partial<Record<PlatformMetric,number>>; visitDays: string[] };
  notifications: Record<string, { kind: "badge" | "goal" | "cosmetic"; subject: string; date: string; read: boolean; dismissed: boolean }>;
};
export const COSMETICS = [{ id: "orbit", points: 100 }, { id: "constellation", points: 300 }, { id: "nebula", points: 600 }] as const;
export function dateInZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function weekOf(date: string) { return shiftDay(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)); }
export function validZone(zone: string) { try { dateInZone(new Date(), zone); return true; } catch { return false; } }
export function initialEngagement(now: Date, timezone = "UTC", baseline: string[] = []): EngagementState {
  return { version: 1, activatedAt: now.toISOString(), timezone, timezoneHistory: [{ at: now.toISOString(),zone: timezone }], targets: [{ week: weekOf(dateInZone(now, timezone)), days: 3 }], savedCourses: [], noticeStates: {}, deletedLogs: [], showRewards: true, celebrations: true, cosmetic: "default", logs: [], completions: [], baseline, grace: [], ledger: [], achievements: [], unlocked: [], notifications: {} };
}
export function targetFor(state: EngagementState, week: string) {
  return [...state.targets].sort((a,b) => a.week.localeCompare(b.week)).filter((t) => t.week <= week).at(-1)?.days ?? 3;
}
export function activityDays(state: EngagementState) {
  return [...new Set([...state.logs.filter((l) => l.minutes >= 10).map((l) => l.date), ...state.completions.map((e) => e.date)])].sort();
}
/** Rebuild reversible awards; cosmetic unlocks remain permanent after corrections. */
export function recalculate(state: EngagementState): EngagementState {
  const ledger: EngagementState["ledger"] = [];
  for (const date of [...new Set(state.logs.filter((l) => l.minutes >= 10).map((l) => l.date))].sort()) ledger.push({ key: `study:${date}`, date, kind: "study", points: 20 });
  const events = [...state.completions].sort((a,b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const awarded: Record<string, number> = {};
  for (const e of events) { const count = awarded[e.date] ?? 0; if (count < 6) { ledger.push({ key: `course:${e.key}`, date: e.date, kind: "course", points: 10 }); awarded[e.date] = count + 1; } }
  const days = activityDays(state);
  const weeks = [...new Set(days.map(weekOf))].sort();
  for (const week of weeks) {
    const active = days.filter((d) => weekOf(d) === week);
    const target = targetFor(state, week);
    if (active.length >= target) ledger.push({ key: `goal:${week}`, date: active[target - 1]!, kind: "goal", points: 50 });
  }
  const goals = ledger.filter((e) => e.kind === "goal");
  const achievements = [
    ...(days.length ? [{ id: "first-day", date: days[0]! }] : []),
    ...(goals.length ? [{ id: "first-goal", date: goals[0]!.date }] : []),
    ...(days.length >= 7 ? [{ id: "seven-days", date: days[6]! }] : []),
    ...(goals.length >= 4 ? [{ id: "four-goals", date: goals[3]!.date }] : []),
  ];
  const points = ledger.reduce((sum,e) => sum + e.points, 0);
  const unlocked = [...new Set([...state.unlocked, ...COSMETICS.filter((c) => points >= c.points).map((c) => c.id)])];
  const notifications = { ...state.notifications };
  const notify = (id: string, kind: "badge" | "goal" | "cosmetic", subject: string, date: string) => {
    notifications[id] ??= { kind, subject, date, read: false, dismissed: false };
  };
  achievements.forEach((a) => notify(`badge:${a.id}`, "badge", a.id, a.date));
  goals.forEach((e) => notify(e.key, "goal", e.key.slice(5), e.date));
  unlocked.forEach((id) => notify(`cosmetic:${id}`, "cosmetic", id, ledger.at(-1)?.date ?? state.activatedAt.slice(0,10)));
  return { ...state, ledger, achievements, unlocked, notifications };
}
export function streaks(state: EngagementState, today: string) {
  const qualified = new Set(activityDays(state));
  const days = new Set([...qualified, ...state.grace]);
  let current = 0; let cursor = days.has(today) ? today : shiftDay(today, -1);
  while (days.has(cursor)) { current++; cursor = shiftDay(cursor, -1); }
  let longest = 0; let run = 0; let previous = "";
  for (const date of [...days].sort()) { run = previous && shiftDay(previous, 1) === date ? run + 1 : 1; longest = Math.max(longest, run); previous = date; }
  return { current, longest };
}
export function canGrace(state: EngagementState, today: string) {
  const yesterday = shiftDay(today, -1); const active = new Set(activityDays(state));
  return !active.has(yesterday) && !state.grace.includes(yesterday) && active.has(shiftDay(yesterday,-1)) && !state.grace.some((d) => weekOf(d) === weekOf(yesterday)) && yesterday >= dateInZone(new Date(state.activatedAt), state.timezone);
}
export function engagementView(state: EngagementState, now: Date) {
  const today = dateInZone(now, state.timezone); const week = weekOf(today); const days = activityDays(state);
  return { state, today, week, points: state.ledger.reduce((sum,e) => sum + e.points,0), activeDays: days, weeklyDays: days.filter((d) => weekOf(d) === week).length, target: targetFor(state,week), nextTarget: targetFor(state,shiftDay(week,7)), streak: streaks(state,today), graceAvailable: canGrace(state,today), loggedMinutes: state.logs.filter((l) => weekOf(l.date) === week).reduce((sum,l) => sum + l.minutes,0) };
}
export type EngagementView = ReturnType<typeof engagementView>;
