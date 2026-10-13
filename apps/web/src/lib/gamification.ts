import type { Course } from "@/data/types";
import type { CourseProgress } from "@/lib/course-progress";
import type { LearningState } from "@/lib/learning-state";
import type { StageId } from "@/lib/stages";

export const STAGE_XP: Partial<Record<StageId, number>> = {
  hook: 10,
  worked: 20,
  guided: 30,
  lab: 30,
  gate: 50,
  review: 20,
};

const RANKS = [
  { min: 0, title: "Explorer" },
  { min: 150, title: "Problem Solver" },
  { min: 400, title: "Agent Builder" },
  { min: 750, title: "Agent Engineer" },
  { min: 1100, title: "Safety Specialist" },
  { min: 1450, title: "AI Architect" },
] as const;

const UPGRADE_NAMES = ["Scout’s Brain", "Language Engine", "Tool Belt", "Memory Core", "Reliability Shield", "Launch License"];
const UPGRADE_ICONS = ["◉", "◇", "⌁", "◎", "⬡", "✦"];

export type GameBadge = { id: string; name: string; detail: string; earned: boolean };
export type ModuleMastery = { moduleId: string; stars: number; upgrade: string; icon: string; earned: boolean };
export type GameQuest = { eyebrow: string; title: string; detail: string; href: string; xp: number; dailyDone: boolean };
export type GameProgress = {
  xp: number;
  sparks: number;
  level: number;
  rank: string;
  nextRank?: string;
  nextXp?: number;
  levelProgress: number;
  streak: number;
  mastery: ModuleMastery[];
  badges: GameBadge[];
  quest: GameQuest;
};

function stamp(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / 86_400_000;
}

export function learningStreak(days: string[], today: Date | string = new Date()) {
  const unique = new Set(days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  const current = stamp(today);
  if (!current || !unique.size) return 0;
  let cursor = dayNumber(current);
  if (!unique.has(current)) cursor -= 1; // a learner keeps yesterday's streak until today ends
  let count = 0;
  let recoveryUsed = false;
  while (true) {
    const at = new Date(cursor * 86_400_000).toISOString().slice(0, 10);
    if (unique.has(at)) {
      count += 1;
      cursor -= 1;
      continue;
    }
    const before = new Date((cursor - 1) * 86_400_000).toISOString().slice(0, 10);
    if (!recoveryUsed && unique.has(before)) {
      recoveryUsed = true;
      cursor -= 1;
      continue;
    }
    break;
  }
  return count;
}

export function rewardFor(stage: StageId, video = false) {
  return video ? 10 : STAGE_XP[stage] ?? 15;
}

export function deriveGameProgress(
  course: Course,
  progress: CourseProgress,
  learning: LearningState,
  watched: string[],
  dueReviews = 0,
  today: Date | string = new Date(),
  enrolled = false,
): GameProgress {
  let xp = enrolled ? 25 : 0;
  for (const module of progress.modules) {
    for (const stage of module.done) if (stage !== "explainer") xp += STAGE_XP[stage] ?? 0;
    const watchedHere = watched.filter((id) => id.startsWith(`${module.module_id}-`)).length;
    const allVideos = course.modules.find((m) => m.module_id === module.module_id)?.lessons.length ?? 0;
    xp += Math.max(watchedHere, module.done.includes("explainer") ? allVideos : 0) * 10;
  }
  xp += learning.attempts.filter((a) => a.correct).length * 5;
  xp += Object.values(learning.reflections).filter((value) => value.trim().length > 10).length * 10;
  xp += learning.reviews.filter((review) => review.completedAt).length * 15;
  if (progress.finaleState.done.includes("capstone")) xp += 150;
  if (progress.finaleState.done.includes("final-check")) xp += 100;
  if (progress.finaleState.done.includes("wrap-up")) xp += 25;

  let rankIndex = 0;
  RANKS.forEach((rank, index) => { if (xp >= rank.min) rankIndex = index; });
  const rank = RANKS[rankIndex]!;
  const next = RANKS[rankIndex + 1];
  const levelProgress = next ? Math.min(1, (xp - rank.min) / (next.min - rank.min)) : 1;
  const mastery = progress.modules.map((module, index) => {
    const attempts = learning.attempts.filter((attempt) => attempt.moduleId === module.module_id);
    const gatePassed = attempts.some((attempt) => attempt.id === `gate:${module.module_id}` && attempt.correct);
    const correctHere = attempts.filter((attempt) => attempt.correct).length;
    const stars = module.done.length === 0 ? 0 : module.liveState === "done" && gatePassed && correctHere >= 3 ? 3 : gatePassed || module.liveState === "done" ? 2 : 1;
    return {
      moduleId: module.module_id,
      stars,
      upgrade: UPGRADE_NAMES[index] ?? "Scout upgrade",
      icon: UPGRADE_ICONS[index] ?? "✦",
      earned: module.liveState === "done",
    };
  });

  const correct = learning.attempts.filter((attempt) => attempt.correct).length;
  const badges: GameBadge[] = [
    { id: "first", name: "First Signal", detail: "Complete your first course action", earned: progress.topicsDone > 0 },
    { id: "solver", name: "Problem Solver", detail: "Solve three practice checks", earned: correct >= 3 },
    { id: "practice", name: "Practice Pro", detail: "Solve five practice checks", earned: correct >= 5 },
    { id: "builder", name: "Tool Builder", detail: "Complete Agent Tools", earned: mastery[2]?.earned ?? false },
    { id: "memory", name: "Memory Keeper", detail: "Complete Memory & Planning", earned: mastery[3]?.earned ?? false },
    { id: "recall", name: "Recall Streak", detail: "Complete three spaced reviews", earned: learning.reviews.filter((r) => r.completedAt).length >= 3 },
    { id: "architect", name: "AI Architect", detail: "Launch Scout and finish the course", earned: progress.complete },
  ];

  const todayStamp = stamp(today);
  const dailyDone = learning.activityDays.includes(todayStamp);
  const resume = progress.resume;
  const reviewModule = progress.modules.find((m) => learning.reviews.some((r) => r.moduleId === m.module_id && !r.completedAt && new Date(r.due) <= new Date(today)));
  const quest: GameQuest = dueReviews && reviewModule
    ? { eyebrow: dailyDone ? "BONUS MISSION" : "TODAY’S MISSION", title: "Recall one earlier idea", detail: "A quick return visit strengthens Scout’s memory.", href: `/learn/courses/${course.course_id}/${reviewModule.module_id}/review`, xp: 15, dailyDone }
    : resume
      ? { eyebrow: dailyDone ? "BONUS MISSION" : "TODAY’S MISSION", title: resume.kind === "finale" ? `Final mission: ${resume.title}` : `Continue: ${resume.title}`, detail: `${resume.minutesLeft} min remaining · ${resume.group}`, href: resume.href, xp: resume.kind === "finale" ? resume.n === 1 ? 150 : 100 : rewardFor(resume.stage), dailyDone }
      : { eyebrow: "SCOUT IS READY", title: "Keep your skills sharp", detail: "Revisit a scenario or complete a spaced review.", href: `/learn/courses/${course.course_id}/m1/review`, xp: 15, dailyDone };

  return {
    xp,
    sparks: Math.floor(xp / 50) * 10,
    level: rankIndex + 1,
    rank: rank.title,
    nextRank: next?.title,
    nextXp: next?.min,
    levelProgress,
    streak: learningStreak(learning.activityDays, today),
    mastery,
    badges,
    quest,
  };
}
