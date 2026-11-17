# Public beta launch checklist

This checklist separates code evidence from provider setup and launch approval. A checked local item does not prove hosted behavior. Production deployment is outside Goal 15.

## Automated technical verification

- [x] TypeScript typecheck, lint, full unit suite, PostgreSQL integration suite, Playwright suite, production build, and `git diff --check` pass on the release candidate. Current counts and scope: [Goal 15 evidence](GOAL15_EVIDENCE.md#executed-checks).
- [ ] Dependency audit is clean. Rechecked `npm audit --audit-level=high` reports 14 high findings, with 8 when dev dependencies are omitted, all through `picomatch` for [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). The advisory was updated Nov 17, lists no patched version, and upstream fix PRs [#237](https://github.com/micromatch/picomatch/pull/237) and [#238](https://github.com/micromatch/picomatch/pull/238) remain open. Audit's remedies require breaking major downgrades. Current app source and 27 server trace manifests show no production request path to the matcher; Vite use is dev/test only. Keep this alert tracked and reassess when a fix ships or dependencies/configuration change. See [Goal 15 evidence](GOAL15_EVIDENCE.md#executed-checks).
- [x] Database migration journal check passes; the current migration set is present in the isolated Preview database. No Production migration was run.
- [x] Email verification and reset-link flows, invitation acceptance/expiration, invalid and reused tokens, abuse limits, delivery failures, and test capture are covered without sending real messages. These tests do not establish live delivery.
- [x] Builder authorization precedes provider calls; schema/safety validation, request bounds, rate limits, usage/concurrency limits, safe errors, and unavailable-provider behavior are tested with mocks.
- [x] Generated artifacts remain inside the declarative runtime and permission model in the automated fixtures and runtime/browser coverage.
- [x] Tenant isolation and role enforcement tests cover reads and mutations, including publish, rollback, invitations, and app runtime operations.
- [x] Independent authenticated contexts verify persistence, account switching, logout, invitation acceptance, role enforcement, publishing, rollback, cleanup, and shared-runtime interactions against a protected hosted Preview. A separate hosted synthetic account verified Studio editing/autosave and account-copy conflict resolution; shared runtime used a checked-in deterministic fixture, while successful AI-generated Builder preview remains open.
- [ ] Liveness/readiness checks, structured redacted logs, correlation IDs, database failure diagnostics, provider failure diagnostics, and the operational smoke procedure are verified.
- [x] Desktop Playwright coverage includes Missions 1–6, sign-in/recovery, Studio save/build/preview/publish/rollback, and actionable failure states. Responsive Playwright cases cover Mission 1 and selected Mission 3/5/6 and Studio widths. Hosted 390px checks cover the complete Mission 1 flow, Mission 2's full happy path (with Mission 1 completion seeded as a prerequisite), Studio project creation/list persistence, and a published shared runtime. The Mission 2 attempt label fix was verified after deployment, and its focused Playwright regression passed locally (1/1). The latest Preview also verified signup/sign-in/sign-out without sending email and confirmed cleanup of that synthetic account. Hosted Missions 3–6 and additional mobile workflows remain open.
- [x] No exploitable critical/high application path was identified in the focused review and hosted isolation tests. The package-level `picomatch` audit alert remains listed above; focused source review is not a full penetration test.

## Provider and account prerequisites

- [x] Vercel deployment path supports an SSO-protected Preview without a Goal 15 Production deployment; current project inspection confirms SSO protection remains enabled. See [hosted evidence](GOAL15_EVIDENCE.md#hosted-verification-and-blockers).
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

The Vercel Git integration now creates protected Preview deployments from the Goal 15 feature branch. One protected, unaliased, nonfunctional Production-classified bootstrap created under Goal 14 predates this goal; Goal 15 has not changed it or created a Production release. The original first-deployment concern is no longer a blocker for Preview validation. Public beta remains **NOT_READY** while independent authenticated hosted workflows, verified live email, authorized live Builder access, durable monitoring receipt, and Production backup/restore evidence remain incomplete. Do not create or promote a Production deployment under Goal 15.
