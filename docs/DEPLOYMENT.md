# Deployment guide

## Goal 14 staging target

Goal 14 staging is a noncommercial Vercel Preview deployment of the existing `buildloop-learning-platform` project using a dedicated Neon Free database. It must remain behind Vercel Authentication. Do not connect a custom domain, use a production deployment, or enable paid add-ons. Confirm the project remains on a $0 plan before provisioning any provider resource.

Vercel project ID: `prj_0WDtrIFOTYSHxeYHqfC4RPEIQCPl`

Vercel team ID: `team_FxCiuzlr4hc0v3bitW4dWkVg`

Goal 14 branch: `goal-14-production-readiness`

## Database setup

Create a new `buildloop-staging` Neon Free project in US East (N. Virginia), isolated from every other application. The Vercel integration provides pooled `DATABASE_URL` and direct `DATABASE_URL_UNPOOLED`/`POSTGRES_URL_NON_POOLING` variables. Select only the permanently free plan; stop if the flow requests payment, a paid tier, or a paid trial. Drizzle migrations prefer explicit `DATABASE_MIGRATION_URL`, then the provider's direct/unpooled variable, then pooled `DATABASE_URL`. Never add connection values to Git, logs, shell history, or evidence.

Runtime PostgreSQL uses `pg` with a small bounded pool, short connection/statement timeouts, and TLS enforced in Production. Keep Preview and Production databases separate. For a remote staging migration, set `BUILDLOOP_ENVIRONMENT=preview`, `VERCEL_ENV=preview`, and `BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1`, then run `npm run db:migrate`; it selects the direct Neon URL automatically. Confirm the target host and journal after applying migrations. The migration command refuses remote targets without explicit opt-in and refuses production without a second explicit opt-in.

## Preview environment

Configure only the Vercel Preview environment:

- `DATABASE_URL`: Neon pooled URL with TLS.
- `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING`: Neon direct URL with TLS, selected automatically for controlled migration runs. `DATABASE_MIGRATION_URL` can override it when needed.
- `BETTER_AUTH_SECRET`: unique random secret of at least 32 characters.
- `VERCEL_ENV=preview` is supplied by Vercel; do not override it inconsistently.
- `BUILDLOOP_PREVIEW_ALLOW_UNVERIFIED_SIGNUPS=1` only when Vercel Authentication is enabled for every deployment URL. It allows password signup without email verification inside SSO-protected staging. It does not fake invitation or password-reset delivery.
- `PUBLIC_APP_URL` and `BETTER_AUTH_URL` may be omitted on Vercel Preview; the app uses that deployment's built-in `VERCEL_URL` origin. Set both explicitly only when they match the exact preview origin.
- `RESEND_API_KEY` and `EMAIL_FROM` are optional for Preview. Without them, email actions return a visible failure.
- `OPENAI_API_KEY` is optional for Preview. Without it, live Builder generation is unavailable; no fixture or deterministic provider is enabled in the hosted app.
- `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are optional for Preview. Use Vercel runtime logs for short-term diagnosis and do not treat them as durable monitoring.

Deploy only the feature branch as a Preview. Verify the actual commit SHA, generated `vercel.app` URL, Vercel Authentication protection, and `/api/health/live` and `/api/health/ready` responses. The ready response must show current migrations and authentication as configured; optional provider checks may report unavailable. Never use `vercel --prod`, promote the preview, or merge this branch into the default branch as part of staging.

## Production

Production activation is outside the authorized Goal 14 staging scope. Before a later production release, provision a separate managed database, configure verified email delivery, live Builder credentials, both Sentry DSNs, backups/restore, production origins, and required hosting protection. Require all production readiness checks and the full launch checklist in `GOAL14_EVIDENCE.md`; apply production migrations only through the explicit protected release step.

## Rollback and recovery

For application-only faults, use Vercel's rollback to the previous compatible Preview deployment. Do not change or reset database contents to roll back code. For staging data recovery, use the Neon Free snapshot/restore features available to the project and first restore to an isolated branch/project if supported by the current free plan. Verify current plan limits in the Neon console before the operation; do not upgrade or add paid backup services. The free-tier recovery window and snapshot limits are provider-controlled and must be recorded from the provisioned project's current plan before claiming a recovery guarantee. See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) for the controlled restore procedure.
