# Public beta launch checklist

This checklist separates code evidence from provider setup and launch approval. A checked local item does not prove hosted behavior. Production deployment is outside Goal 15.

## Automated technical verification

- [ ] TypeScript typecheck, lint, full unit suite, PostgreSQL integration suite, Playwright suite, production build, dependency audit, and `git diff --check` pass on the release candidate.
- [ ] Database migration journal check passes; the exact migration set is reviewed and applied to an isolated Preview database before any Production migration.
- [ ] Email verification, reset, invitations, expiration, invalid tokens, throttles, delivery failure, and test capture transport are covered without sending real messages.
- [ ] Builder authorization precedes provider calls; schema/safety validation, request bounds, rate limits, usage/concurrency limits, safe errors, and unavailable-provider behavior are tested with mocks.
- [ ] Generated artifacts remain inside the declarative runtime and permission model.
- [ ] Tenant isolation and role enforcement tests cover reads and mutations, including publish, rollback, invitations, and app runtime operations.
- [ ] Independent authenticated contexts verify persistence, account switching, logout, invitation acceptance, role enforcement, publishing, rollback, and cleanup against a protected hosted Preview.
- [ ] Liveness/readiness checks, structured redacted logs, correlation IDs, database failure diagnostics, provider failure diagnostics, and the operational smoke procedure are verified.
- [ ] Desktop and mobile core flows cover Missions 1–6, sign-in/recovery, Studio save/build/preview/publish/rollback, and actionable failure states.
- [ ] Production build output and dependency audit contain no known unresolved critical/high findings.

## Provider and account prerequisites

- [ ] Vercel deployment path supports an SSO-protected Preview without a Production deployment; confirm deployment protection remains enabled.
- [ ] Production database is separate from Preview, uses TLS, has least-privilege credentials, and has automated backups and a successful isolated restore drill with agreed RPO/RTO.
- [ ] Production `DATABASE_URL`, migration connection, `BETTER_AUTH_SECRET`, canonical HTTPS origins, and callback URLs are provisioned and verified in the secret manager.
- [ ] Email provider is selected within the $0 approved limit; sender/domain is verified; delivery, bounce/failure handling, and recovery links are tested with controlled addresses.
- [ ] OpenAI API access has separately approved spend controls or a confirmed zero-charge arrangement; key is server-only; model and provider quotas are bounded.
- [ ] Sentry or another approved no-cost monitoring path is configured; test event receipt and alert routing are verified.
- [ ] Hosting, database, email, model, monitoring, and domain plan/pricing/usage are rechecked against the $0/month authorization.

## Human launch approval

- [ ] Product owner accepts the beta scope, known limits, privacy language, support contact, and incident owner.
- [ ] Operator reviews the release commit, migration plan, backup/restore evidence, deployment protection, smoke results, rollback plan, and cost ceiling.
- [ ] Security review resolves every critical/high issue and records accepted lower-severity risks.
- [ ] A release owner approves the specific Production deployment and maintenance window. This approval must be separate from Goal 15's no-Production work.
- [ ] Post-launch operator completes health, authentication, email, Builder, persistence, monitoring, and rollback checks before inviting users.

## Current Goal 15 gate

Public beta is **NOT_READY** while hosted Preview verification, verified live email, authorized live Builder access, durable monitoring receipt, and Production backup/restore evidence remain incomplete. The documented Vercel first-deployment blocker cannot be addressed by creating a Production-classified deployment under Goal 15.
