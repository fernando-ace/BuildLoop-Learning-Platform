# Goal 14 validation evidence

Updated 2026-11-09 from the isolated `goal-14-production-readiness` worktree. This records local evidence only; it does not attest to a hosted deployment.

## Repository checks

| Check | Result | Scope and limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | TypeScript check. |
| `npm run lint` | Passed | ESLint. |
| `npm test` | 216 passed, 9 skipped (225 total) | PostgreSQL integration tests skip without `DATABASE_URL`; see below. |
| `npm run build` | Passed | Next.js 16.4.5 production build. |
| `npm audit --audit-level=moderate` | 0 vulnerabilities | Dependency audit at the time of this run. |
| `npx drizzle-kit check` | Passed | Migration journal and snapshots are internally consistent. This does not apply migrations to a database. |
| `git diff --check` | Passed | No whitespace errors in the reviewed changes. |

The focused `src/lib/platform/email.test.ts` suite passed (4 tests) after hardening required verification/password-reset email delivery. Typecheck and lint completed successfully. Required account-action mail now surfaces a generic retryable error if Resend is unconfigured or rejects delivery; logs contain no recipient or action URL.

## Browser and database checks

`npm run test:e2e` ran 33 Chromium cases: 20 passed and 13 Studio cases failed during shared setup. The test-auth endpoint could not create its test user because this worktree has no `DATABASE_URL`. The 13 failures report `Test authentication is not configured.` and happen before the Studio flows run; they are environment-blocked, not passing Studio evidence.

After adding learner cache isolation, the targeted first-Mission Chromium flow was rerun separately and passed (1 test).

The host reports a running PostgreSQL 17 service, but no `DATABASE_URL`, `psql`, or `pg_isready` is available. A read-only connection probe to the local server using the available local account names was rejected. No production or local test migrations were applied, and database integration tests were skipped. CI is configured to start a disposable PostgreSQL 17 service, run migrations, then run unit, integration, and browser suites; that GitHub workflow was not triggered from this checkout.

Shared PostgreSQL rate limits cover Builder generation, Better Auth authentication, app creation, invitation create/resend, and publish/rollback. Non-production tests with explicit test auth bypass write quotas. Unit tests cover the retry response, fail-closed response, and test bypass. The PostgreSQL integration suite includes learner progress separation, per-member private Studio reflections, owner-only brief visibility, stale-write rejection, per-learner archive behavior, and a concurrency check that expects exactly five of twelve simultaneous requests to consume a five-request quota. These will execute in CI after the committed migrations are applied.

Studio local copies are stored by linked learner when a browser switches accounts. A regression test verifies that switching to another linked learner hides the first learner's device-local project and restores it only when switching back.

Mission browser saves also switch by linked learner. A unit regression test verifies that one account's mission position is hidden for another account and restored when returning to the original account.

## Hosted-service evidence

The connected Vercel account had no BuildLoop project for the repository. A dedicated Next.js project shell was created and verified with Node 22.x; it has no Git connection, deployment, or domain yet. The connected Supabase account has three unrelated projects and no dedicated BuildLoop database. No managed database migration, public domain, Resend delivery, Sentry event, database backup, or restore drill has been verified. The launch checklist keeps these items open until the corresponding external resource is configured and tested.

## Local commits

- `1531949` — production health and release diagnostics
- `a252e07` — production operations foundation
- `cc1cbe2` — learner Mission progress persistence
- `576f8fc` — private per-learner Studio persistence
- `8c27a86` — shared auth and Builder rate limits
- `27b878f` — PostgreSQL rate-limit concurrency test

