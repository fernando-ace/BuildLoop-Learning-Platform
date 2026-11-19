# Deployment guide

## Goal 15 boundary

Goal 15 authorizes protected Preview deployments from the `goal-15-public-beta-readiness` branch. It does not authorize a Production deployment, promotion, custom-domain assignment, Production secret provisioning, or Production database migration. Keep deployment protection enabled and do not use a Production-classified deployment to work around a Preview issue.

## Current Vercel state

Verified 2026-11-17 for project `buildloop-learning-platform` (`prj_0WDtrIFOTYSHxeYHqfC4RPEIQCPl`):

- The project is not live and has no domains.
- Vercel SSO protection is enabled for all deployments other than custom domains (`all_except_custom_domains`).
- One protected, unaliased, nonfunctional Production-classified bootstrap from Goal 14 exists: `dpl_6UREPC3qrP1HM47WFP1fnmcAft6R`. It predates Goal 15, has no aliases or `productionUrl`, and Goal 14 recorded no Production environment variables. Goal 15 has not created or changed it. Do not assign it an alias/domain, promote it, or use it as a release.
- Pushes of the Goal 15 feature branch through Vercel Git integration have produced `READY` branch deployments with the expected commit SHA. The current application-code Preview was `8b2fddf`; later documentation-only commits also produced protected branch Previews.
- No Goal 15 deployment has a Production target. Goal 15 made no Production promotion or domain assignment.

During Goal 14, explicit CLI Preview attempts were blocked while the project had no deployment record because Vercel required the initial deployment to be Production-classified. That historical CLI behavior is not the current Preview workflow: the connected Git integration now builds the Goal 15 feature branch as Preview. Do not follow the old Goal 14 bootstrap procedure or use `vercel deploy --prod --skip-domain`.

### Protected Preview procedure

1. Confirm the worktree is on the intended feature branch and contains only reviewed changes.
2. Push that branch to the connected repository. Vercel Git integration should create a branch Preview; do not use `--prod`, promote, or assign a domain.
3. In Vercel, verify the deployment commit SHA, branch, `READY` state, Preview environment, and SSO protection. If the build is blocked or classified unexpectedly, stop and inspect project settings; do not weaken protection or create a Production deployment.
4. Use the exact generated deployment URL. Check `/api/health/live` and `/api/health/ready`; the latter must show database `ok`, migration journal `current`, and authentication `configured`. Email, Builder, and monitoring may remain unavailable in Preview; those statuses are not launch approval.
5. Use only synthetic `.example.test` identities and records. Do not send real email or make billable model requests. Verify cleanup in the Preview database after hosted tests.

## Environment configuration

Provision these values through Vercel's environment-specific secret store. Never commit them, print them, or put them in URLs or evidence reports.

| Variable | Preview | Production |
| --- | --- | --- |
| `DATABASE_URL` | TLS PostgreSQL runtime URL; pooling is supported | TLS URL for a separate Production database; use the provider's supported runtime pooler |
| `DATABASE_MIGRATION_URL` | Optional direct/unpooled Preview URL for migrations | Direct/unpooled Production URL used only by the controlled migration release process |
| `BUILDLOOP_ENVIRONMENT` | `preview` when set explicitly | `production`; it must match Vercel's `VERCEL_ENV` |
| `BETTER_AUTH_SECRET` | Unique random secret, at least 32 characters | Separate unique random secret, at least 32 characters |
| `PUBLIC_APP_URL`, `BETTER_AUTH_URL` | May use the exact generated Preview origin; omit if Vercel's `VERCEL_URL` fallback is appropriate | Same canonical HTTPS origin, with no path, query, or fragment |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional; without both, delivery is unavailable | Required for account verification, recovery, and invitations. Verify sender/domain and DNS first |
| `OPENAI_API_KEY` | Optional; without it, Builder returns an unavailable state | Required for live generation. Provision only after an approved zero-charge arrangement exists |
| `BUILDLOOP_BUILDER_DAILY_LIMIT` | Optional; default 10, accepted range 1–100 | Set an operator-approved per-account cap. This is a request quota, not a monetary spend cap |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional; absent means durable monitoring is unavailable | Both required for readiness; configure and verify event receipt and alert routing |
| `VERCEL_ENV`, `VERCEL_URL` | Supplied by Vercel | Supplied by Vercel; do not override inconsistently |

Never set `BUILDLOOP_PREVIEW_ALLOW_UNVERIFIED_SIGNUPS`, `BUILDLOOP_AUTH_MODE`, or `BUILDLOOP_TEST_AUTH_SECRET` in Production. Do not enable the deterministic Builder provider in Production. Production email uses the Resend transport; the local capture transport is for development and tests. Use server-only environment variables for credentials; never prefix secrets with `NEXT_PUBLIC_`.

Before enabling a custom domain, confirm control of the domain, DNS, current cost, and the resulting access policy. The current SSO setting excludes custom domains, so review Vercel protection and BuildLoop authentication before assigning one. Set `PUBLIC_APP_URL` and `BETTER_AUTH_URL` to the final HTTPS origin. Configure any future OAuth provider's callback URLs to that same origin; the current email/password design does not require an OAuth callback. Verification, recovery, and invitation links must resolve to the canonical origin.

## Controlled Production release procedure

This procedure documents a future release and does not authorize or execute one. Every external service and plan must remain within the approved $0/month ceiling. If any essential provider requires paid access, stop and keep that capability disabled.

1. **Clear the launch gates.** Complete the automated and hosted checks in [PUBLIC_BETA_LAUNCH_CHECKLIST.md](PUBLIC_BETA_LAUNCH_CHECKLIST.md). Resolve the high-severity dependency audit or obtain an explicit risk decision from the responsible security owner. Verify email delivery with controlled addresses, live Builder access and its true cost ceiling, durable monitoring/alerts, the Production database plan, backups, and an isolated restore drill. Confirm product, security, and release-owner approvals.
2. **Provision Production separately.** Create a dedicated Production database and least-privilege credentials. Configure automated backups, retention, restore access, and agreed RPO/RTO. Provision only the Production variables in the table above. Verify database, email sender, model access/cost controls, and monitoring in their provider consoles without disclosing secrets.
3. **Review migrations.** Generate and inspect committed SQL migrations, apply them to Preview, and verify the resulting schema and application behavior. Ensure the migration is compatible with both the current Production code and the release candidate. Do not use schema push.
4. **Apply Production migrations from the controlled release environment.** Load the direct Production migration URL from the secret manager without printing it. Set `BUILDLOOP_ENVIRONMENT=production`, `VERCEL_ENV=production`, `BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1`, and `BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1` only in the protected one-time migration process, then run `npm run db:migrate`. Confirm the target database identity and migration journal. Unset the flags and temporary URL immediately afterward. Never store these opt-in flags in the running Vercel application's environment.
5. **Deploy only after separate approval.** Merge the reviewed release commit to the Production branch configured in Vercel; verify that branch in the dashboard immediately before release. Vercel Git integration will create the Production deployment. Do not promote a Preview or use an ad hoc `--prod` bootstrap. Verify the resulting commit SHA, Production target, protection, and canonical origin.
6. **Run the Production smoke.** Require `/api/health/live` and `/api/health/ready` to return 200, with the database, migration journal, authentication, email, Builder, and monitoring checks all configured. Use designated synthetic accounts to verify signup, verification, sign-in, reset, logout, project persistence, Builder generation, publication, and rollback. Confirm a Sentry test event and alert delivery. Do not invite beta users until checks pass.
7. **Record and monitor.** Record commit/deployment IDs, migration result, test outcomes, and incident owner without user content or secrets. Watch structured logs, Sentry alerts, database health, and provider usage during the controlled rollout. Keep the previous compatible deployment and database rollback/recovery procedure available.

## Rollback and recovery

For an application-only failure, roll back Vercel to the last compatible Production deployment after checking schema compatibility. Do not restore or alter database contents to roll back code. For data loss, restore to a new isolated database, validate it, and plan a controlled cutover with the operator; do not overwrite Production during a drill. Follow [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for database diagnosis, secret rotation, backup/restore, and incident recovery.

## Cost and current launch status

The Vercel project was verified on Hobby and the existing Neon Preview project was previously recorded as Free. Current billing usage across providers has not been independently confirmed; the Vercel charges endpoint returned `costs_not_found`, and Neon billing data was unavailable. Recheck all plans and usage before a release. No Production environment, Production database, domain, paid feature, or Production deployment was created for Goal 15. Current readiness and unresolved gates are in [GOAL15_EVIDENCE.md](GOAL15_EVIDENCE.md) and [PUBLIC_BETA_LAUNCH_CHECKLIST.md](PUBLIC_BETA_LAUNCH_CHECKLIST.md).
