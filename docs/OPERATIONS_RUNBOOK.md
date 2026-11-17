# Operations runbook

This runbook covers production database recovery and release diagnosis for BuildLoop. Production provider-backup configuration and a full isolated backup restore drill remain external launch requirements; the synthetic Neon Free PITR check below does not mean backups are enabled.

## Service health and operational smoke

Run these checks against the exact protected deployment URL and release SHA under review. Do not put credentials in a URL or terminal transcript.

1. Confirm the hosting dashboard shows the expected deployment environment, commit SHA, protection policy, and environment-variable presence. Never print variable values.
2. Request `GET /api/health/live`; expect HTTP 200 and `ok`.
3. Request `GET /api/health/ready`; expect HTTP 200 and `ready`, database `ok`, migration journal `current`, and required Production auth/email/Builder/monitoring checks `configured`. Configuration presence is not proof the provider accepted credentials.
4. Use the approved smoke account to sign in, read its own Mission progress and Studio project list, and open a known published app. Avoid changing real learner data.
5. In the isolated Preview environment, exercise invitation delivery, Builder generation only with separately authorized spend, publishing and rollback, and then remove the synthetic account and records. Verify cleanup in the database.
6. Check Vercel function/build logs and Sentry for request IDs, route/event names, release SHA, and error classes. Logs must not include passwords, cookies, tokens, API keys, action URLs, private project content, or raw request bodies.
7. Record time, deployment SHA, HTTP outcomes, readiness check names/status, and any error IDs. Do not record user content or secret values.

If liveness fails, inspect deployment/build health first. If readiness reports database failure, follow the database diagnosis below. If migration status is behind, stop writes/releases and apply only the reviewed migration procedure to the intended environment. If auth, email, Builder, or monitoring is unavailable, do not interpret readiness as launch approval.

## Database connectivity diagnosis

1. Check the provider status page and project/branch state, then confirm the runtime secret is present in the correct environment without displaying it.
2. Confirm the URL targets the intended environment and uses TLS; runtime traffic may use the supported pooler, while migrations should use the direct/unpooled connection.
3. Inspect sanitized connection and pool errors by timestamp/request ID. Do not retry migrations or rotate credentials until the target database is confirmed.
4. Use `/api/health/ready` and the database migration journal check to distinguish network/authentication failure from schema drift.
5. Escalate persistent pool exhaustion or provider failures to the database operator. Do not increase plan limits or add paid capacity without separate approval.

## Secret rotation

Rotate a secret immediately if exposure is suspected. Otherwise rotate during a reviewed release window.

1. Identify the exact secret and environments that consume it; generate a unique replacement in the approved secret manager. Never copy it into Git, tickets, chat, or logs.
2. For database credentials, create a least-privilege replacement credential first where supported, update the target environment, and deploy/restart. Verify readiness and a controlled sign-in/read operation before revoking the old credential.
3. For `BETTER_AUTH_SECRET`, plan a session invalidation: replace the key, deploy, then require affected users to sign in again. Verify signup/sign-in/session/logout and reset behavior with a synthetic account.
4. For Resend/OpenAI/Sentry keys, update server-only environment values, redeploy Preview, verify a controlled provider check (never send an unauthorized real email or billable model request), and revoke the old key.
5. Confirm old credentials no longer work, remove temporary values from local secret stores, and record rotation time, affected service, deployment SHA, and verification outcome without recording values.

If safe overlap or provider verification is unavailable, stop before revoking the working credential and schedule the rotation with the owning operator.

## Failed deployment recovery

1. Stop promotion and preserve the failed deployment ID, commit SHA, build logs, and request IDs.
2. If the deployment has not received traffic, leave the last known-good deployment serving users. Do not weaken access protection to debug it.
3. For an application-only regression, roll back to the last compatible deployment using the host's documented rollback control. Confirm the expected environment and protection before acting.
4. If schema changes were applied, confirm backward compatibility before code rollback. Do not reverse a migration or restore a database just to undo an application release.
5. Run liveness/readiness and the approved smoke checks on the rollback target. Record results and open a corrective change before retrying.

## Monitoring and incident response

Use the hosting runtime logs and configured Sentry/error service as complementary signals. The application emits JSON event names, release/environment metadata, and limited diagnostic fields; provider DSN presence alone does not prove event delivery. A missing monitoring event is a release blocker until the test event is received and alert routing is confirmed.

BuildLoop's `X-Request-Id` is included inside the JSON log message. Vercel's CLI `requestId:` filter matches Vercel's separate platform request ID, so search the application event and request ID as text instead, for example `vercel logs runtime --project <project-id> --deployment <deployment-id> --since 30m --query 'platform.request_rejected AND <app-request-id>' --scope <team-slug> --non-interactive`. On the current Hobby project, the CLI rejected a one-hour lookback as outside runtime-log retention; treat these logs as short-term diagnosis, not durable monitoring or alerting.

For an incident, assign an incident owner, pause releases and risky data mutations, preserve timestamps/deployment identifiers/request IDs, classify impact, and communicate through the approved support channel. Do not include secrets or learner content in incident notes. Choose application rollback for code defects; use the isolated restore procedure for data loss. Record decisions, user impact, recovery evidence, and follow-up owners.

## Current Neon Free Preview limits

Neon's current plan documentation lists the Free plan at $0/month with a maximum six-hour instant-restore history window capped at 1 GB of changes, one manual snapshot, and no scheduled backup schedules. Snapshot storage is listed at $0.09/GB-month. Do not create a manual snapshot under Goal 14's $0 limit. On 2026-11-16 the signed-in Console showed `buildloop-staging` on Free, a six-hour history setting, one branch, and about 33.23 MB storage; the local database connection was confirmed to target the same project. Recheck live settings before a recovery operation. Free has no uptime SLA. See [Neon plans](https://neon.com/docs/introduction/plans) and [history window](https://neon.com/docs/postgres/backup-restore/history-window).

The six-hour window is the maximum plan capability, not proof that a particular recovery point is available. Point-in-time restore applies to root branches and overwrites every database and all schema on the branch, temporarily interrupting its connections; Neon keeps a pre-restore branch for rollback. Never use an in-place root restore for a staging drill. A verified RPO/RTO is not established for the current Preview database, and Free does not meet the production seven-day retention gate.

### No-cost synthetic Preview recovery check

This procedure was completed once on 2026-11-16 against the verified Free project. A synthetic marker inserted on `main` at 07:50:50 UTC was recovered exactly once on a temporary child branch created at 07:50:56 UTC. The branch was set to auto-delete after one hour and manually deleted after verification; the Console returned to one branch. The temporary probe table was dropped from `main` and verified absent. No snapshot or in-place restore was used. This confirms one synthetic point-in-time branch recovery within the observed six-hour history setting; it does not establish automated backups, RPO/RTO, or Production recoverability.

1. Record the project and root-branch identifiers privately; never record connection values.
2. Create a temporary table with a unique Goal 14 marker in the Preview root branch, insert one synthetic row, and record the database timestamp in UTC.
3. Delete the marker row after recording the timestamp.
4. Use Neon's point-in-time **branch creation** to create a temporary isolated branch from the root at that timestamp. Do not restore the root in place.
5. Connect to the temporary branch and run a read-only query confirming the marker exists. Record only pass/fail, timestamp, duration, and table/row counts.
6. Delete the temporary branch and compute, then remove the marker/table from the Preview root. Verify no marker or branch remains and the project is within its Free quotas.

If the console does not offer historical branch creation on the Free project, stop and record the capability as unavailable; do not upgrade or substitute a snapshot. A successful branch check verifies recovery-point branching only, not an in-place restore or a production backup schedule.

## Backup policy to configure

- Use the managed PostgreSQL provider's automated backups with at least seven days of retention. Enable point-in-time recovery (PITR) when the selected plan supports it.
- Keep Preview and Production in separate databases. Restrict backup and restore permissions to the operators who need them.
- Record the provider, database identifier, backup retention, PITR window, and the operator responsible for restore access in the private operations record. Never put database URLs or credentials in that record.
- Before launch, agree on recovery time and recovery point objectives with the operator. The current repository does not establish or measure either objective.
- Treat backups as sensitive production data. Preserve provider encryption and access controls; do not download a production dump to a developer workstation for a routine restore drill.

## Isolated restore drill

Run this before launch and periodically after launch, following the selected provider's current backup documentation:

1. Choose a recent production backup or PITR timestamp. Record the source database identifier and backup timestamp in the private operations record.
2. Restore it as a **new isolated database** in the same region or an approved recovery region. Do not restore over Production. Keep network access restricted and do not configure BuildLoop to serve the restored copy publicly.
3. Use a separate, temporary operator credential. Keep the restored database's connection URL out of shell transcripts, logs, tickets, screenshots, and source control.
4. Confirm the restore operation completed and that the database accepts a TLS connection. Verify the migration journal and expected core tables are present. Use read-only queries against the restored copy to confirm representative account, application, version, Mission-progress, and Studio-learning records exist; avoid copying learner content into the evidence report.
5. Prefer a temporary local deployment pointed at the restored copy. Use a Preview deployment only if access is restricted and all production integrations are disabled. Run `/api/health/ready`, sign in with a designated test account if one exists in the backup, and verify account/app/learner-state access without inspecting learner content. Do not send invitations or publish during this check.
6. Record elapsed restore time, backup age, checks performed, failures, and remediation without recording personal data or secrets. Compare the observed times with the operator-approved recovery objectives.
7. Delete the isolated restored database and temporary credentials using the provider's supported procedure. Confirm deletion in the provider console.

If the drill fails, keep Production unchanged, retain the provider's failure evidence without secrets, and repair the backup configuration before launch.

## Incident recovery

1. Declare an incident and stop releases or manual data changes that could make recovery harder. Preserve deployment identifiers and provider logs.
2. Determine whether the problem is an application release or database corruption. For an application-only failure, roll back Vercel traffic to the last compatible deployment; do not restore the database just to roll back code.
3. For data loss or corruption, identify the desired recovery timestamp with the operator. Restore to a new isolated database first and validate it using the drill above.
4. Plan the production cutover with the operator. Account for writes made after the chosen recovery point; PITR recovery can discard those writes. Announce any required maintenance window, stop application writes during the final cutover, and retain the original database until the recovered service is verified.
5. Update only the Production `DATABASE_URL` to the recovered database through the hosting provider's secret manager. Restart/promote the application as required by the host. Run liveness and readiness checks, authenticate, and verify app access and learner-state reads before reopening writes.
6. Keep the original database isolated and available until the incident owner approves its retirement. Record the selected backup/PITR point, data-loss window, deployment SHA, checks, and operator decision without personal data or secrets.

Never run the migration command as a substitute for restoring data. Migrations apply forward schema changes; they do not reconstruct lost records. If a restored backup predates a schema change, verify the backup's migration journal and use the documented explicit migration release process only after confirming the application/schema compatibility plan.

## Logical backup fallback

Use this only when provider-native backups are unavailable or a logical export is specifically required. Prefer the provider's direct TLS endpoint and a dedicated backup credential with least privilege. Use a protected `pgpass` file or the provider's approved secret mechanism; avoid putting passwords in command-line arguments or shell history. Store encrypted backups in access-controlled storage with retention and restore monitoring.

Example commands (replace the placeholders and use a newly created isolated target database for restore):

```sh
PGSSLMODE=require pg_dump --format=custom --no-owner --no-acl --host="$PGHOST" --username="$PGUSER" --dbname="$PGDATABASE" --file="buildloop-backup.dump"
pg_restore --list "buildloop-backup.dump"
PGSSLMODE=require pg_restore --exit-on-error --no-owner --no-acl --host="$RESTORE_PGHOST" --username="$RESTORE_PGUSER" --dbname="$RESTORE_PGDATABASE" "buildloop-backup.dump"
```

After a logical restore, run the isolated restore checks above. A dump file's existence or a successful `pg_restore` exit alone does not prove the service can recover.
