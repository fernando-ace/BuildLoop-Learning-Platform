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
| `OPENAI_API_KEY` | Server-only key for live Builder generation | Required for hosted Builder and readiness |
| `BUILDLOOP_OPENAI_MODEL` | Server-only model selector | Optional |
| `BUILDLOOP_BUILDER_MODE` | Deterministic fixture generation; accepted only in development and test, never Preview or Production | Development/test only |
| `RESEND_API_KEY` | Server-only invitation, verification, and password-reset mail key | Required for hosted readiness and account email |
| `EMAIL_FROM` | Verified sender address for invitation, verification, and password-reset email | Required for hosted readiness and account email |
| `SENTRY_DSN` | Server/edge event destination | Required for hosted readiness; delivery must be verified separately |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser event destination; public project DSN, never an auth token | Required for hosted readiness; delivery must be verified separately |
| `BUILDLOOP_ALLOW_REMOTE_MIGRATIONS` | Explicit one-command approval for a remote migration | Release command only; value `1` |
| `BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS` | Second explicit one-command gate for Production migration | Production migration command only; value `1` |
| `BUILDLOOP_AUTH_MODE` | Enables signed local browser-test identities | Development/test only; never hosted |
| `BUILDLOOP_TEST_AUTH_SECRET` | HMAC secret for local browser-test identities | Development/test only; unique and never hosted |
| `BUILDLOOP_TEST_DB_PERSISTENCE` | Enables database writes from the Builder route during route tests | Test runner only |
| `BUILDLOOP_MONITORING_TEST` | Enables the safe Sentry test endpoint | Development/test only; never hosted |

Never use `NEXT_PUBLIC_` for secrets. Vercel's built-in environment values provide deployment metadata; application code reports the environment and release through `/api/health`.

`/api/health/ready` returns 503 in Preview/Production unless PostgreSQL, the migration journal, Better Auth configuration, account email, Builder, and both Sentry DSNs are available. Its hosted integration checks validate configuration presence and origin shape, not provider connectivity or successful delivery; verify email and monitoring with their safe end-to-end checks before launch. Development and test environments do not require those hosted integrations.

`BUILDLOOP_SHARED_DB_PATH` belongs to a legacy SQLite repository module with no current production route callers; production app and learner records use PostgreSQL. Do not set it for hosted deployments. The local SQLite import command has its own explicit `--source` argument.

## Local setup

1. Create a disposable local PostgreSQL database and copy `.env.example` to `.env.local`.
2. Set the local database URL, Better Auth secret, and both application origins.
3. Run `npm ci`, `npm run db:migrate`, and `npm run dev`.
4. Sign up at `/sign-in`.

`npm run db:generate` generates a migration from `src/lib/platform/schema.ts`. Review generated SQL, check that it is additive or otherwise rollout-safe, and commit it alongside the schema change. Do not edit an already-applied migration.

## Preview and production release

1. Open a pull request. GitHub Actions runs a clean install, validates the Drizzle migration journal, applies migrations to disposable PostgreSQL 17, checks PR diff whitespace, then runs typecheck, lint, unit and PostgreSQL integration tests, Playwright browser tests, the production build, and dependency audit.
2. Configure Vercel's Git integration for this repository and separate Preview and Production variables. Preview needs its own persistent disposable database if the full platform is to be exercised.
3. Require the CI workflow before merging to `master`; configure this branch protection in GitHub. Vercel can create Preview builds for pull requests after the project is connected.
4. Before promotion, review committed SQL and run the migration command against the intended environment. Production requires an explicit opt-in:

   ```sh
   BUILDLOOP_ENVIRONMENT=production BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1 BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate
   ```

   The production URL must not point to localhost and must include `sslmode=require` or stronger. All remote databases require an explicit migration opt-in. The command applies committed forward migrations only; it never resets or seeds application data.
5. Promote the tested Vercel deployment. Verify `/api/health/live`, `/api/health/ready`, authentication, database persistence, generated app preview, and a controlled publish/rollback before inviting users.
6. Record the deployment URL, commit SHA, migration set, smoke-test results, and operator in the release record.

Vercel project `buildloop-learning-platform` (`prj_0WDtrIFOTYSHxeYHqfC4RPEIQCPl`) now exists in the connected team with Node 22.x selected. Git connection was intentionally skipped, and the project has no deployment or domain yet. Connect `fernando-ace/BuildLoop-Learning-Platform` after Preview/Production databases and runtime variables are ready. Configure `DATABASE_POOL_MAX` against the provider's connection budget; the default ceiling is five connections per warm instance, so total demand scales with instance count.

## Migration and rollback rules

Migrations are an explicit release step, not a build hook and not an application startup side effect. If a migration fails, stop promotion, inspect the database migration journal and provider logs, and repair forward with a new reviewed migration. Do not manually delete migration history or attempt an automatic down migration.

Use expand/migrate/contract for schema changes that overlap deployments: first add nullable columns/tables, deploy code compatible with both shapes, backfill in a bounded and resumable job, then remove old columns only in a later release after the old application is no longer deployed. Keep each application release compatible with the prior schema until promotion is confirmed. If the database has advanced and the application deployment fails, redeploy the previous application only when that version is compatible with the new schema; otherwise repair forward. Never restore a production database solely to roll back application code.

Vercel deployment rollback restores application code/traffic. BuildLoop's in-product app-version rollback is a separate operation over a learner's published artifact and data. Neither should be used as a substitute for the other.

See [the operations runbook](docs/OPERATIONS_RUNBOOK.md) for backup configuration expectations, an isolated restore drill, and incident recovery steps. Backup activation and a successful provider restore remain launch gates.
