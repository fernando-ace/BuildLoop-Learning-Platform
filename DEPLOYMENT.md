# Deployment

## Runtime architecture

BuildLoop is a Next.js 16 App Router application running on Node.js 22 (`package.json` requires Node `>=22 <23`, and `.npmrc` enables npm's strict engine check). It is not a static site: authentication, application APIs, and generated-app data use server route handlers and PostgreSQL. Vercel is the intended host. PostgreSQL is a separately managed service; use a dedicated production database and a separate preview/test database. Do not reuse another product's database.

Production application data is in PostgreSQL. The legacy SQLite store under `.buildloop-data` is import-only and must not be mounted as production state. Generated apps execute as validated declarative artifacts in BuildLoop's fixed interpreter; they do not execute arbitrary code on the host.

## Environments and required variables

Configure variables independently for local development, Vercel Preview, and Vercel Production. Never copy production credentials into Preview.

| Variable | Use | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL URL; use the provider's TLS connection string and pooled endpoint for application traffic | All hosted environments |
| `DATABASE_POOL_MAX` | Per-instance pool ceiling; start at 3–5 and account for the maximum function instances and provider connection cap | Hosted |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters, unique per environment | Hosted |
| `BETTER_AUTH_URL` | Canonical origin used by Better Auth | Hosted |
| `PUBLIC_APP_URL` | Canonical HTTPS origin for trusted links and application URLs | Hosted |
| `BUILDLOOP_ENVIRONMENT` | `development`, `test`, `preview`, or `production`; must match `VERCEL_ENV` when both are set | Local; hosted recommended |
| `BUILDLOOP_RELEASE` | Optional release label; commit SHA falls back to Vercel/Git metadata | Optional |
| `NEXT_PUBLIC_BUILDLOOP_ENVIRONMENT` | Public environment label attached to client error events | Optional |
| `NEXT_PUBLIC_BUILDLOOP_RELEASE` | Public release label attached to client error events | Optional |
| `OPENAI_API_KEY` | Server-only key for live Builder generation | Required for live Builder; Production readiness |
| `BUILDLOOP_OPENAI_MODEL` | Server-only model selector | Optional |
| `BUILDLOOP_BUILDER_MODE` | Deterministic fixture generation; accepted only in development and test, never Preview or Production | Development/test only |
| `BUILDLOOP_BUILDER_DAILY_LIMIT` | Shared per-account daily hosted generation ceiling; valid range 1–100, defaults to 10 | Optional hosted; review against approved spend controls |
| `RESEND_API_KEY` | Server-only invitation, verification, and password-reset mail key | Required for email delivery and Production readiness; optional in Preview |
| `EMAIL_FROM` | Verified sender address for invitation, verification, and password-reset email | Required for email delivery and Production readiness; optional in Preview |
| `BUILDLOOP_EMAIL_TRANSPORT` | Local-only transport override; development captures in memory by default, tests always capture, Production always uses Resend | Optional local development only; use `resend` only for an explicitly authorized controlled-inbox provider check |
| `SENTRY_DSN` | Server/edge event destination | Required for Production readiness; optional in Preview; delivery must be verified separately |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser event destination; public project DSN, never an auth token | Required for Production readiness; optional in Preview; delivery must be verified separately |
| `BUILDLOOP_ALLOW_REMOTE_MIGRATIONS` | Explicit one-command approval for a remote migration | Release command only; value `1` |
| `BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS` | Second explicit one-command gate for Production migration | Production migration command only; value `1` |
| `BUILDLOOP_AUTH_MODE` | Enables signed local browser-test identities | Development/test only; never hosted |
| `BUILDLOOP_TEST_AUTH_SECRET` | HMAC secret for local browser-test identities | Development/test only; unique and never hosted |
| `BUILDLOOP_TEST_DB_PERSISTENCE` | Enables database writes from the Builder route during route tests | Test runner only |
| `BUILDLOOP_MONITORING_TEST` | Enables the safe Sentry test endpoint | Development/test only; never hosted |

Never use `NEXT_PUBLIC_` for secrets. Vercel's built-in environment values provide deployment metadata; application code reports the environment and release through `/api/health`.

`/api/health/ready` requires reachable PostgreSQL, a current migration journal, and valid Better Auth configuration in Preview. Production readiness additionally requires account email, Builder, and both Sentry DSNs. The endpoint reports configuration presence and shape, not provider connectivity or successful delivery; verify email and monitoring with their safe end-to-end checks before launch. Development and test environments do not require hosted integrations.

`BUILDLOOP_SHARED_DB_PATH` belongs to a legacy SQLite repository module with no current production route callers; production app and learner records use PostgreSQL. Do not set it for hosted deployments. The local SQLite import command has its own explicit `--source` argument.

## Local setup

1. Create a disposable local PostgreSQL database and copy `.env.example` to `.env.local`.
2. Set the local database URL, Better Auth secret, and both application origins.
3. Run `npm ci`, `npm run db:migrate`, and `npm run dev`.
4. Sign up at `/sign-in`.

`npm run db:generate` generates a migration from `src/lib/platform/schema.ts`. Review generated SQL, check that it is additive or otherwise rollout-safe, and commit it alongside the schema change. Do not edit an already-applied migration.

## Preview and production release

The GitHub Actions workflow runs a clean install, checks the migration journal and PR diff, applies migrations to disposable PostgreSQL 17, and runs typecheck, lint, unit/integration/browser tests, a production build, and dependency audit. The workflow is on this feature branch; it has not yet run from the remote default branch, and branch protection has not been verified.

The existing Vercel project is `buildloop-learning-platform` (`prj_0WDtrIFOTYSHxeYHqfC4RPEIQCPl`) in the Hobby team. Its Git integration is connected to `fernando-ace/BuildLoop-Learning-Platform`, with `master` as the Production branch. SSO protection is enabled for non-custom-domain deployments, there are no domains, and the ignored-build command allows builds only when `VERCEL_ENV=preview`. The existing Neon Free `buildloop-staging` database is configured for Preview and has been migrated; no Production database or Production variables are configured.

**Current deployment gate:** this Vercel project has zero deployments. Vercel CLI 65.16.0 rejected both `vercel deploy --environment preview --no-wait --yes` and `vercel deploy --target=preview` with `first_deployment_production`. Current [Vercel CLI deployment guidance](https://vercel.com/docs/projects/deploy-from-cli) and [environment documentation](https://vercel.com/docs/deployments/environments) confirm that the first deployment is always Production, including when `--target=preview` is supplied. Deleted deployments do not count, and this project has none. A prior feature-branch Git deployment was classified as Production and assigned an alias before its ignored-build step canceled it; that deployment was deleted. Do not run the suggested `--prod` command, promote a deployment, add a domain, or push a branch to trigger a deployment as a workaround. The Preview CLI command becomes a supported Preview path only after a first deployment record exists, which cannot be created under this goal's no-Production constraint. See [Goal 14 evidence](docs/GOAL14_EVIDENCE.md).

Before proceeding past build, inspect deployment metadata and confirm the target is Preview. Keep SSO protection enabled. After a Preview deployment succeeds, verify `/api/health/live`, `/api/health/ready`, authentication, database persistence, generated-app preview, and controlled publish/rollback. Record its URL, commit SHA, migration set, smoke-test results, and operator. Do not claim a hosted test passed without executing it against the protected deployment.

For any separately authorized future Production release, review committed SQL and run migrations only against the intended Production database with both explicit gates:

   ```sh
   BUILDLOOP_ENVIRONMENT=production BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1 BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate
   ```

The Production URL must not point to localhost and must include `sslmode=require` or stronger. All remote databases require an explicit migration opt-in. The command applies committed forward migrations only; it never resets or seeds application data. This migration procedure does not authorize a Production deployment. Configure `DATABASE_POOL_MAX` against the provider's connection budget; the default ceiling is five connections per warm instance, so total demand scales with instance count.

## Migration and rollback rules

Migrations are an explicit release step, not a build hook and not an application startup side effect. If a migration fails, stop promotion, inspect the database migration journal and provider logs, and repair forward with a new reviewed migration. Do not manually delete migration history or attempt an automatic down migration.

Use expand/migrate/contract for schema changes that overlap deployments: first add nullable columns/tables, deploy code compatible with both shapes, backfill in a bounded and resumable job, then remove old columns only in a later release after the old application is no longer deployed. Keep each application release compatible with the prior schema until promotion is confirmed. If the database has advanced and the application deployment fails, redeploy the previous application only when that version is compatible with the new schema; otherwise repair forward. Never restore a production database solely to roll back application code.

Vercel deployment rollback restores application code/traffic. BuildLoop's in-product app-version rollback is a separate operation over a learner's published artifact and data. Neither should be used as a substitute for the other.

See [the operations runbook](docs/OPERATIONS_RUNBOOK.md) for backup configuration expectations, the completed synthetic Free PITR branch check, the still-required isolated provider-backup restore drill, and incident recovery steps. Backup activation and a successful provider restore remain launch gates.
