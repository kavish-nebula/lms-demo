"use client";

import * as React from "react";
import { useLocalPrefix } from "@/lib/local-store";
import { EMPTY_FINALE, FINALE_PREFIX, type FinaleState } from "@/lib/finale";
import { useEnrollments } from "@/lib/enrollment";
import { adaptationOf } from "@/lib/setup";
import { orderStages, topicOf } from "@/lib/topics";
import type { Course, CourseModule, FinaleStep, ModuleState } from "@/data/types";
import type { GateResult } from "@/data/mock-grader";
import type { StageId } from "@/lib/stages";

const PREFIX = "lms-progress:";
const GATE_PREFIX = "lms-gate:v1:";

/** The regular module journey. Review is a later scheduled return visit. */
export function moduleFlowStages(stages: readonly StageId[]): StageId[] {
  return stages.filter((stage) => stage !== "review" && stage !== "reflection");
}

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
 * Live course state from what the player has stored. A passed module quiz
 * unlocks the next module. The finale then unlocks one step at a time.
 * `exampleFirst` follows the learner's setup, so "next" matches the player.
 */
export function deriveProgress(
  course: Course,
  stored: Record<string, StageId[]>,
  finaleState: FinaleState = EMPTY_FINALE,
  exampleFirst = false,
  gatePassed: Record<string, boolean> = {},
): CourseProgress {
  const base = `/learn/courses/${course.course_id}`;
  let pathUnlocked = true;
  const modules: ModuleProgress[] = course.modules.map((m, i) => {
    const done = (stored[m.module_id] ?? []).filter((s) => m.stages.includes(s));
    const flow = moduleFlowStages(m.stages);
    const quizPassed = gatePassed[`${course.course_id}:${m.module_id}`] === true;
    const complete = m.stages.includes("gate") ? quizPassed : flow.every((s) => done.includes(s));
    const locked = !pathUnlocked;
    const liveState: ModuleState = locked ? "locked" : complete ? "done" : done.length ? "in_progress" : "available";
    // the next topic that has content (Modules 2-5 have their concept videos so far)
    const playable = orderStages(flow, exampleFirst).filter((s) => !m.authored || m.authored.includes(s));
    const next = locked || complete ? undefined : playable.find((s) => !done.includes(s));
    pathUnlocked = pathUnlocked && complete;
    return { ...m, index: i + 1, done, next, liveState };
  });
  const modulesDone = modules.filter((m) => m.liveState === "done").length;
  const allModulesDone = modulesDone === modules.length;

  const finale: FinaleProgress[] = course.finale.steps.map((step, i) => ({
    step,
    done: finaleState.done.includes(step.id),
    locked: !allModulesDone || (i > 0 && !finaleState.done.includes(course.finale.steps[i - 1]!.id)),
  }));

  const topicsTotal = modules.reduce((n, m) => n + moduleFlowStages(m.stages).length, 0) + finale.length;
  const topicsDone =
    modules.reduce((n, m) => {
      const flow = moduleFlowStages(m.stages);
      return n + (m.liveState === "done" ? flow.length : m.done.filter((s) => flow.includes(s)).length);
    }, 0) + finale.filter((f) => f.done).length;

  let resume: ResumePoint | undefined;
  const current = modules.find((m) => m.liveState === "in_progress") ?? modules.find((m) => m.liveState === "available");
  if (current?.next) {
    const at = topicOf(current, current.next);
    const order = orderStages(moduleFlowStages(current.stages), exampleFirst);
    const doneInFlow = current.done.filter((s) => order.includes(s)).length;
    resume = {
      kind: "module",
      href: `${base}/${current.module_id}/${current.next}`,
      group: current.title,
      moduleIndex: current.index,
      title: at?.topic.title ?? current.title,
      stage: current.next,
      n: order.indexOf(current.next) + 1,
      total: order.length,
      minutesLeft: Math.max(1, Math.round(current.minutes * (1 - doneInFlow / order.length))),
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

function useStored() {
  const raw = useLocalPrefix<StageId[]>(PREFIX);
  const finales = useLocalPrefix<FinaleState>(FINALE_PREFIX);
  const gateResults = useLocalPrefix<GateResult>(GATE_PREFIX);
  return React.useMemo(() => {
    const stored: Record<string, StageId[]> = {};
    for (const [k, v] of Object.entries(raw)) stored[k.slice(PREFIX.length)] = v;
    const finale: Record<string, FinaleState> = {};
    for (const [k, v] of Object.entries(finales)) finale[k.slice(FINALE_PREFIX.length)] = v;
    const gates: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(gateResults)) {
      const id = k.slice(GATE_PREFIX.length);
      const divider = id.lastIndexOf(":gate-");
      if (divider < 0) continue;
      gates[`${id.slice(0, divider)}:${id.slice(divider + 6)}`] = v.passed === true;
    }
    return { stored, finale, gates };
  }, [raw, finales, gateResults]);
}

function useExampleFirst() {
  const enrollments = useEnrollments();
  return React.useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const [id, e] of Object.entries(enrollments)) out[id] = adaptationOf(e.answers).order[0] === "example";
    return out;
  }, [enrollments]);
}

export function useCourseProgress(course: Course): CourseProgress {
  const { stored, finale, gates } = useStored();
  const exampleFirst = useExampleFirst();
  const id = course.course_id;
  return React.useMemo(
    () => deriveProgress(course, stored, finale[id], exampleFirst[id], gates),
    [course, stored, finale, exampleFirst, gates, id],
  );
}

/** Progress for several courses at once (dashboard), keyed by course id. */
export function useCoursesProgress(courses: Course[]): Record<string, CourseProgress> {
  const { stored, finale, gates } = useStored();
  const exampleFirst = useExampleFirst();
  return React.useMemo(() => {
    const out: Record<string, CourseProgress> = {};
    for (const c of courses) out[c.course_id] = deriveProgress(c, stored, finale[c.course_id], exampleFirst[c.course_id], gates);
    return out;
  }, [courses, stored, finale, exampleFirst, gates]);
}
