"use client";

import * as React from "react";
import { useEnrollment } from "@/lib/enrollment";
import { useProfile } from "@/lib/profile";
import { useCourseProgress } from "@/lib/course-progress";
import { agentBlueprint, type AgentBlueprint, type SetupPhase } from "@/lib/agent-build";
import { QUESTIONS, answerLabel, type PrecheckResult, type SetupAnswers } from "@/lib/setup";
import type { Course } from "@/data/types";

/**
 * The learner's agent for a course, from what is saved (profile, enrolment,
 * progress). While setting up, the enrol flow passes its live answers, quick
 * check result and step, so the agent fills in as they answer.
 */
export function useAgent(
  course: Course,
  live?: { answers: SetupAnswers; precheck: PrecheckResult | null; phase: SetupPhase | null },
): { agent: AgentBlueprint; rename: (name: string) => Promise<void> } {
  const { enrollment, enrolled } = useEnrollment(course.course_id);
  const { profile, save } = useProfile();
  const progress = useCourseProgress(course);

  const answers = React.useMemo<SetupAnswers>(() => {
    // a name the learner gave lives on the profile, so it follows them everywhere
    const agentName = live?.answers.agentName ?? profile?.answers.agentName ?? enrollment?.answers.agentName;
    // while setting up, the live answers are the whole truth (a changed field must change the agent)
    const base = live ? live.answers : { ...(profile?.answers ?? {}), ...(enrollment?.answers ?? {}) };
    return agentName ? { ...base, agentName } : base;
  }, [profile, enrollment, live]);

  const agent = React.useMemo(() => {
    const domain = QUESTIONS.find((q) => q.id === "domain");
    return agentBlueprint({
      answers,
      fieldLabel: domain ? answerLabel(domain, answers) : null,
      precheck: live ? live.precheck : (enrollment?.precheck ?? null),
      enrolled: live ? live.phase === null && enrolled : enrolled,
      phase: live?.phase ?? null,
      modules: progress.modules,
      resume: progress.resume ?? null,
    });
  }, [answers, live, enrollment, enrolled, progress]);

  const rename = React.useCallback(
    async (name: string) => {
      await save({ ...(profile?.answers ?? {}), agentName: name }, profile?.needs ?? []);
    },
    [save, profile],
  );

  return { agent, rename };
}
