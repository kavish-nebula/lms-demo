import "server-only";
import * as z from "zod/v4";

/** Request bodies for /api/v1 (and the Discovery chat). Answer values are stored as option values, never display text. */

const answer = z.string().max(40).nullable().optional();
const free = z
  .string()
  .max(80)
  .nullish()
  .transform((v) => v ?? undefined);

const transcript = z
  .array(z.object({ slot: z.string().max(20), q: z.string().max(220), a: z.string().max(200) }))
  .max(16)
  .optional();

/**
 * The profile answers, shape only. Which questions apply depends on earlier
 * answers (the field decides the rest, and a typed field may be matched to a
 * pack by the model), so the services normalise them with the learner's
 * derived result before anything is stored or planned from (normalizeAnswers):
 * answers from a branch that no longer applies, and values that are not
 * options, are dropped.
 */
export const AnswersIn = z
  .object({
    learningContext: free,
    learningContextDetail: free,
    subRole: free,
    useCase: free,
    goalDetail: free,
    agentName: free,
    tags: z.array(z.string().max(60)).max(12).optional(),
    domain: answer,
    role: answer,
    years: answer,
    tools: z.array(z.string().max(40)).max(8).nullish(),
    firstJob: answer,
    studyLevel: answer,
    studyField: answer,
    project: answer,
    goal: answer,
    experience: answer,
    coding: answer,
    firstStep: answer,
    style: answer,
    domainOther: free,
    roleOther: free,
    studyFieldOther: free,
    firstJobOther: free,
    roleKind: z.enum(["engineer", "lead", "manager", "student", "other"]).optional(),
    interview: transcript,
    known: z.array(z.string().max(12)).max(12).optional(),
    expect: z.string().trim().max(200).optional(),
    courseInterview: transcript,
    field: z.enum(["it", "manufacturing", "retail", "finance", "healthcare", "education"]).optional(),
    extra: z
      .record(z.string().max(12), z.string().max(12))
      .refine((r) => Object.keys(r).length <= 4, "at most 4 follow-up answers")
      .optional(),
  });

export const ProfileIn = z.object({ answers: AnswersIn, needs: z.array(z.enum(["text", "motion", "none"])).max(3) });

/** One step of "About you": the answers so far. */
export const ProfilingNextIn = ProfileIn;

/** One turn of the "About you" interview: the answers so far, and what the learner did with the last question. */
export const InterviewTurnIn = z.object({
  answers: AnswersIn,
  needs: z.array(z.enum(["text", "motion", "none"])).max(3),
  last: z
    .object({
      slot: z.string().min(1).max(20),
      q: z.string().max(200),
      value: z.union([z.string().max(40), z.array(z.string().max(40)).max(8)]).optional(),
      label: z.string().max(80).optional(),
      text: z.string().trim().max(200).optional(),
      kind: z.enum(["engineer", "lead", "manager", "student", "other"]).optional(),
      skipped: z.boolean().optional(),
    })
    .nullish(),
});

/** One turn of a course's enrolment questions: the course answers so far, and what the learner did with the last one. */
export const CourseFitIn = InterviewTurnIn.omit({ needs: true });

export const PaceIn = z
  .object({ sessionMinutes: z.number().int().min(5).max(120), studyDays: z.array(z.number().int().min(0).max(6)).max(7) })
  .nullable();

export const PrecheckIn = z
  .object({
    assessmentId: z.string().uuid().optional(),
    skipped: z.boolean().optional(),
    isNew: z.boolean().optional(),
    responses: z.record(z.string().max(20), z.string().max(10).nullable()).optional(),
    /** the Discovery conversation's result: best level per module, plus the learner-facing profile */
    activity: z
      .object({
        lessons: z.record(z.string().max(10), z.number().int().min(0).max(2)),
        summary: z.string().max(300).optional(),
        strengths: z.array(z.string().max(100)).max(3).optional(),
        focus: z.array(z.string().max(100)).max(3).optional(),
        learning: z.object({ firstStep: z.enum(["example", "idea", "try"]), style: z.enum(["short", "steps"]), note: z.string().max(240) }).optional(),
        ideas: z
          .array(z.object({ skill: z.string().max(10), title: z.string().max(120), held: z.string().max(200), accurate: z.boolean(), sure: z.boolean() }))
          .max(12)
          .optional(),
      })
      .optional(),
  })
  .nullable();

const SupportOverrideIn = z.enum(["auto", "light", "standard", "extra"]);

export const SetupBody = z.object({
  answers: AnswersIn,
  supportOverride: SupportOverrideIn.default("auto"),
  pace: PaceIn.default(null),
  precheck: PrecheckIn.optional(),
});

export const EnrolBody = SetupBody.extend({ courseId: z.string().min(1).max(40) });

export const SignalsBody = z.object({
  signals: z
    .array(
      z.object({
        id: z.string().min(6).max(120),
        kind: z.enum(["video_check", "recall_answer", "scenario_answer", "module_check", "final_check", "capstone_check"]),
        moduleId: z.string().max(20).nullable().default(null),
        lesson: z.string().max(20).nullable().default(null),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(50),
});

export const ProgressBody = z.object({ moduleId: z.string().min(1).max(20), stage: z.string().min(1).max(20) });

export const ImportBody = z.object({
  profile: ProfileIn.nullable().default(null),
  enrollments: z
    .array(
      z.object({
        courseId: z.string().min(1).max(40),
        answers: AnswersIn,
        supportOverride: SupportOverrideIn.default("auto"),
        precheck: z
          .object({
            at: z.string(),
            skipped: z.boolean().optional(),
            isNew: z.boolean().optional(),
            lessons: z.record(z.string(), z.number().int().min(0).max(2)),
          })
          .nullable()
          .default(null),
        enrolledAt: z.string().optional(),
      }),
    )
    .max(20)
    .default([]),
  progress: z.record(z.string().max(20), z.array(z.string().max(20)).max(20)).default({}),
});

/** The learner's project files: a few text files, each a reasonable size. */
const ProjectFiles = z
  .record(z.string().min(1).max(80), z.string().max(60_000))
  .refine((f) => Object.keys(f).length <= 10, "Too many files.");

export const ProjectSaveBody = z.object({ files: ProjectFiles });

export const ProjectCheckBody = z.object({
  files: ProjectFiles,
  records: z
    .array(
      z.object({
        ticket: z.string().min(1).max(20),
        seed: z.number().int(),
        step: z.string().max(30),
        decision: z.unknown().optional(),
        error: z.string().max(2000).optional(),
        where: z.string().max(200).nullish(),
      }),
    )
    .max(100),
});

/** One message to Pip. Lengths match the input box; the history is the browser's copy, so it is capped too. */
const stepText = (max: number) => z.string().max(max).optional();
export const CompanionBody = z.object({
  message: z.string().trim().min(1).max(600),
  phase: z.string().max(40),
  moduleId: z.string().max(40).optional(),
  step: z
    .object({ title: stepText(200), guidance: stepText(1000), hint: stepText(1000), videoId: stepText(80), slideTitle: stepText(200) })
    .optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1500) }))
    .max(8)
    .default([]),
});
