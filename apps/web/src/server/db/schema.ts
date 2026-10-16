import { integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { LearnerPlan, PlanChangeT, PlanSource, PlanStatus, PlanVersion } from "@/lib/learner-plan";
import type { PrecheckResult, SetupAnswers, SupportOverride } from "@/lib/setup";
import type { ProfileDerived } from "@/lib/profiling/derived";
import type { EngagementState } from "@/lib/engagement";
import type { Workflow, WorkflowReport } from "@/lib/workflow-project";

/**
 * Learner data. Profile answers drive the course plan; plans are append-only
 * versions (the adaptation log); signals are the answers that make the
 * planner revise a plan. Ids stay text where the content layer already names things
 * (course "n8n", module "m1", lesson "2.1").
 */

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Versioned platform records share a learner lock; no course data is rewritten. */
export const platformEngagement = pgTable("platform_engagement", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<EngagementState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: created(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<SetupAnswers>().notNull(),
  needs: jsonb("needs").$type<string[]>().notNull(),
  /** what the language model worked out from a typed field (lib/profiling/derived.ts) */
  derived: jsonb("derived").$type<ProfileDerived>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * "About you" while it is being answered: saved after each answer, so the
 * chat resumes where the learner left it, on any device. Becomes the profile
 * (and is deleted) when they finish.
 */
export const profileDrafts = pgTable("profile_drafts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<SetupAnswers>().notNull(),
  needs: jsonb("needs").$type<string[]>().notNull(),
  derived: jsonb("derived").$type<ProfileDerived>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** How the learner set up one course: their answers for it, help override, study pace, quick check. */
export type Pace = { sessionMinutes: number; studyDays: number[] };
export type StoredPrecheck = PrecheckResult & { responses?: Record<string, string | null> };

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    answers: jsonb("answers").$type<SetupAnswers>().notNull(),
    supportOverride: text("support_override").$type<SupportOverride>().notNull().default("auto"),
    pace: jsonb("pace").$type<Pace | null>(),
    precheck: jsonb("precheck").$type<StoredPrecheck | null>(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("enrollments_user_course").on(t.userId, t.courseId)],
);

export const learnerPlans = pgTable(
  "learner_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<PlanStatus>().notNull(),
    source: text("source").$type<PlanSource>().notNull(),
    trigger: text("trigger").$type<PlanVersion["trigger"]>().notNull(),
    model: text("model"),
    plan: jsonb("plan").$type<LearnerPlan | null>(),
    changes: jsonb("changes").$type<PlanChangeT[]>().notNull().default([]),
    usage: jsonb("usage").$type<Record<string, number> | null>(),
    error: text("error"),
    createdAt: created(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("learner_plans_version").on(t.enrollmentId, t.version)],
);

export const signals = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  moduleId: text("module_id"),
  lesson: text("lesson"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  usedInPlanVersion: integer("used_in_plan_version"),
  createdAt: created(),
});

export const stepProgress = pgTable(
  "step_progress",
  {
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    stage: text("stage").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.enrollmentId, t.moduleId, t.stage] })],
);

/** One piece of a module rewritten for one learner (content/adapt): the hook, a concept video, or the worked examples. */
export type AdaptedPiece = "hook" | "worked" | "world" | `video:${string}`;
export type AdaptedStatus = "writing" | "voicing" | "ready" | "failed";

/**
 * A module piece rewritten into the learner's own world: the content in the
 * authored shape, and the narration clips made for it. A piece is shown only
 * when `ready` (its text and voice match); until then the authored one plays.
 * `inputs` fingerprints what it was written from, so a changed setup rewrites it.
 */
export const adaptedContent = pgTable(
  "adapted_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    piece: text("piece").$type<AdaptedPiece>().notNull(),
    status: text("status").$type<AdaptedStatus>().notNull(),
    inputs: text("inputs").notNull(),
    content: jsonb("content").$type<Record<string, unknown> | null>(),
    audio: jsonb("audio").$type<Record<string, string> | null>(),
    model: text("model"),
    error: text("error"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("adapted_content_piece").on(t.enrollmentId, t.moduleId, t.piece)],
);

/**
 * The retired Python mini project ("Code and run"): learners' files and last
 * test report, kept so nothing they wrote is lost. Nothing writes to it now.
 */
export const projectWork = pgTable("project_work", {
  enrollmentId: uuid("enrollment_id")
    .primaryKey()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  files: jsonb("files").$type<Record<string, string>>().notNull(),
  report: jsonb("report").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The mini project: the agent's workflow, as the learner drew it. */
export const workflowProjects = pgTable("workflow_projects", {
  enrollmentId: uuid("enrollment_id").primaryKey().references(() => enrollments.id, { onDelete: "cascade" }),
  diagram: jsonb("diagram").$type<Workflow>().notNull(),
  report: jsonb("report").$type<WorkflowReport>(),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
