CREATE TABLE "project_work" (
	"enrollment_id" uuid PRIMARY KEY NOT NULL,
	"files" jsonb NOT NULL,
	"report" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_work" ADD CONSTRAINT "project_work_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;