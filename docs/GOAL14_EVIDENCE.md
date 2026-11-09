# Goal 14 validation evidence

Updated 2026-11-09 from the isolated `goal-14-production-readiness` worktree. This records local evidence only; it does not attest to a hosted deployment.

## Repository checks

| Check | Result | Scope and limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | TypeScript check. |
| `npm run lint` | Passed | ESLint. |
| `npm test` | 212 passed, 8 skipped (220 total) | PostgreSQL integration tests skip without `DATABASE_URL`; see below. |
| `npm run build` | Passed | Next.js 16.4.5 production build. |
| `npm audit --audit-level=moderate` | 0 vulnerabilities | Dependency audit at the time of this run. |
| `npx drizzle-kit check` | Passed | Migration journal and snapshots are internally consistent. This does not apply migrations to a database. |
| `git diff --check` | Passed | No whitespace errors in the reviewed changes. |

## Browser and database checks

`npm run test:e2e` ran 33 Chromium cases: 20 passed and 13 Studio cases failed during shared setup. The test-auth endpoint could not create its test user because this worktree has no `DATABASE_URL`. The 13 failures report `Test authentication is not configured.` and happen before the Studio flows run; they are environment-blocked, not passing Studio evidence.

The host reports a running PostgreSQL 17 service, but no `DATABASE_URL`, `psql`, or `pg_isready` is available. A read-only connection probe to the local server using the available local account names was rejected. No production or local test migrations were applied, and database integration tests were skipped. CI is configured to start a disposable PostgreSQL 17 service, run migrations, then run unit, integration, and browser suites; that GitHub workflow was not triggered from this checkout.

The PostgreSQL integration suite now includes a concurrency check that expects exactly five of twelve simultaneous requests to consume a five-request quota. It will execute in CI after migration `0004_shared_operation_rate_limits` is applied.

## Hosted-service evidence

No Vercel deployment, managed database, public domain, Resend delivery, Sentry event, database backup, or restore drill has been verified from this worktree. The launch checklist keeps these items open until the corresponding external resource is configured and tested.

## Local commits

- `1531949` — production health and release diagnostics
- `a252e07` — production operations foundation
- `cc1cbe2` — learner Mission progress persistence
- `576f8fc` — private per-learner Studio persistence
- `8c27a86` — shared auth and Builder rate limits
- `27b878f` — PostgreSQL rate-limit concurrency test

