# Goal 15 public beta readiness evidence

Updated 2026-11-17. This report tracks the Goal 15 branch only. It does not authorize or attest to a Goal 15 Production deployment.

## Decision

**Goal 15 status: PARTIALLY_COMPLETE; public beta verdict: NOT_READY.**

A protected Vercel Preview is available. The latest deployment, documentation commit `d2b9599` (`Record password recovery Preview checks`), reached `READY` at `https://buildloop-learning-platform-7znvrg9zp.vercel.app`. Vercel-authenticated fetches of its home page, liveness, and readiness returned 200; liveness/readiness report release SHA `d2b95994b4c74d096fe38fdfbe5909453d767a6a`. Readiness reports database `ok`, migration journal `current`, authentication `configured`, and email, Builder, and monitoring `unavailable`. Direct unauthenticated requests remain protected by deployment SSO. No Goal 15 Production deployment, promotion, alias, or protection change was made.

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
| Independent browser verification | Added independent browser contexts for distinct test identities; locally verified private-app isolation, account switching, and logout. Hosted Preview signup recovery and a separate Neon staging auth integration cover signup without email, separate sign-in, session resolution, and logout. | Local runs: full E2E 38/38 using an isolated local PostgreSQL 17 cluster and one Playwright worker; prior persistence-heavy timeouts did not reproduce. Local signup and password-recovery UI cases are included in that run. Auth integration is now 3/3 locally, covering captured verification-link completion before sign-in, reset-request anti-enumeration, captured reset email/token, invalid/expired/reused reset-token rejection, prior-session invalidation, old-password rejection, and replacement-password sign-in. A separate Neon staging auth integration (1/1) covers signup, sign-in, session lookup, and logout. Hosted synthetic-account runs verify Mission 1 completion/persistence in the UI, retrieval in a fresh context, distinct account progress, Studio creation/list persistence across contexts, private app denial, invitation acceptance, role enforcement, publishing and rollback, logout isolation, and cleanup. Hosted Studio editing, Builder generation, and runtime UI remain unverified. |
| Missions, Studio, account and publish UX | Kept the existing desktop/mobile Mission and Studio suite; invitation delivery states distinguish sent, captured, unconfigured, and failed. | Local browser suite covers all six Missions, Studio, invitation acceptance/role checks, publish/runtime behavior, and rollback. Hosted Preview completed Mission 1 and created a Studio project through the UI; a fresh context for A saw the project and learning record, while B saw no project and got 404. A separate hosted run verified invitation acceptance, role-denied publishing, version publication/rollback in PostgreSQL. Full hosted Studio editing/runtime workflows remain unverified. |
| Production release preparation | Added Goal 15 launch checklist, refreshed operations runbook and deployment boundary, documented email capture/daily Builder environment options, and corrected stale Builder quota architecture notes. | No Production configuration, migration, deployment, promotion, or external provider credential was changed. Goal 15 feature branch was pushed with explicit authorization; no PR was opened. |

## Executed checks

| Command/check | Result | Environment and limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | Local Goal 15 worktree. |
| `npm run lint` | Passed | Local Goal 15 worktree. |
| `npm test` | 261 passed (261 total; 41 files passed) | Local run against a disposable loopback PostgreSQL 17 database initialized from checked-in migrations; no database tests skipped. Synthetic users were removed and a follow-up query returned zero users; the temporary server was stopped after the run. |
| `platform.integration.test.ts` | 9/9 passed | Local test process against the dedicated Neon staging database; includes account-lock contention across independent PostgreSQL clients. Test-owned rows cleaned by the suite. |
| `auth.integration.test.ts` | 3/3 passed locally; 1/1 passed separately against Neon staging | Local disposable PostgreSQL run covers captured verification-link consumption before sign-in and full password recovery. Neon staging run covers unverified synthetic signup, separate password sign-in, session lookup, and logout. Synthetic users removed. |
| `npx playwright test --workers=1` | 38/38 passed. | Local Next.js dev server, deterministic Builder, and disposable loopback PostgreSQL 17 cluster migrated from the checked-in schema. The local auth UI cases verify signup and password-recovery messaging, including invalid/expired reset-token handling. Separate hosted Playwright/browser-context runs against the protected Preview are recorded below. |
| Synthetic-data cleanup verification | 0 residual synthetic users, auth accounts/sessions/verifications, Mission rows, Studio projects/apps, memberships, invitations, versions, or publication events | Preview PostgreSQL queries after hosted independent-account, Mission, invitation, publish, rollback, and account-isolation checks. Deletes were scoped to the two exact synthetic accounts and their test-created app/project. |
| Local built-server smoke | Liveness 200; readiness 200; unauthenticated learner API 401 with matching `X-Request-Id` | Built Next.js server in local test environment with staging DB; listener confirmed closed afterward. Not a hosted check. |
| `npm run build` | Passed | Next.js 16.4.5 production build after the Preview signup fix. |
| `npm audit --audit-level=moderate` | 0 vulnerabilities | Local lockfile audit; no dependency changes. |
| `npx drizzle-kit check` | Passed | Checked migration journal/snapshot consistency; no database migration was applied. |
| `git diff --check` | Passed | Checked after the evidence update and final source review. |

## Security review findings

The focused review found one authorization-order defect in Builder generation: a signed-in non-admin could trigger a model call for another app before version persistence rejected the request. The route now checks app ownership/administrator access first, and the regression test verifies the provider is not invoked. No critical/high defect remains known from this focused review. It was not a full penetration test, and hosted security behavior remains unverified.

Request IDs accept only bounded safe characters, are included with platform error logs, and are returned on those API errors. Email capture logs contain event/transport labels only. No passwords, action URLs, invitation tokens, project prompts, API keys, or database credentials were added to logs or evidence.

## Hosted verification and blockers

Vercel's current project state differs from the Goal 14 report. Read-only Vercel project inspection confirms the Hobby team, the GitHub link to this repository, `master` as the Production branch, and SSO protection enabled for deployments. Pushing `goal-15-public-beta-readiness` created protected Preview deployments for commits `736ace8`, `2899259`, and documentation-only follow-ups. The latest verified deployment is `dpl_5dCQDEFn4v77nLNZ8rugHuTaYE7v`, state `READY`, URL `https://buildloop-learning-platform-7znvrg9zp.vercel.app`, exact SHA `d2b95994b4c74d096fe38fdfbe5909453d767a6a`. Vercel-authenticated fetches of `/`, `/api/health/live`, and `/api/health/ready` returned 200 with the expected release SHA; readiness returned database `ok`, migration journal `current`, authentication `configured`, email, Builder, and monitoring `unavailable`. Direct unauthenticated requests remain protected by deployment SSO. A separate Production-target deployment record was created before Goal 15 began; the project reports `live=false` and no domains. Goal 15 did not create, modify, promote, alias, or change protection on that record.

Earlier hosted endpoint checks on application commit `2899259` and documentation-only Preview commit `cba7ac0`:

- `GET /`: 200; BuildLoop page title present.
- On `2899259`: `GET /`: 200 with BuildLoop page title; live and ready endpoints returned 200 with release `2899259f8213fc7f2f0bbb29ad018b247b7c6927`.
- On latest checked Preview `cba7ac0`: root, live, and ready endpoints returned 200 with release `cba7ac011318761883ac881a637a44c9ce9a5055`. Readiness reports database and migration journal `ok`/`current`, authentication `configured`; email, Builder, and monitoring are `unavailable`. Response request ID: `7fec3b3b-81bb-4499-b443-3b41ef31eb51`.
- Follow-up protected API fetches through the Vercel tool stopped at a Vercel authentication redirect (401), so they did not establish application-level session behavior.

Interactive hosted verification was completed using temporary independent browser contexts with separately issued BuildLoop sessions and the existing protected Preview access. The real Preview signup UI returned the actionable sign-in message when an account was created without email verification; sign-in then succeeded. Account A completed Mission 1 through the hosted UI; PostgreSQL recorded `mission1Progress.completed=true`. After logout, a fresh context for A retrieved the completed state, while independent account B saw only its own default progress. In a separate run, A created a Studio project through the UI; a fresh context for A saw the app and learning record, while B saw no projects/records and received 404 when requesting A's app. B accepted an owner-created link-only volunteer invitation and could read the shared app; PostgreSQL recorded `platform_role=member` and `app_role=volunteer`, while B's publish request returned 403. Owner A published versions 1 and 2, then rolled back to version 1; the Preview database recorded `v1` as current and a rollback event for `v1`. Logging out A invalidated A's session while B's independent session remained active. All synthetic users and app records were deleted, and follow-up queries returned zero residual rows. The test contexts were closed after verification.

Hosted limits: Studio project creation and persistence were verified through the UI, but editing, Builder generation, and shared runtime interaction were not exercised in the hosted UI. The browser tests used synthetic `.example.test` addresses and a link-only invite; no email was sent. Full hosted Mission coverage beyond Mission 1 and additional mobile workflows remain open. Local password-recovery integration uses a capture transport and disposable local PostgreSQL; it proves no live email delivery.

Live Resend delivery requires provider credentials and a verified sender/domain; no real recipient was contacted. Live OpenAI generation requires separately authorized zero-charge access; a ChatGPT subscription is not API authorization. Persistent monitoring event receipt also requires configured Sentry DSNs and a verified test event. The current Preview readiness endpoint marks each unavailable; all remain unverified.

## Cost and deployment boundary

Authorized spend remains **$0**. The current Vercel team plan is Hobby. The inherited Goal 14 evidence lists Neon Free; that plan was not freshly checked. No OpenAI request or real email was sent, and no paid service or trial was enabled. The Vercel billing-charges endpoint returned `costs_not_found`, and Neon billing data was not available, so this is not a current cross-provider billing-console audit. Before launch, an operator must verify Neon billing and provider usage; no spend should be authorized beyond $0.

No Production deployment, promotion, or production database migration is performed by Goal 15.

## Remaining steps before launch

1. Verify hosted Studio edit/save/preview, Builder-unavailable behavior, shared-app runtime interactions, and remaining mobile flows in independent sessions; current hosted proof covers UI project creation/persistence, tenant isolation, invitations, role denial, publishing, and rollback.
2. Provide a verified sender and Resend credentials, then test controlled email delivery without contacting unapproved recipients.
3. Authorize a $0 OpenAI access arrangement or keep live Builder generation disabled; set a true provider spending ceiling before any paid call.
4. Configure Sentry or another no-cost persistent monitoring target and verify a test event.
5. Verify Neon plan/cost, backup and restore procedures, and production-specific configuration and callbacks.
6. Complete remaining hosted independent-session UI checks, including Studio edit/save/preview, Builder-unavailable behavior, shared runtime, and mobile workflows.
7. Review the current changes in a PR. Do not merge, deploy to Production, promote, or weaken SSO as part of this goal.
