import "server-only";
import * as z from "zod/v4";

/** Request bodies for /api/v1. Answer values are stored as option values, never display text. */

const answer = z.string().max(40).nullable().optional();
const free = z
  .string()
  .max(80)
  .nullish()
  .transform((v) => v ?? undefined);

export const AnswersIn = z.object({
  domain: answer,
  role: answer,
  goal: answer,
  experience: answer,
  firstStep: answer,
  style: answer,
  domainOther: free,
  roleOther: free,
});

export const ProfileIn = z.object({ answers: AnswersIn, needs: z.array(z.enum(["text", "motion", "none"])).max(3) });

export const PaceIn = z
  .object({ sessionMinutes: z.number().int().min(5).max(120), studyDays: z.array(z.number().int().min(0).max(6)).max(7) })
  .nullable();

export const PrecheckIn = z
  .object({
    skipped: z.boolean().optional(),
    isNew: z.boolean().optional(),
    responses: z.record(z.string().max(20), z.string().max(10).nullable()).optional(),
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
