# Production launch checklist

## Implemented and verifiable in this repository

- [x] Node.js full-server deployment architecture documented for Next.js 16; Node 22 is pinned in CI and enforced by npm's strict package-engine check.
- [x] CI validates the Drizzle migration journal and runs `git diff --check` across each PR/push diff.
- [x] PostgreSQL migration command requires an explicit production opt-in and TLS URL.
- [x] Production migration command rejects localhost.
- [x] Production migration command requires TLS-enforcing `sslmode=require`, `verify-ca`, or `verify-full`; it rejects plaintext-fallback modes.
- [x] Production application database startup uses the same TLS and loopback validation before creating a connection pool.
- [x] Liveness and readiness endpoints expose redacted release metadata; Preview readiness checks PostgreSQL, current migrations, and authentication, while Production additionally requires email, Builder, and monitoring configuration. Responses do not return secret values.
- [x] Sentry server/client integration and development-only verification endpoint are implemented with learner-content scrubbing.
- [x] The Sentry runtime-injection package is kept external from the Next.js server bundle; the local production server starts without the prior hook-resolution warning.
- [x] CI workflow runs against a disposable PostgreSQL 17 service.
- [x] Builder, Better Auth, app creation, invitation create/resend, and publish/rollback limits share one atomic PostgreSQL-backed fixed-window limiter; managed deployment still requires migration `0004`.
- [x] Deterministic Builder fixtures are restricted to development/test; Builder limits apply in Preview and Production even if the fixture-mode variable is misconfigured.
- [x] Better Auth email/password identities and server-side app membership authorization exist.
- [x] Verification and password-reset requests fail clearly when required email delivery is unavailable; delivery logs omit recipient and token URL.
- [x] Existing app versions, preview/production runtime, publication, and rollback are PostgreSQL-backed.
- [x] Generated app execution remains declarative and constrained.
- [x] Six Missions' checkpoints and attempt/skill progress persist per authenticated learner, migrate a local save when no account record exists, and use revision checks for multi-device writes.
- [x] Studio coaching, reflection, observation, and version-learning records are per learner/app, revision-checked, private to their author, and synchronized with browser-save conflict choices.
- [x] Documented Neon Free's published backup limits: 6-hour maximum instant-restore history capped at 1 GB, one manual snapshot, and no scheduled backup schedules. The connected project's active history setting and branch quota remain unverified.
- [ ] Verify signed-in Missions and Studio resume across two browsers against a hosted Preview deployment; none exists yet.
- [ ] Invitation email is delivered and resend behavior is verified.
- [ ] Verify migration `0004_shared_operation_rate_limits` and Builder/auth throttles across multiple hosted instances. Preview DB migration and local integration coverage are recorded; hosted multi-instance and Production verification are not.
- [ ] External error monitoring is configured and a safe test event is verified.
- [ ] Run and record an isolated database restore drill using [the operations runbook](docs/OPERATIONS_RUNBOOK.md); verify provider retention/PITR settings and operator-approved recovery objectives.
- [ ] Verify the Neon Preview project's live history setting and complete the no-cost synthetic point-in-time branch check; no snapshot or in-place restore may be used for this drill.

## Requires operator or provider access

- [x] Create the Vercel Next.js project, set Node 22.x, and connect `fernando-ace/BuildLoop-Learning-Platform`; `master` is the Production branch and SSO protection is enabled for non-custom-domain deployments.
- [x] Provision the dedicated Neon Free `buildloop-staging` Preview database, configure Preview-only database variables, apply migrations, and run the Neon-backed test suite. No Production database was provisioned.
- [ ] Complete a protected hosted Preview deployment. The project currently has zero deployments; Vercel CLI refuses the first explicit Preview deployment with `first_deployment_production`. Do not use `--prod` or trigger a Git deployment as a workaround; see [deployment instructions](DEPLOYMENT.md) and [evidence](docs/GOAL14_EVIDENCE.md).
- [ ] Configure optional Preview-only email, Builder, and monitoring integrations if exercising those provider workflows; they are not Preview readiness gates. Verify each integration before claiming it works.
- [ ] Configure Production variables and database only as part of a separately authorized Production activation; this goal's current deployment gate does not permit a Production deployment.
- [ ] Configure GitHub branch protection to require `BuildLoop CI quality` before merging to `master` (after the workflow is available on the default branch) and configure Vercel production promotion rules.
- [ ] Choose production origin, add it to hosting, and configure DNS/TLS after domain ownership is confirmed.
- [ ] Enable managed database automated backups (7-day retention minimum) and PITR if available; follow [the operations runbook](docs/OPERATIONS_RUNBOOK.md).
- [ ] Verify the sender domain and invitation, verification, and password-reset email delivery with the chosen provider.
- [ ] Create/configure a Sentry project, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, configure Vercel log retention/alerts, and verify a safe test event.
- [ ] Run preview and production smoke tests with real accounts, persistence, invitations, app publishing, and rollback; record deployment SHA and URL.

Vercel hosting and Neon Preview infrastructure are configured, but there is no hosted deployment, Production database/domain, verified email delivery, verified monitoring event, backup activation, or restore drill. Do not mark the service production operational until the deployment and required operational checks have succeeded.
