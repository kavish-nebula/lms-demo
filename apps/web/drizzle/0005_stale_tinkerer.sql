CREATE TABLE "adapted_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"piece" text NOT NULL,
	"status" text NOT NULL,
	"inputs" text NOT NULL,
	"content" jsonb,
	"audio" jsonb,
	"model" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adapted_content" ADD CONSTRAINT "adapted_content_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adapted_content_piece" ON "adapted_content" USING btree ("enrollment_id","module_id","piece");