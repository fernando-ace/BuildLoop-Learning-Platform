# Operations

## Architecture and health

Vercel runs the Next.js Node.js application. Managed PostgreSQL stores users, Better Auth sessions, memberships, invitations, app versions, preview/production records, publication history, and audit events. There is no production filesystem state. The old SQLite shared-app store is retained only as a legacy import source.

- `GET /api/health/live`: process can serve a request; no dependency query.
- `GET /api/health/ready`: performs bounded PostgreSQL checks and verifies the migration journal reaches the checked-in head. Preview requires database, migration, and authentication readiness; Production additionally requires email, Builder, and monitoring configuration. It returns 503 if an environment-required check fails.
- `GET /api/health`: compatibility alias for liveness.

Responses contain status, timestamp, environment, release, and app version; readiness adds dependency/configuration check statuses only. Hosted integration checks verify configuration shape/presence, not provider delivery. Responses do not return exception details or connection configuration. Health requests emit structured JSON logs with a request ID and duration.

## Troubleshooting

1. Check the deployment's Vercel runtime logs and identify its release SHA.
2. Request liveness, then readiness. A live but not-ready instance usually indicates missing/invalid database configuration, database unavailability or exhausted connections, a migration journal behind the deployed code, or missing authentication configuration. In Production, missing email, Builder, or monitoring configuration also blocks readiness. Use the named check statuses to identify the failing gate.
3. Confirm the environment variables are scoped to the same Vercel environment as the deployment. Never paste secret values into tickets or logs.
4. Check the managed database's connection count, TLS status, service health, and migration journal.
5. For authentication issues, confirm `BETTER_AUTH_URL`, `PUBLIC_APP_URL`, HTTPS, and the deployment's allowed origin. Reset a user's password through the supported account flow; do not edit password hashes directly.
6. For Builder issues, check provider status and server key configuration. Missing provider configuration should be a controlled 503, not a successful demo response.
7. For email verification or password reset issues, verify `RESEND_API_KEY`, `EMAIL_FROM`, sender-domain status, and the configured public origin. Do not enable unverified-account access as a workaround.

The Sentry integration captures uncaught server/request and client errors when the appropriate DSN is configured. Event scrubbing removes request bodies, headers, query strings, user identity, extra payloads, breadcrumb content, and invitation tokens. The fixed test event is available only in development/test with `BUILDLOOP_MONITORING_TEST=1`; POST `/api/monitoring/test` and confirm the event in Sentry before launch. Configure source-map upload separately if readable production stacks are required. Structured logs currently cover health and database-pool failures; do not log passwords, session tokens, database URLs, API keys, or learner prose.

Builder generation, Better Auth authentication, application creation, invitation create/resend, and app publish/rollback use shared PostgreSQL fixed-window rate limits. A missing/unavailable limiter table fails closed: auth requests fail and other protected operations return 503. Current limits are five Builder calls per learner/minute, ten app creations per learner/hour, five invitations per learner/15 minutes, three invitation resends per learner/15 minutes, and ten publish/rollback actions per learner/10 minutes. Authentication uses Better Auth's configured endpoint-specific windows and ceilings. Non-production tests with explicit test auth bypass mutation quotas for deterministic runs. Check PostgreSQL readiness and migration `0004_shared_operation_rate_limits` when these requests fail.

## Database backups and recovery

No production database is connected from this checkout, so backups are not active yet. For the selected managed PostgreSQL service, enable automated daily backups at minimum and point-in-time recovery if the chosen plan supports it. Set a minimum 7-day retention before launch. Initial planning assumptions are RPO ≤24 hours with daily backups (≤5 minutes only if PITR is confirmed) and RTO ≤4 hours; measure and revise these after a restore drill.

The service operator initiates restoration. Restore to a new isolated database/project first, never over production. Verify the restored service identity/host and database name, compare migration journal and row counts for core tables, run readiness and authenticated read-only smoke checks, and check a known app's version/published pointer. Update the production secret only after verification and a change window; keep the original database intact until the recovered service is confirmed. Re-run application migrations only if the restored schema is behind the selected release. Record backup timestamp, restore point, verification, and operator.

Run a restore drill into a disposable database at least quarterly and after changing providers. Do not claim a restore process works until that drill has succeeded. A sanitized logical export can complement provider backups but does not replace them; no platform-wide export command currently exists.

## Incidents

- **Bad application deployment:** use the hosting provider's deployment rollback to restore the previous release. Confirm readiness afterward. Review schema compatibility before rolling back across a migration.
- **Database outage:** avoid repeated deploys. Check provider status and connection limits, preserve logs, then retry readiness. If data corruption is suspected, stop writes and follow the isolated restore procedure.
- **Migration failure:** stop promotion; preserve logs and migration journal; inspect partially applied DDL; fix forward with a reviewed migration. Never run reset/seed against production.
- **OpenAI outage:** the app should report a controlled provider error; saved projects and prior versions remain available. Retry only after provider recovery.
- **Email outage:** invitation links remain available through the in-app flow. Do not create duplicate invitations repeatedly; inspect pending invitation state and resend the same active invitation when delivery is implemented.
- **Secret exposure:** rotate the affected provider/database key, update only the affected environment, redeploy/restart, verify readiness, and revoke the old key. Rotate `BETTER_AUTH_SECRET` deliberately because existing sessions will become invalid.

## Deployment identity and logs

Use the environment and release fields in health responses to identify the active deployment. Vercel retains runtime/build logs; configure retention and alerting in the hosting account before launch. The repository includes a monitoring integration, but no Sentry project credentials are configured or verified from this checkout. Do not treat health logs as complete product observability.
