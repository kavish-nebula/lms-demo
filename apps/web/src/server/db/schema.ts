import { integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { LearnerPlan, PlanChangeT, PlanSource, PlanStatus, PlanVersion } from "@/lib/learner-plan";
import type { PrecheckResult, SetupAnswers, SupportOverride } from "@/lib/setup";
import type { ProjectReport } from "@/lib/project-grade";

/**
 * Learner data. Profile answers drive the course plan; plans are append-only
 * versions (the adaptation log); signals are the answers that make the
 * planner revise a plan. Ids stay text where the content layer already names things
 * (course "n8n", module "m1", lesson "2.1").
 */

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

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

/** The mini project's report: the score from the hidden tickets, kept with the work it graded. */
export type ProjectReportRow = ProjectReport & { at: string };

/** A learner's mini project: their files as they last left them, and the last test report. */
export const projectWork = pgTable("project_work", {
  enrollmentId: uuid("enrollment_id")
    .primaryKey()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  files: jsonb("files").$type<Record<string, string>>().notNull(),
  report: jsonb("report").$type<ProjectReportRow>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
