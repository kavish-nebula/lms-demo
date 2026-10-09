"use client";

import * as React from "react";
import { useLocalPrefix } from "@/lib/local-store";
import { EMPTY_FINALE, FINALE_PREFIX, type FinaleState } from "@/lib/finale";
import { useLearnerData } from "@/lib/api";
import { planTopicOrder, type LearnerPlan } from "@/lib/learner-plan";
import { adaptationOf } from "@/lib/setup";
import { orderStages, topicOf } from "@/lib/topics";
import type { Course, CourseModule, FinaleStep, ModuleState } from "@/data/types";
import type { StageId } from "@/lib/stages";

const PREFIX = "lms-progress:";

export type ModuleProgress = CourseModule & {
  index: number;
  done: StageId[];
  /** first topic not yet done, in delivery order */
  next?: StageId;
  liveState: ModuleState;
};

export type FinaleProgress = { step: FinaleStep; done: boolean; locked: boolean };

/** Where "Resume" goes: a module topic, or a finale step once every module is done. */
export type ResumePoint = {
  kind: "module" | "finale";
  href: string;
  /** module title, or the finale's group title */
  group: string;
  /** 1-based module index; 0 for the finale */
  moduleIndex: number;
  title: string;
  stage: StageId;
  n: number;
  total: number;
  minutesLeft: number;
};

export type CourseProgress = {
  modules: ModuleProgress[];
  modulesDone: number;
  allModulesDone: boolean;
  finale: FinaleProgress[];
  finaleState: FinaleState;
  topicsDone: number;
  topicsTotal: number;
  ratio: number;
  complete: boolean;
  resume?: ResumePoint;
};

/**
 * Live course state from what the player has stored. Prototype: nothing is
 * locked. Every module and every finale step (capstone, final check,
 * wrap-up) can be opened at any time; modules are still listed first.
 * Topic order follows the learner's plan (or, without one, `exampleFirst`
 * from their setup), so "next" matches the player.
 */
export function deriveProgress(
  course: Course,
  stored: Record<string, StageId[]>,
  finaleState: FinaleState = EMPTY_FINALE,
  exampleFirst = false,
  plan: LearnerPlan | null = null,
): CourseProgress {
  const base = `/learn/courses/${course.course_id}`;
  const orderOf = (m: CourseModule) => planTopicOrder(plan, m.module_id, m.stages) ?? orderStages(m.stages, exampleFirst);
  const modules: ModuleProgress[] = course.modules.map((m, i) => {
    const done = (stored[m.module_id] ?? []).filter((s) => m.stages.includes(s));
    const complete = m.stages.every((s) => done.includes(s));
    const liveState: ModuleState = complete ? "done" : done.length ? "in_progress" : "available";
    // the next topic that has content (Modules 2-5 have their concept videos so far)
    const playable = orderOf(m).filter((s) => !m.authored || m.authored.includes(s));
    const next = playable.find((s) => !done.includes(s));
    return { ...m, index: i + 1, done, next, liveState };
  });
  const modulesDone = modules.filter((m) => m.liveState === "done").length;
  const allModulesDone = modulesDone === modules.length;

  const finale: FinaleProgress[] = course.finale.steps.map((step) => ({
    step,
    done: finaleState.done.includes(step.id),
    locked: false,
  }));

  const topicsTotal = modules.reduce((n, m) => n + m.stages.length, 0) + finale.length;
  const topicsDone = modules.reduce((n, m) => n + m.done.length, 0) + finale.filter((f) => f.done).length;

  let resume: ResumePoint | undefined;
  const current = modules.find((m) => m.liveState === "in_progress") ?? modules.find((m) => m.liveState === "available");
  if (current?.next) {
    const at = topicOf(current, current.next);
    const order = orderOf(current);
    resume = {
      kind: "module",
      href: `${base}/${current.module_id}/${current.next}`,
      group: current.title,
      moduleIndex: current.index,
      title: at?.topic.title ?? current.title,
      stage: current.next,
      n: order.indexOf(current.next) + 1,
      total: order.length,
      minutesLeft: Math.max(1, Math.round(current.minutes * (1 - current.done.length / current.stages.length))),
    };
  } else {
    const i = finale.findIndex((f) => !f.done && !f.locked);
    const f = finale[i];
    if (f) {
      resume = {
        kind: "finale",
        href: `${base}/finale/${f.step.id}`,
        group: course.finale.title,
        moduleIndex: 0,
        title: f.step.title,
        stage: f.step.stage,
        n: i + 1,
        total: finale.length,
        minutesLeft: f.step.minutes,
      };
    }
  }

  return {
    modules,
    modulesDone,
    allModulesDone,
    finale,
    finaleState,
    topicsDone,
    topicsTotal,
    ratio: topicsTotal ? topicsDone / topicsTotal : 0,
    complete: allModulesDone && finale.every((f) => f.done),
    resume,
  };
}

/** Per course: topics done (server for enrolled learners, this browser for previews), finale state, plan, setup. */
function useStored() {
  const { enrollments } = useLearnerData();
  const local = useLocalPrefix<StageId[]>(PREFIX);
  const finales = useLocalPrefix<FinaleState>(FINALE_PREFIX);
  return React.useMemo(() => {
    const preview: Record<string, StageId[]> = {};
    for (const [k, v] of Object.entries(local)) preview[k.slice(PREFIX.length)] = v;
    const finale: Record<string, FinaleState> = {};
    for (const [k, v] of Object.entries(finales)) finale[k.slice(FINALE_PREFIX.length)] = v;
    return (course: Course) => {
      const e = enrollments[course.course_id];
      return deriveProgress(
        course,
        e ? (e.progress as Record<string, StageId[]>) : preview,
        finale[course.course_id],
        e ? adaptationOf(e.answers).order[0] === "example" : false,
        e?.plan?.plan ?? null,
      );
    };
  }, [enrollments, local, finales]);
}

export function useCourseProgress(course: Course): CourseProgress {
  const derive = useStored();
  return React.useMemo(() => derive(course), [derive, course]);
}

/** Progress for several courses at once (dashboard), keyed by course id. */
export function useCoursesProgress(courses: Course[]): Record<string, CourseProgress> {
  const derive = useStored();
  return React.useMemo(() => Object.fromEntries(courses.map((c) => [c.course_id, derive(c)])), [courses, derive]);
}
