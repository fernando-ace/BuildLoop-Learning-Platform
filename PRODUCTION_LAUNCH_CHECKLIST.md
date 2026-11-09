# Production launch checklist

## Implemented and verifiable in this repository

- [x] Node.js full-server deployment architecture documented for Next.js 16.
- [x] PostgreSQL migration command requires an explicit production opt-in and TLS URL.
- [x] Production migration command rejects localhost.
- [x] Liveness and PostgreSQL readiness endpoints expose redacted release metadata.
- [x] Sentry server/client integration and development-only verification endpoint are implemented with learner-content scrubbing.
- [x] CI workflow runs against a disposable PostgreSQL 17 service.
- [x] Better Auth email/password identities and server-side app membership authorization exist.
- [x] Existing app versions, preview/production runtime, publication, and rollback are PostgreSQL-backed.
- [x] Generated app execution remains declarative and constrained.
- [x] Six Missions' checkpoints and attempt/skill progress persist per authenticated learner, migrate a local save when no account record exists, and use revision checks for multi-device writes.
- [ ] Studio's personal coaching and reflection notes follow their learner across devices without becoming visible to other app members.
- [ ] Invitation email is delivered and resend behavior is verified.
- [ ] Shared rate limiting is active for paid/abuse-sensitive operations.
- [ ] External error monitoring is configured and a safe test event is verified.

## Requires operator or provider access

- [ ] Create/connect a dedicated Vercel project for `fernando-ace/BuildLoop-Learning-Platform` and connect Git deployments.
- [ ] Provision dedicated managed PostgreSQL databases for Preview and Production; use TLS, pooled app connections, and a separate migration connection when provider guidance requires it.
- [ ] Configure Vercel Preview and Production variables: `DATABASE_URL`, `DATABASE_POOL_MAX`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_APP_URL`, `BUILDLOOP_ENVIRONMENT`, and (after email implementation) `RESEND_API_KEY`/`EMAIL_FROM`.
- [ ] Configure GitHub branch protection to require BuildLoop CI before merging to `master` and configure Vercel production promotion rules.
- [ ] Choose production origin, add it to hosting, and configure DNS/TLS after domain ownership is confirmed.
- [ ] Enable managed database automated backups (7-day retention minimum) and PITR if available; perform and record an isolated restore drill.
- [ ] Verify sender domain and email delivery with the chosen provider after the email boundary is implemented.
- [ ] Create/configure a Sentry project, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, configure Vercel log retention/alerts, and verify a safe test event.
- [ ] Run preview and production smoke tests with real accounts, persistence, invitations, app publishing, and rollback; record deployment SHA and URL.

No external hosting, managed database, production domain, mail provider, or monitoring integration is currently verified. Do not mark the service production operational until the deployment and smoke tests have succeeded.
