# Multi-user platform

BuildLoop's platform layer uses PostgreSQL for app identity, memberships, versions, invitations, environment pointers, runtime records, migration outcomes, publication history, and audit events. Better Auth owns email/password accounts and sessions. App access is resolved from the signed-in account's membership on every server request; browser-provided roles are never authority.

## Local setup

1. Create a PostgreSQL database and copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL`, a unique `BETTER_AUTH_SECRET` with at least 32 characters, `BETTER_AUTH_URL`, and `PUBLIC_APP_URL`.
3. Run `npm ci`, then `npm run db:migrate`, then `npm run dev`.
4. Visit `/sign-in` to create an account or sign in. Studio creates an app record for the account before starting a build.

`npm run db:generate` creates a SQL migration from `src/lib/platform/schema.ts`; review and commit that migration with the schema change. `npm run db:migrate` applies committed migrations. Remote migrations require `BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1`; production also requires `BUILDLOOP_ENVIRONMENT=production` and `BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1`, plus a TLS connection URL. Do not use schema push against shared environments.

To import previously published V4 shared apps from a Goal 12 SQLite file, first create the target owner's BuildLoop account and apply the PostgreSQL migrations. Then run a read-only dry run:

```sh
npm run db:import-sqlite -- --source .buildloop-data/shared.sqlite --owner-email owner@example.com
```

Review the app IDs and version counts. Add `--apply` to import all validated apps in one PostgreSQL transaction. The source SQLite file is opened read-only. Imports preserve V4 versions, the selected production version, its current records, preview records, and audit event details; legacy actor IDs are retained as audit metadata and attributed to the selected account. Stable IDs make an exact repeat safe. The tool stops before writing if a saved version, record, or audit entry is malformed. Browser-local Mission progress and Studio coaching notes use the signed-in learner sync described below; they are not part of this SQLite import. The tool does not convert non-V4 shared app schemas.

## Learner progress and privacy

Mission state is stored in `learner_progress`, keyed only by the authenticated user ID. Its six mission checkpoints and progress records include completion, attempt history, latest/best skills, and resume stage. Studio reflection is stored separately in `studio_learner_progress`, keyed by authenticated user and app. The record has explicit fields for stage, project notes, feature choices, observations, feedback, and per-version learning notes. App members can each keep private notes; the server never trusts a user ID from the request body.

Both APIs use compare-and-swap revisions. A stale browser cannot replace a newer account record silently. When an older browser save is first uploaded, the browser copy stays in local storage; a collision asks the learner which copy to keep and keeps a backup of the other copy locally. Studio app identity, version summaries, and artifacts are read through app-membership-checked PostgreSQL queries; version artifacts load on demand. The SQLite app importer does not migrate learner records.

When a browser changes from one linked account to another, the Studio browser cache is saved under the previous learner's local account key and the new learner's account cache is restored before cloud state is merged. This prevents an unrelated learner's device-local Studio projects from appearing in the new account's library. Legacy browser saves without an account link remain subject to the explicit import/conflict flow where a matching server record exists.

## Tenant model

Each app has a platform owner, optional administrators, and members. Platform roles control project, membership, and publication operations. The separate `app_role` controls permissions defined by the selected V4 app artifact. Changing one role does not grant the other set of permissions. Every data query includes an app ID and environment, and composite foreign keys keep runtime rows attached to that tenant's preview or production environment.

An invitation includes an optional email restriction, app role, expiry, and a one-time random token. PostgreSQL stores only the token's SHA-256 hash. Invitees must sign in with a verified email before acceptance in production. Owners and administrators can revoke or resend pending email invitations and manage app-role assignments; only the owner can transfer ownership. When Resend is configured, email is sent from the configured verified sender; delivery failures preserve a copyable link. Resending rotates the token and invalidates its previous link.

## Environments and publishing

Saving a V4 build creates an immutable version and updates the preview pointer and preview sample records in one database transaction. Production starts unpublished. Publishing requires an explicit saved `versionId` and expected current production version. The repository rechecks membership, role assignments, artifact validity, current version, and data migration safety under a transaction before changing production records and pointers. A stale publication request conflicts. Unsafe data changes fail without advancing production. Warnings require explicit confirmation. Rollback selects an earlier immutable version and runs the same migration checks against current production records.

Publication and migration outcomes are kept in dedicated tables. Membership, invitation, runtime, and publication operations also append audit events in their database transaction. Runtime mutations validate permissions, ownership, field restrictions, workflow rules, and data constraints before saving records and the audit event together.

## Tests and security boundaries

The regular unit suite runs without PostgreSQL and skips its database integration cases. With `DATABASE_URL` pointing to a disposable database after `npm run db:migrate`, the platform integration suite checks tenant isolation, database constraints, invitation retries and expiry, ownership transfer, safe/unsafe migrations, concurrent publishing, and conflicting unique writes. The Playwright server uses a signed test identity only when it runs in development with `BUILDLOOP_AUTH_MODE=test`; the test-session route is unavailable in production. The deterministic Builder is a test provider and is not evidence of live OpenAI availability.

Production must use HTTPS, a strong unique Better Auth secret, trusted configured origins, and managed PostgreSQL with backups and monitoring. Production and Preview require email verification and support password reset; configure `RESEND_API_KEY` and a verified `EMAIL_FROM` before enabling signups. This repository work did not deploy or verify a hosted production environment. Local test identities and signing secrets must never be configured in production.

## Current boundaries

- Mission progress and the Studio learner workflow (briefs, observations, feedback, and reflection) remain browser-local; only application records and platform metadata are shared across devices.
- Invitation and account email delivery use the Resend API boundary; delivery is inactive until provider credentials and a verified sender are configured.
- App schema migration supports the validated V4 runtime path. Legacy V4 SQLite shared apps have an explicit import command; local Studio projects and learner notes are not automatically imported into PostgreSQL.
- There is no production deployment, hosted database, custom domain, realtime channel, team dashboard, or automated backup configuration in this checkout.
