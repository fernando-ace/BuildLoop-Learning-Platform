# Goal 15 public beta readiness evidence

Updated 2026-11-16. This report tracks the Goal 15 branch only. It does not authorize or attest to a Production deployment.

## Decision

**Goal 15 status: PARTIALLY_COMPLETE; public beta verdict: NOT_READY.**

The repository work can improve safeguards and local confidence, but the protected hosted Preview cannot currently be tested. The existing Vercel project has no deployment record. Goal 14's recorded CLI attempts show that Vercel rejected explicit Preview deployment requests because it requires a Production-classified first deployment. Goal 15 forbids creating or promoting a Production deployment, so that prerequisite remains unresolved. No Production deployment, promotion, alias, or protection change is authorized here.

## Starting point

- Source branch: `goal-14-production-readiness` at `fa2aa77` (`Document hosted Goal 14 verification`), reported clean and 19 commits ahead of its remote.
- Goal 15 work is isolated at `goal-15-public-beta-readiness` in `C:\Users\Ferna\.codex\worktrees\goal-15-public-beta-readiness\BuildLoop`.
- Goal 14's hosted verification and its limits are preserved in [GOAL14_EVIDENCE.md](GOAL14_EVIDENCE.md).
- Goal 14 already had Better Auth email verification/reset hooks, hashed expiring invitations, Postgres-backed fixed-window limits, safe declarative Builder validation, structured logs, Sentry hooks, and liveness/readiness endpoints. These are inherited capabilities, not new Goal 15 validation.

## Changes and validation

| Area | Goal 15 change/evidence | Validation scope |
| --- | --- | --- |
| Email transport and templates | Added an injectable transport with a bounded in-memory development/test capture path; local Studio messages now say when mail was captured or failed. Test mode always captures, even if Resend variables are set. | Email suite: 6 passed. Resend responses are mocked; no real message was sent. Live email remains unverified. |
| Builder security and usage bounds | Authorization now requires app owner/administrator before provider invocation. Added a shared per-account daily quota (default 10, configurable 1–100) alongside 5/minute; output remains capped at 6,000 tokens, with one bounded repair attempt and a 45-second timeout. | Builder route suite: 10 passed inside full suite. Deterministic/mock behavior only; no live or billable OpenAI request. There is no in-flight concurrency limit or monetary spend cap. |
| Monitoring and operations | Platform API error/authorization logs now include a validated request ID and return it in `X-Request-Id`; Better Auth session lookup errors include the same correlation value. Added health, incident, secret rotation, database diagnosis and failed-deployment procedures. | Unit coverage includes request ID response behavior. Sentry is not configured or externally verified; this log evidence is local. |
| Tenant isolation and security | Fixed provider invocation before application access checks. Added distinct synthetic account E2E coverage for private app denial, account switching, and logout. | Focused source review plus tests; no critical/high finding remains known from this review. This is not a full penetration test. |
| Independent browser verification | Added independent browser contexts for distinct test identities; verified private app list/runtime isolation, account switching, and logout. Existing cross-context same-user test verifies persisted Mission and Studio state. | 35/35 local Playwright tests passed against the local app and dedicated Neon staging DB with deterministic Builder and test auth. This is not protected hosted Preview verification. Post-run cleanup query found zero synthetic users, projects, apps, or invitations. |
| Missions, Studio, account and publish UX | Kept the existing desktop/mobile Mission and Studio suite; invitation delivery states now distinguish sent, captured, unconfigured, and failed. | Browser suite includes all six Missions, Studio, invitation acceptance/role checks, publish/runtime behavior, and rollback flows, all locally verified. |
| Production release preparation | Added Goal 15 launch checklist, refreshed operations runbook and deployment boundary, documented email capture/daily Builder environment options, and corrected stale Builder quota architecture notes. | Documentation reviewed locally. No Production config, migration, deployment, promotion, or external provider credential was changed. |

## Executed checks

| Command/check | Result | Environment and limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | Local Goal 15 worktree. |
| `npm run lint` | Passed | Local Goal 15 worktree. |
| `npm test` | 245 passed, 9 skipped (254 total; 39 files passed, 2 skipped) | Database-free run. Nine DB-backed cases were skipped. |
| `platform.integration.test.ts` | 8/8 passed | Local test process against Goal 14's dedicated Neon staging database; test-owned rows cleaned by the suite. |
| `auth.integration.test.ts` | 1/1 passed | Local Better Auth signup/session/logout against the same staging database; synthetic user removed. |
| `npm run test:e2e` (Playwright CLI, 2 workers) | 35/35 passed | Local Next.js dev server with deterministic Builder/test authentication and Neon staging persistence. Not a hosted deployment. |
| Post-E2E cleanup query | 0 synthetic users, projects, apps, invitations | Read-only query against the staging database after the passing 35-case run. |
| Local built-server smoke | Liveness 200; readiness 200; unauthenticated learner API 401 with matching `X-Request-Id` | Built Next.js server in local test environment with staging DB; listener confirmed closed afterward. Not a hosted check. |
| `npm run build` | Passed | Next.js 16.4.5 production build after source edits. |
| `npm audit --audit-level=moderate` | 0 vulnerabilities | Local lockfile audit; no dependency changes. |
| `npx drizzle-kit check` | Passed | Checked migration journal/snapshot consistency; no database migration was applied. |
| `git diff --check` | Passed | Checked after the final documentation changes and before commit. |

## Security review findings

The focused review found one authorization-order defect in Builder generation: a signed-in non-admin could trigger a model call for another app before version persistence rejected the request. The route now checks app ownership/administrator access first, and the regression test verifies the provider is not invoked. No critical/high defect remains known from this focused review. It was not a full penetration test, and hosted security behavior remains unverified.

Request IDs accept only bounded safe characters, are included with platform error logs, and are returned on those API errors. Email capture logs contain event/transport labels only. No passwords, action URLs, invitation tokens, project prompts, API keys, or database credentials were added to logs or evidence.

## Hosted verification and blockers

Goal 14 reports no active deployment URL and no hosted Preview. Therefore Goal 15 has no URL against which to run the requested independent-account persistence, invitation, publishing, rollback, or synthetic-data cleanup flow. The Goal 14 Neon Preview database exists, but local application tests against it do not establish hosted application behavior. Do not bypass SSO or deployment protection and do not satisfy the first-deployment rule with a Production-classified deployment.

External action required: Vercel must provide a supported way to establish a protected Preview deployment without creating or promoting a Production deployment, or the project owner must approve a different $0 staging setup that does not affect unrelated infrastructure. Until that is resolved, hosted verification is blocked.

Live Resend delivery requires provider credentials and a verified sender/domain; no real recipient is to be contacted during this goal. Live OpenAI generation requires separately authorized zero-charge access; a ChatGPT subscription is not API authorization. Persistent monitoring event receipt also requires configured Sentry DSNs and a verified test event. Record each as unverified until tested.

## Cost and deployment boundary

Authorized spend remains **$0**. No OpenAI request or real email was sent for this work. The inherited Goal 14 evidence records Vercel Hobby and Neon Free, each at $0/month; these plan and billing states were not freshly checked during Goal 15. No paid services or trials were enabled. An operator must recheck provider billing/usage before launch; this report does not claim a current billing-console audit.

No Production deployment, promotion, or production database migration is performed by Goal 15.

## Final report fields

Before closing Goal 15, replace pending items with exact evidence and include: commands and pass counts; hosted Preview result; security findings/remediations; unresolved external prerequisites; current monthly service cost and the source used to verify it; branch/commit/worktree status; push/PR state; and the remaining controlled launch steps.
