# Goal 15 public beta readiness evidence

Updated 2026-11-17. This report tracks the Goal 15 branch only. It does not authorize or attest to a Goal 15 Production deployment.

## Decision

**Goal 15 status: PARTIALLY_COMPLETE; public beta verdict: NOT_READY.**

A protected Vercel Preview is now available. The signup fix in commit `2899259` was deployed through Git integration and its home page and live/ready health checks returned 200. The latest branch commit, `995f2fb` (documentation-only follow-up), is READY at deployment `dpl_DFRv2573yALDwZM8gPCkfpTDd4SS` (`https://buildloop-learning-platform-aknxr5kga.vercel.app`); its liveness and readiness checks returned 200 and report the expected release SHA. Readiness reports database `ok`, migration journal `current`, authentication `configured`, and email, Builder, and monitoring `unavailable`. Full authenticated hosted testing still requires an interactive browser session. No Goal 15 Production deployment, promotion, alias, or protection change was made.

## Starting point

- Source branch: `goal-14-production-readiness` at `fa2aa77` (`Document hosted Goal 14 verification`), reported clean and 19 commits ahead of its remote.
- Goal 15 work is isolated at `goal-15-public-beta-readiness` in `C:\Users\Ferna\.codex\worktrees\goal-15-public-beta-readiness\BuildLoop`.
- Goal 14's hosted verification and its limits are preserved in [GOAL14_EVIDENCE.md](GOAL14_EVIDENCE.md).
- Goal 14 already had Better Auth email verification/reset hooks, hashed expiring invitations, Postgres-backed fixed-window limits, safe declarative Builder validation, structured logs, Sentry hooks, and liveness/readiness endpoints. These are inherited capabilities, not new Goal 15 validation.

## Changes and validation

| Area | Goal 15 change/evidence | Validation scope |
| --- | --- | --- |
| Email transport and templates | Added an injectable transport with a bounded in-memory development/test capture path; local Studio messages now say when mail was captured or failed. Test mode always captures, even if Resend variables are set. | Email suite: 6 passed. Resend responses are mocked; no real message was sent. Live email remains unverified. |
| Builder security and usage bounds | Authorization now requires app owner/administrator before provider invocation. Added a shared per-account daily quota (default 10, configurable 1–100) alongside 5/minute, and a transaction-scoped advisory lock limiting hosted generation to one in-flight build per account across instances; output remains capped at 6,000 tokens, with one bounded repair attempt and a 45-second timeout. | Builder route suite: 11/11. PostgreSQL platform integration suite: 9/9, including competing independent database clients. Deterministic/mock behavior only; no live or billable OpenAI request. There is no monetary spend cap. |
| Monitoring and operations | Platform API error/authorization logs now include a validated request ID and return it in `X-Request-Id`; Better Auth session lookup errors include the same correlation value. Added health, incident, secret rotation, database diagnosis and failed-deployment procedures. | Unit coverage includes request ID response behavior. Sentry is not configured or externally verified; this log evidence is local. |
| Tenant isolation and security | Fixed provider invocation before application access checks. Added distinct synthetic account E2E coverage for private app denial, account switching, and logout. | Focused source review plus tests; no critical/high finding remains known from this review. This is not a full penetration test. |
| Independent browser verification | Added independent browser contexts for distinct test identities; verified private app list/runtime isolation, account switching, and logout. Added a Preview signup recovery test and made Preview auth integration cover sign-up without email, separate sign-in, session resolution, and logout. | Prior full local run: 35/35. Latest full local run: 32/35; three persistence-heavy cases timed out under staging latency. Preview signup UI test: 1/1; Preview-mode Neon auth integration: 1/1. Hosted independent-account workflows remain unverified because the browser harness found no running Chrome session. |
| Missions, Studio, account and publish UX | Kept the existing desktop/mobile Mission and Studio suite; invitation delivery states now distinguish sent, captured, unconfigured, and failed. | Browser suite includes all six Missions, Studio, invitation acceptance/role checks, publish/runtime behavior, and rollback flows, all locally verified. |
| Production release preparation | Added Goal 15 launch checklist, refreshed operations runbook and deployment boundary, documented email capture/daily Builder environment options, and corrected stale Builder quota architecture notes. | No Production configuration, migration, deployment, promotion, or external provider credential was changed. Goal 15 feature branch was pushed with explicit authorization; no PR was opened. |

## Executed checks

| Command/check | Result | Environment and limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | Local Goal 15 worktree. |
| `npm run lint` | Passed | Local Goal 15 worktree. |
| `npm test` | 249 passed, 10 skipped (259 total; 39 files passed, 2 skipped) | Database-free run. Ten database-backed cases were skipped. |
| `platform.integration.test.ts` | 9/9 passed | Local test process against the dedicated Neon staging database; includes account-lock contention across independent PostgreSQL clients. Test-owned rows cleaned by the suite. |
| `auth.integration.test.ts` | 1/1 passed | Preview-mode Better Auth against Neon staging: unverified synthetic signup without email, separate password sign-in, session lookup, and logout. Synthetic user removed. |
| `npm run test:e2e` (Playwright CLI, 2 workers) | Prior baseline: 35/35 passed. Latest full run: 32/35 passed; three persistence-heavy tests timed out. Preview signup UI case: 1/1 passed separately. | Local Next.js dev server; deterministic Builder for broad suite. Preview signup test mocked the auth response to cover the form's no-email path. No full hosted browser run yet. |
| Post-E2E cleanup query | 0 synthetic users, projects, apps, invitations | Read-only query against the staging database after the passing 35-case run. |
| Local built-server smoke | Liveness 200; readiness 200; unauthenticated learner API 401 with matching `X-Request-Id` | Built Next.js server in local test environment with staging DB; listener confirmed closed afterward. Not a hosted check. |
| `npm run build` | Passed | Next.js 16.4.5 production build after the Preview signup fix. |
| `npm audit --audit-level=moderate` | 0 vulnerabilities | Local lockfile audit; no dependency changes. |
| `npx drizzle-kit check` | Passed | Checked migration journal/snapshot consistency; no database migration was applied. |
| `git diff --check` | Passed | Checked after the final documentation changes and before commit. |

## Security review findings

The focused review found one authorization-order defect in Builder generation: a signed-in non-admin could trigger a model call for another app before version persistence rejected the request. The route now checks app ownership/administrator access first, and the regression test verifies the provider is not invoked. No critical/high defect remains known from this focused review. It was not a full penetration test, and hosted security behavior remains unverified.

Request IDs accept only bounded safe characters, are included with platform error logs, and are returned on those API errors. Email capture logs contain event/transport labels only. No passwords, action URLs, invitation tokens, project prompts, API keys, or database credentials were added to logs or evidence.

## Hosted verification and blockers

Vercel's current project state differs from the Goal 14 report. Read-only Vercel project inspection confirms the Hobby team, the GitHub link to this repository, `master` as the Production branch, and SSO protection enabled for deployments. Pushing `goal-15-public-beta-readiness` created protected Preview deployments for commits `736ace8`, `2899259`, and `995f2fb`, each with a non-Production target. The latest is deployment `dpl_DFRv2573yALDwZM8gPCkfpTDd4SS`, state `READY`, URL `https://buildloop-learning-platform-aknxr5kga.vercel.app`, exact SHA `995f2fb4a1d7beb9ff038bb9ecb2a4a0b5b2317c`; it contains only documentation changes on top of the application code validated in `2899259`. A separate Production-target deployment record was created before Goal 15 began; the project reports `live=false` and no domains. Goal 15 did not create, modify, promote, alias, or change protection on that record.

Hosted checks on application commit `2899259` and latest Preview commit `995f2fb`:

- `GET /`: 200; BuildLoop page title present.
- On `2899259`: `GET /`: 200 with BuildLoop page title; live and ready endpoints returned 200 with release `2899259f8213fc7f2f0bbb29ad018b247b7c6927`.
- On latest `995f2fb`: live and ready endpoints returned 200 with release `995f2fb4a1d7beb9ff038bb9ecb2a4a0b5b2317c`. Readiness reports database and migration journal `ok`/`current`, authentication `configured`; email, Builder, and monitoring are `unavailable`. Response request ID: `3d0fb465-e1bb-44d6-bb6b-c62b29adb2e8`.
- Follow-up protected API fetches through the Vercel tool stopped at a Vercel authentication redirect (401), so they did not establish application-level session behavior.

The local browser harness could not run interactive hosted tests: its diagnostic reported no Chrome process and no real page. Its setup instructions require Chrome to be open for a local authenticated browser session. No cloud browser was used because it would exceed the $0 constraint. Therefore hosted independent-account Mission/Studio persistence, invitations, publishing, rollback, and cleanup remain unverified. The signup correction is included in the latest hosted Preview build, though its browser behavior was verified only locally with a mocked signup response.

Live Resend delivery requires provider credentials and a verified sender/domain; no real recipient was contacted. Live OpenAI generation requires separately authorized zero-charge access; a ChatGPT subscription is not API authorization. Persistent monitoring event receipt also requires configured Sentry DSNs and a verified test event. The current Preview readiness endpoint marks each unavailable; all remain unverified.

## Cost and deployment boundary

Authorized spend remains **$0**. The current Vercel team plan is Hobby. The inherited Goal 14 evidence lists Neon Free; that plan was not freshly checked. No OpenAI request or real email was sent, and no paid service or trial was enabled. The Vercel billing-charges endpoint returned `costs_not_found`, and Neon billing data was not available, so this is not a current cross-provider billing-console audit. Before launch, an operator must verify Neon billing and provider usage; no spend should be authorized beyond $0.

No Production deployment, promotion, or production database migration is performed by Goal 15.

## Remaining steps before launch

1. Open Chrome so browser-harness can use the existing authenticated session; then run the independent-account hosted workflows and confirm cleanup.
2. Provide a verified sender and Resend credentials, then test controlled email delivery without contacting unapproved recipients.
3. Authorize a $0 OpenAI access arrangement or keep live Builder generation disabled; set a true provider spending ceiling before any paid call.
4. Configure Sentry or another no-cost persistent monitoring target and verify a test event.
5. Verify Neon plan/cost, backup and restore procedures, and production-specific configuration and callbacks.
6. Re-run the full Playwright suite after staging latency stabilizes; resolve or document the three timeout cases.
7. Review the current changes in a PR. Do not merge, deploy to Production, promote, or weaken SSO as part of this goal.
