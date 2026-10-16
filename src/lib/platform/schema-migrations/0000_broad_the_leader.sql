CREATE TABLE "app_environments" (
	"app_id" text NOT NULL,
	"environment" text NOT NULL,
	"published_version_id" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_environments_app_id_environment_pk" PRIMARY KEY("app_id","environment"),
	CONSTRAINT "app_environments_environment_valid" CHECK ("app_environments"."environment" in ('preview', 'production'))
);
--> statement-breakpoint
CREATE TABLE "app_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"email" text,
	"app_role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_invitations_status_valid" CHECK ("app_invitations"."status" in ('pending', 'accepted', 'expired', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "application_memberships" (
	"app_id" text NOT NULL,
	"user_id" text NOT NULL,
	"platform_role" text DEFAULT 'member' NOT NULL,
	"app_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_memberships_app_id_user_id_pk" PRIMARY KEY("app_id","user_id"),
	CONSTRAINT "application_memberships_platform_role_valid" CHECK ("application_memberships"."platform_role" in ('owner', 'administrator', 'member')),
	CONSTRAINT "application_memberships_app_role_length" CHECK ("application_memberships"."app_role" is null or length("application_memberships"."app_role") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "application_versions" (
	"app_id" text NOT NULL,
	"version_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"artifact" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_versions_app_id_version_id_pk" PRIMARY KEY("app_id","version_id"),
	CONSTRAINT "application_versions_number_positive" CHECK ("application_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_history" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"version_id" text NOT NULL,
	"environment" text NOT NULL,
	"action" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "publication_history_environment_valid" CHECK ("publication_history"."environment" in ('preview', 'production'))
);
--> statement-breakpoint
CREATE TABLE "runtime_records" (
	"app_id" text NOT NULL,
	"environment" text NOT NULL,
	"collection_id" text NOT NULL,
	"record_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_records_app_id_environment_collection_id_record_id_pk" PRIMARY KEY("app_id","environment","collection_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"app_id" text NOT NULL,
	"environment" text NOT NULL,
	"version_id" text NOT NULL,
	"migration_plan" jsonb NOT NULL,
	"status" text NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "schema_migrations_app_id_environment_version_id_pk" PRIMARY KEY("app_id","environment","version_id"),
	CONSTRAINT "schema_migrations_environment_valid" CHECK ("schema_migrations"."environment" in ('preview', 'production')),
	CONSTRAINT "schema_migrations_status_valid" CHECK ("schema_migrations"."status" in ('proposed', 'applied', 'failed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "studio_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_environments" ADD CONSTRAINT "app_environments_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_environments" ADD CONSTRAINT "app_environments_version_fk" FOREIGN KEY ("app_id","published_version_id") REFERENCES "public"."application_versions"("app_id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_invitations" ADD CONSTRAINT "app_invitations_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_invitations" ADD CONSTRAINT "app_invitations_invited_by_platform_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_invitations" ADD CONSTRAINT "app_invitations_accepted_by_platform_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_memberships" ADD CONSTRAINT "application_memberships_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_memberships" ADD CONSTRAINT "application_memberships_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_versions" ADD CONSTRAINT "application_versions_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_versions" ADD CONSTRAINT "application_versions_created_by_platform_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_project_id_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_platform_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_history" ADD CONSTRAINT "publication_history_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_history" ADD CONSTRAINT "publication_history_created_by_platform_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_history" ADD CONSTRAINT "publication_history_version_fk" FOREIGN KEY ("app_id","version_id") REFERENCES "public"."application_versions"("app_id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_records" ADD CONSTRAINT "runtime_records_environment_fk" FOREIGN KEY ("app_id","environment") REFERENCES "public"."app_environments"("app_id","environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_migrations" ADD CONSTRAINT "schema_migrations_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_migrations" ADD CONSTRAINT "schema_migrations_environment_fk" FOREIGN KEY ("app_id","environment") REFERENCES "public"."app_environments"("app_id","environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_migrations" ADD CONSTRAINT "schema_migrations_version_fk" FOREIGN KEY ("app_id","version_id") REFERENCES "public"."application_versions"("app_id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_owner_user_id_platform_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_environments_version_idx" ON "app_environments" USING btree ("app_id","published_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_invitations_token_hash_uq" ON "app_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "app_invitations_app_status_idx" ON "app_invitations" USING btree ("app_id","status");--> statement-breakpoint
CREATE INDEX "application_memberships_user_idx" ON "application_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_versions_number_uq" ON "application_versions" USING btree ("app_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_slug_uq" ON "applications" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_project_uq" ON "applications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_events_app_created_idx" ON "audit_events" USING btree ("app_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_uq" ON "auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_email_uq" ON "platform_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "publication_history_app_idx" ON "publication_history" USING btree ("app_id","created_at");--> statement-breakpoint
CREATE INDEX "runtime_records_tenant_idx" ON "runtime_records" USING btree ("app_id","environment");--> statement-breakpoint
CREATE INDEX "studio_projects_owner_idx" ON "studio_projects" USING btree ("owner_user_id");