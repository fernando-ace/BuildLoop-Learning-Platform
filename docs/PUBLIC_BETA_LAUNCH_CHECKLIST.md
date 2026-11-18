# Public beta launch checklist

This checklist separates code evidence from provider setup and launch approval. A checked local item does not prove hosted behavior. Production deployment is outside Goal 15.

## Automated technical verification

- [x] TypeScript typecheck and lint passed again on 2026-11-18; full unit and PostgreSQL integration suites pass 263/263 across 42 files (DB integration 12/12), production build, `drizzle-kit check`, and `git diff --check` passed in the 2026-11-17 local revalidation. Playwright passes 41/41 with an isolated PostgreSQL 17 test database, including a full Mission 6 mobile journey at 390×844. The browser suite and deterministic providers ran locally; this does not establish hosted behavior. Current scope and limitations: [Goal 15 evidence](GOAL15_EVIDENCE.md#executed-checks).
- [ ] Dependency audit is clean. Rechecked on 2026-11-18: `npm audit --audit-level=high` reports 14 high findings, with 8 when dev dependencies are omitted, all through `picomatch` for [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). GitHub still marks the advisory High with no patched version, while [Snyk now says its advisory was revoked as not a vulnerability](https://security.snyk.io/vuln/SNYK-JS-PICOMATCH-21248802); upstream [issue #247](https://github.com/micromatch/picomatch/issues/247) records the discrepancy. Upstream fix PRs [#237](https://github.com/micromatch/picomatch/pull/237) and [#238](https://github.com/micromatch/picomatch/pull/238) remain open. Audit remedies require breaking major downgrades. Current app source has no user-controlled glob path, and all 27 server trace manifests omit the matcher; Vite use is dev/test only. Treat this as a disputed but unresolved dependency alert until GitHub resolves it or a security owner documents risk acceptance. See [Goal 15 evidence](GOAL15_EVIDENCE.md#executed-checks).
- [x] Database migration journal check passes; the current migration set is present in the isolated Preview database. No Production migration was run.
- [x] Email verification and reset-link flows, invitation acceptance/expiration, invalid and reused tokens, abuse limits, delivery failures, and test capture are covered without sending real messages. These tests do not establish live delivery.
- [x] Builder authorization precedes provider calls; schema/safety validation, request bounds, rate limits, usage/concurrency limits, safe errors, and unavailable-provider behavior are tested with mocks.
- [x] Generated artifacts remain inside the declarative runtime and permission model in the automated fixtures and runtime/browser coverage.
- [x] Tenant isolation and role enforcement tests cover reads and mutations, including publish, rollback, invitations, and app runtime operations.
- [x] Independent authenticated contexts verify persistence, account switching, logout, invitation acceptance, role enforcement, publishing, rollback, cleanup, and shared-runtime interactions against a protected hosted Preview. A separate hosted synthetic account verified Studio editing/autosave and account-copy conflict resolution; shared runtime used a checked-in deterministic fixture, while successful AI-generated Builder preview remains open.
- [x] Local liveness/readiness smoke, hosted readiness, redacted structured logs, and correlated authorization-rejection diagnostics are verified; the runbook documents database/provider diagnosis and the repeatable smoke procedure. Durable Sentry event receipt and alert routing remain open below.
- [x] Desktop Playwright coverage includes Missions 1–6, sign-in/recovery, Studio save/build/preview/publish/rollback, and actionable failure states. Responsive coverage includes a full Mission 6 journey at 390×844, Mission 1, selected Mission 3/5 and Studio widths. Hosted 390px checks cover the complete Mission 1 flow, Mission 2's full happy path (with Mission 1 completion seeded as a prerequisite), Mission 4's deterministic localStorage-seeded anonymous path, Studio project creation/list persistence, and a published shared runtime. The Mission 2 attempt label fix was verified after deployment, and its focused Playwright regression passed locally (1/1). The full local E2E suite passes 41/41, including delayed-create and authenticated Mission 4 sync regressions. The latest Preview also verified signup/sign-in/sign-out without sending email and confirmed cleanup of that synthetic account. Hosted Mission 3's strong deterministic path synced a checkpoint, resumed after reload, persisted completion, and was read as complete in a second independent session. Hosted authenticated Mission 4 progress and Missions 5–6 remain open.
- [x] No exploitable critical/high application path was identified in the focused review and hosted isolation tests. The package-level `picomatch` audit alert remains listed above; focused source review is not a full penetration test.

## Provider and account prerequisites

- [x] Vercel deployment path supports an SSO-protected Preview without a Goal 15 Production deployment; current project inspection confirms SSO protection remains enabled. See [hosted evidence](GOAL15_EVIDENCE.md#hosted-verification-and-blockers).
- [ ] Production database is separate from Preview, uses TLS, has least-privilege credentials, and has automated backups and a successful isolated restore drill with agreed RPO/RTO.
- [ ] Production `DATABASE_URL`, migration connection, `BETTER_AUTH_SECRET`, canonical HTTPS origins, and callback URLs are provisioned and verified in the secret manager.
- [ ] Rotate the Preview `BETTER_AUTH_SECRET` flagged by Vercel as `readable-secret`, store the replacement with Secret visibility, redeploy, and verify sessions/sign-in. Preserve the current Preview config until the operator can safely coordinate rotation.
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
