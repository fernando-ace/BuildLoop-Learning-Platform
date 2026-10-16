import { boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const platformUsers = pgTable("platform_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("platform_users_email_uq").on(table.email)]);

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
}, (table) => [uniqueIndex("auth_sessions_token_uq").on(table.token), index("auth_sessions_user_idx").on(table.userId)]);

export const authAccounts = pgTable("auth_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("auth_accounts_user_idx").on(table.userId)]);

export const authVerifications = pgTable("auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("auth_verifications_identifier_idx").on(table.identifier)]);

export const studioProjects = pgTable("studio_projects", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => platformUsers.id),
  name: text("name").notNull(),
  brief: jsonb("brief").notNull().default({}),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("studio_projects_owner_idx").on(table.ownerUserId)]);

export const applications = pgTable("applications", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => studioProjects.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("applications_slug_uq").on(table.slug), uniqueIndex("applications_project_uq").on(table.projectId)]);

export const applicationVersions = pgTable("application_versions", {
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  versionId: text("version_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  artifact: jsonb("artifact").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: text("created_by").notNull().references(() => platformUsers.id),
  createdAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.appId, table.versionId] }), uniqueIndex("application_versions_number_uq").on(table.appId, table.versionNumber), check("application_versions_number_positive", sql`${table.versionNumber} > 0`)]);

export const applicationMemberships = pgTable("application_memberships", {
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => platformUsers.id, { onDelete: "cascade" }),
  platformRole: text("platform_role").notNull().default("member"),
  appRole: text("app_role"),
  joinedAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.appId, table.userId] }), index("application_memberships_user_idx").on(table.userId), check("application_memberships_platform_role_valid", sql`${table.platformRole} in ('owner', 'administrator', 'member')`), check("application_memberships_app_role_length", sql`${table.appRole} is null or length(${table.appRole}) between 1 and 80`)]);

export const appInvitations = pgTable("app_invitations", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  invitedBy: text("invited_by").notNull().references(() => platformUsers.id),
  email: text("email"),
  appRole: text("app_role").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedBy: text("accepted_by").references(() => platformUsers.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("app_invitations_token_hash_uq").on(table.tokenHash), index("app_invitations_app_status_idx").on(table.appId, table.status), check("app_invitations_status_valid", sql`${table.status} in ('pending', 'accepted', 'expired', 'revoked')`)]);

export const appEnvironments = pgTable("app_environments", {
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  environment: text("environment").notNull(),
  publishedVersionId: text("published_version_id"),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.appId, table.environment] }), index("app_environments_version_idx").on(table.appId, table.publishedVersionId), foreignKey({ columns: [table.appId, table.publishedVersionId], foreignColumns: [applicationVersions.appId, applicationVersions.versionId], name: "app_environments_version_fk" }).onDelete("restrict"), check("app_environments_environment_valid", sql`${table.environment} in ('preview', 'production')`)]);

export const runtimeRecords = pgTable("runtime_records", {
  appId: text("app_id").notNull(),
  environment: text("environment").notNull(),
  collectionId: text("collection_id").notNull(),
  recordId: text("record_id").notNull(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.appId, table.environment, table.collectionId, table.recordId] }), index("runtime_records_tenant_idx").on(table.appId, table.environment), foreignKey({ columns: [table.appId, table.environment], foreignColumns: [appEnvironments.appId, appEnvironments.environment], name: "runtime_records_environment_fk" }).onDelete("cascade")]);

export const publicationHistory = pgTable("publication_history", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  versionId: text("version_id").notNull(),
  environment: text("environment").notNull(),
  action: text("action").notNull(),
  createdBy: text("created_by").notNull().references(() => platformUsers.id),
  createdAt: createdAt(),
  metadata: jsonb("metadata").notNull().default({}),
}, (table) => [index("publication_history_app_idx").on(table.appId, table.createdAt), foreignKey({ columns: [table.appId, table.versionId], foreignColumns: [applicationVersions.appId, applicationVersions.versionId], name: "publication_history_version_fk" }).onDelete("restrict"), check("publication_history_environment_valid", sql`${table.environment} in ('preview', 'production')`)]);

export const schemaMigrations = pgTable("schema_migrations", {
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  environment: text("environment").notNull(),
  versionId: text("version_id").notNull(),
  migrationPlan: jsonb("migration_plan").notNull(),
  status: text("status").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
}, (table) => [primaryKey({ columns: [table.appId, table.environment, table.versionId] }), foreignKey({ columns: [table.appId, table.environment], foreignColumns: [appEnvironments.appId, appEnvironments.environment], name: "schema_migrations_environment_fk" }).onDelete("cascade"), foreignKey({ columns: [table.appId, table.versionId], foreignColumns: [applicationVersions.appId, applicationVersions.versionId], name: "schema_migrations_version_fk" }).onDelete("restrict"), check("schema_migrations_environment_valid", sql`${table.environment} in ('preview', 'production')`), check("schema_migrations_status_valid", sql`${table.status} in ('proposed', 'applied', 'failed', 'rejected')`)]);

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => platformUsers.id),
  eventType: text("event_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: createdAt(),
}, (table) => [index("audit_events_app_created_idx").on(table.appId, table.createdAt)]);
