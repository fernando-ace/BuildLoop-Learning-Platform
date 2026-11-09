CREATE TABLE "studio_learner_progress" (
	"user_id" text NOT NULL,
	"app_id" text NOT NULL,
	"stage" text DEFAULT 'idea' NOT NULL,
	"project_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feedback" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_learner_progress_user_id_app_id_pk" PRIMARY KEY("user_id","app_id"),
	CONSTRAINT "studio_learner_progress_stage_valid" CHECK ("studio_learner_progress"."stage" in ('idea', 'scope', 'brief', 'try', 'feedback', 'goal', 'retest', 'summary')),
	CONSTRAINT "studio_learner_progress_revision_positive" CHECK ("studio_learner_progress"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "studio_learner_progress" ADD CONSTRAINT "studio_learner_progress_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_learner_progress" ADD CONSTRAINT "studio_learner_progress_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_learner_progress_app_idx" ON "studio_learner_progress" USING btree ("app_id");