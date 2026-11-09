# Production launch checklist

## Implemented and verifiable in this repository

- [x] Node.js full-server deployment architecture documented for Next.js 16.
- [x] PostgreSQL migration command requires an explicit production opt-in and TLS URL.
- [x] Production migration command rejects localhost.
- [x] Production migration command requires TLS-enforcing `sslmode=require`, `verify-ca`, or `verify-full`; it rejects plaintext-fallback modes.
- [x] Production application database startup uses the same TLS and loopback validation before creating a connection pool.
- [x] Liveness and PostgreSQL readiness endpoints expose redacted release metadata.
- [x] Sentry server/client integration and development-only verification endpoint are implemented with learner-content scrubbing.
- [x] CI workflow runs against a disposable PostgreSQL 17 service.
- [x] Builder, Better Auth, app creation, invitation create/resend, and publish/rollback limits share one atomic PostgreSQL-backed fixed-window limiter; managed deployment still requires migration `0004`.
- [x] Deterministic Builder fixtures are restricted to development/test; Builder limits apply in Preview and Production even if the fixture-mode variable is misconfigured.
- [x] Better Auth email/password identities and server-side app membership authorization exist.
- [x] Verification and password-reset requests fail clearly when required email delivery is unavailable; delivery logs omit recipient and token URL.
- [x] Existing app versions, preview/production runtime, publication, and rollback are PostgreSQL-backed.
- [x] Generated app execution remains declarative and constrained.
- [x] Six Missions' checkpoints and attempt/skill progress persist per authenticated learner, migrate a local save when no account record exists, and use revision checks for multi-device writes.
- [x] Studio coaching, reflection, observation, and version-learning records are per learner/app, revision-checked, private to their author, and synchronized with browser-save conflict choices.
- [ ] Apply migrations and verify signed-in Missions and Studio resume across two browsers against a managed PostgreSQL environment.
- [ ] Invitation email is delivered and resend behavior is verified.
- [ ] Apply migration `0004_shared_operation_rate_limits` in Preview and Production and verify Builder/auth throttles across multiple instances.
- [ ] External error monitoring is configured and a safe test event is verified.
- [ ] Run and record an isolated database restore drill using [the operations runbook](docs/OPERATIONS_RUNBOOK.md); verify provider retention/PITR settings and operator-approved recovery objectives.

## Requires operator or provider access

- [x] Create a dedicated Vercel Next.js project shell and set its Node runtime to 22.x; no Git connection or deployment was started.
- [ ] Connect `fernando-ace/BuildLoop-Learning-Platform` to the Vercel project after Preview/Production databases and environment settings are ready.
- [ ] Provision dedicated managed PostgreSQL databases for Preview and Production; use TLS, pooled app connections, and a separate migration connection when provider guidance requires it.
- [ ] Configure Vercel Preview and Production variables: `DATABASE_URL`, `DATABASE_POOL_MAX`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_APP_URL`, `BUILDLOOP_ENVIRONMENT`, `RESEND_API_KEY`, and `EMAIL_FROM`.
- [ ] Configure GitHub branch protection to require BuildLoop CI before merging to `master` and configure Vercel production promotion rules.
- [ ] Choose production origin, add it to hosting, and configure DNS/TLS after domain ownership is confirmed.
- [ ] Enable managed database automated backups (7-day retention minimum) and PITR if available; follow [the operations runbook](docs/OPERATIONS_RUNBOOK.md).
- [ ] Verify the sender domain and invitation, verification, and password-reset email delivery with the chosen provider.
- [ ] Create/configure a Sentry project, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, configure Vercel log retention/alerts, and verify a safe test event.
- [ ] Run preview and production smoke tests with real accounts, persistence, invitations, app publishing, and rollback; record deployment SHA and URL.

No external hosting, managed database, production domain, mail provider, or monitoring integration is currently verified. Do not mark the service production operational until the deployment and smoke tests have succeeded.
