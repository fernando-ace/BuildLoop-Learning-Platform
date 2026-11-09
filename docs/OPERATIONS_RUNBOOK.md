# Operations runbook

This runbook covers production database recovery and release diagnosis for BuildLoop. Provider-specific backup configuration and a completed restore drill are external launch requirements; this document does not claim that backups are enabled.

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
