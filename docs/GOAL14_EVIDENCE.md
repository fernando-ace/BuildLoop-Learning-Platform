# Goal 14 validation evidence

Updated 2026-11-09 from the isolated `goal-14-production-readiness` worktree. This records local evidence only; it does not attest to a hosted deployment.

## Repository checks

| Check | Result | Scope and limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | TypeScript check. |
| `npm run lint` | Passed | ESLint. |
| `npm test` | 235 passed, 9 skipped (244 total) | 39 test files passed; 2 skipped. PostgreSQL integration tests skip without `DATABASE_URL`; see below. The added readiness cases cover hosted configuration, secret redaction, and stale migrations; the latest regression covers oversized authenticated app mutations. |
| `npm run build` | Passed | Next.js 16.4.5 production build. |
| `npm audit --audit-level=moderate` | 0 vulnerabilities | Dependency audit run 2026-11-09. |
| `npx drizzle-kit check` | Passed | Migration journal and snapshots are internally consistent. This does not apply migrations to a database. |
| `git diff --check` | Passed | No whitespace errors in the reviewed changes. |

The focused `src/lib/platform/email.test.ts` suite passed (4 tests) after hardening required verification/password-reset email delivery. Required account-action mail now surfaces a generic retryable error if Resend is unconfigured or rejects delivery; logs contain no recipient or action URL.

Hosted `/api/health/ready` now reports database and migration status plus configuration status for authentication, email, Builder, and monitoring. It fails closed in Preview/Production when any required configuration is absent or when the database migration journal is behind the latest timestamp in the checked-in Drizzle journal; local and test environments report hosted integrations as `not_required`. Authentication readiness checks a 32-character secret and matching HTTPS application/auth origins. The response and readiness log include check names/status only, never configured values. Six focused tests and the full suite cover missing hosted settings, redaction, a behind database journal, and a fully configured hosted response. `configured` confirms environment-variable shape/presence only; it does not establish successful provider authentication, email delivery, or Sentry event receipt, which remain external launch checks.

Shared app runtime mutations now use the bounded JSON reader with a 64 KB limit. A signed-in HTTP-boundary regression test confirms an oversized request is rejected before repository/database access.

The focused migration-target suite passed (13 tests). It covers remote and production opt-ins, production/local rejection including IPv4 and IPv6 loopback, Vercel environment mismatch, PostgreSQL URL validation, and TLS enforcement for both migrations and runtime connections. Production accepts only `sslmode=require`, `verify-ca`, or `verify-full`; `prefer` and `allow` are rejected because they can fall back to plaintext. Typecheck, lint, the full unit suite, and production build passed after this change.

The Studio Builder route suite passed (7 tests), including hosted configuration with deterministic mode set: the deterministic provider is rejected and the shared learner quota is still consumed. Full test, typecheck, lint, and build checks passed after this change.

CI now uses full Git history for PR/push whitespace validation, runs `npx drizzle-kit check` before applying migrations, and names its required job check `BuildLoop CI quality`. Node 22 is declared in `package.json` engines and the matching root package-lock entry; `.npmrc` sets `engine-strict=true`. The local Node runtime was 22.17.1. The workflow YAML parsed successfully and the migration journal check passed locally. No GitHub Actions run was triggered because the workflow is not yet present on the remote default branch.

`npm config get engine-strict` returned `true`, and `npm ci --dry-run --ignore-scripts` completed successfully on Node 22.17.1 with the checked-in package lock.

## Browser and database checks

`npm run test:e2e` ran 33 Chromium cases: 20 passed and 13 Studio cases failed during shared setup. The test-auth endpoint could not create its test user because this worktree has no `DATABASE_URL`. The 13 failures report `Test authentication is not configured.` and happen before the Studio flows run; they are environment-blocked, not passing Studio evidence.

After adding learner cache isolation, the targeted first-Mission Chromium flow was rerun separately and passed (1 test).

The host reports a running PostgreSQL 17 service, but no `DATABASE_URL`, `psql`, or `pg_isready` is available. A read-only connection probe to the local server using the available local account names was rejected. Docker CLI is installed, but the Docker daemon is unavailable, so a disposable PostgreSQL service could not be started locally. No production or local test migrations were applied, and database integration tests were skipped. CI is configured to start a disposable PostgreSQL 17 service, run migrations, then run unit, integration, and browser suites; that GitHub workflow was not triggered from this checkout.

## Local performance smoke

The local Next.js production build was started on port 33141, then stopped after the read-only smoke. Twenty concurrent unauthenticated `GET /` requests returned 200 (mean response body 6,451 bytes; warm p50 167 ms, p95 170 ms, max 198 ms). Thirty concurrent `/api/health/live` requests returned 200 (warm p50 111 ms, p95 148 ms, max 154 ms). The first batches were slower during cold startup (home p50 454 ms; liveness p50 193 ms). Five concurrent `/api/health/ready` requests returned 503 because the test host had no usable PostgreSQL configuration; this is the expected fail-closed result, not a successful readiness check. These small local measurements do not demonstrate hosted capacity or database query performance. After configuring `@sentry/server-runtime-injection` as a Next server external, the production server started without the hook-resolution warning. Trace sampling remains disabled (`tracesSampleRate: 0`), and no Sentry event delivery was verified.

Shared PostgreSQL rate limits cover Builder generation, Better Auth authentication, app creation, invitation create/resend, and publish/rollback. Non-production tests with explicit test auth bypass write quotas. Unit tests cover the retry response, fail-closed response, and test bypass. The PostgreSQL integration suite includes learner progress separation, per-member private Studio reflections, owner-only brief visibility, stale-write rejection, per-learner archive behavior, and a concurrency check that expects exactly five of twelve simultaneous requests to consume a five-request quota. These will execute in CI after the committed migrations are applied.

Studio local copies are stored by linked learner when a browser switches accounts. A regression test verifies that switching to another linked learner hides the first learner's device-local project and restores it only when switching back.

Mission browser saves also switch by linked learner. A unit regression test verifies that one account's mission position is hidden for another account and restored when returning to the original account.

## Hosted-service evidence

The connected Vercel account had no BuildLoop project for the repository. A dedicated Next.js project shell was created and verified with Node 22.x; it has no Git connection, deployment, or domain yet. The connected Supabase account has three unrelated projects and no dedicated BuildLoop database. GitHub API inspection confirmed `master` currently has no protection rule and no Actions workflow on the default branch; the local CI workflow has not been pushed. No managed database migration, public domain, Resend delivery, Sentry event, database backup, or restore drill has been verified. The launch checklist keeps these items open until the corresponding external resource is configured and tested.

## Local commits

- `1531949` — production health and release diagnostics
- `a252e07` — production operations foundation
- `cc1cbe2` — learner Mission progress persistence
- `576f8fc` — private per-learner Studio persistence
- `8c27a86` — shared auth and Builder rate limits
- `27b878f` — PostgreSQL rate-limit concurrency test

