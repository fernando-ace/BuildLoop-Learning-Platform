CREATE TABLE "learner_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active_mission" integer DEFAULT 1 NOT NULL,
	"mission_1_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_1_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_2_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_2_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_2_attempt_count" integer DEFAULT 0 NOT NULL,
	"mission_3_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_3_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_4_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_4_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_5_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_5_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_6_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mission_6_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_progress_active_mission_valid" CHECK ("learner_progress"."active_mission" between 0 and 6),
	CONSTRAINT "learner_progress_revision_positive" CHECK ("learner_progress"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "learner_progress" ADD CONSTRAINT "learner_progress_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;