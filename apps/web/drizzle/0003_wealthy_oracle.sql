CREATE TABLE "workflow_projects" (
	"enrollment_id" uuid PRIMARY KEY NOT NULL,
	"diagram" jsonb NOT NULL,
	"report" jsonb,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_projects" ADD CONSTRAINT "workflow_projects_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;