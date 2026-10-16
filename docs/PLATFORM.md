# Multi-user platform

BuildLoop's platform layer uses PostgreSQL for app identity, memberships, versions, invitations, environment pointers, runtime records, migration outcomes, publication history, and audit events. Better Auth owns email/password accounts and sessions. App access is resolved from the signed-in account's membership on every server request; browser-provided roles are never authority.

## Local setup

1. Create a PostgreSQL database and copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL`, a unique `BETTER_AUTH_SECRET` with at least 32 characters, `BETTER_AUTH_URL`, and `PUBLIC_APP_URL`.
3. Run `npm ci`, then `npm run db:migrate`, then `npm run dev`.
4. Visit `/sign-in` to create an account or sign in. Studio creates an app record for the account before starting a build.

`npm run db:generate` creates a SQL migration from `src/lib/platform/schema.ts`; review and commit that migration with the schema change. `npm run db:migrate` applies committed migrations. Do not use schema push against shared environments.

## Tenant model

Each app has a platform owner, optional administrators, and members. Platform roles control project, membership, and publication operations. The separate `app_role` controls permissions defined by the selected V4 app artifact. Changing one role does not grant the other set of permissions. Every data query includes an app ID and environment, and composite foreign keys keep runtime rows attached to that tenant's preview or production environment.

An invitation includes an optional email restriction, app role, expiry, and a one-time random token. PostgreSQL stores only the token's SHA-256 hash. Invitees must sign in before acceptance. Owners and administrators can revoke pending invitations and manage app-role assignments; only the owner can transfer ownership. The app currently displays a copyable URL and does not send email.

## Environments and publishing

Saving a V4 build creates an immutable version and updates the preview pointer and preview sample records in one database transaction. Production starts unpublished. Publishing requires an explicit saved `versionId` and expected current production version. The repository rechecks membership, role assignments, artifact validity, current version, and data migration safety under a transaction before changing production records and pointers. A stale publication request conflicts. Unsafe data changes fail without advancing production. Warnings require explicit confirmation. Rollback selects an earlier immutable version and runs the same migration checks against current production records.

Publication and migration outcomes are kept in dedicated tables. Membership, invitation, runtime, and publication operations also append audit events in their database transaction. Runtime mutations validate permissions, ownership, field restrictions, workflow rules, and data constraints before saving records and the audit event together.

## Tests and security boundaries

The regular unit suite runs without PostgreSQL and skips its database integration cases. With `DATABASE_URL` pointing to a disposable database after `npm run db:migrate`, the platform integration suite checks tenant isolation, database constraints, invitation retries and expiry, ownership transfer, safe/unsafe migrations, concurrent publishing, and conflicting unique writes. The Playwright server uses a signed test identity only when it runs in development with `BUILDLOOP_AUTH_MODE=test`; the test-session route is unavailable in production. The deterministic Builder is a test provider and is not evidence of live OpenAI availability.

Production must use HTTPS, a strong unique Better Auth secret, trusted configured origins, and managed PostgreSQL with backups and monitoring. Configure email verification policies and operational alerts before inviting external users. This repository work did not deploy or verify a hosted production environment. Local test identities and signing secrets must never be configured in production.

## Current boundaries

- Mission progress and the Studio learner workflow (briefs, observations, feedback, and reflection) remain browser-local; only application records and platform metadata are shared across devices.
- Invitations are copied and shared manually; email delivery is not configured.
- App schema migration supports the validated V4 runtime path. Legacy SQLite shared-app data and local Studio projects are not automatically imported into PostgreSQL.
- There is no production deployment, hosted database, custom domain, realtime channel, team dashboard, or automated backup configuration in this checkout.
