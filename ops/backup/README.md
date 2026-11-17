# SwiftMC encrypted PostgreSQL backups — deployment runbook

**Not installed or active just because these files are committed.** Review this with the VPS operator before enabling the timer. Keep production and staging backup credentials isolated.

## Required inputs
- A dedicated OS account `swiftmc-backup` with permission to write `/var/backups/swiftmc` and read a dedicated restricted PostgreSQL service configuration.
- `pg_dump` compatible with the PostgreSQL server, `age`, `flock`, `sha256sum`, `pg_restore` installed.
- `/etc/swiftmc/backup.env` owned by root, mode 0640, readable only by the backup group. It must define `PGSERVICE`, `BACKUP_DIR=/var/backups/swiftmc`, and `BACKUP_AGE_RECIPIENT` (age **public** recipient, not a private key). If service credentials use a separate service file, set `PGSERVICEFILE` and `PGPASSFILE` as appropriate with restricted file permissions. **Never commit credentials.**
- Ensure `pg_dump --dbname='service=swiftmc_staging'` succeeds with the backup role under least privilege. The service requires matching read grants; do not use the database superuser or pass a password on the CLI.

## Deployment and rollback
1. Take an existing trusted snapshot before making any scheduler changes.
2. Review the unit sandbox paths and the service account on the actual VPS; update paths if necessary.
3. Perform one manual encrypted backup and verify it is nonempty, then copy the encrypted archive to independently protected **offsite** storage with appropriate access control and retention.
4. On an **isolated disposable database**, decrypt with the private age identity and test `pg_restore --list`, then perform a full restore and representative application query. Never restore over production or staging.
5. Only after a successful restore test, install the unit and timer and enable the timer. Monitor failed backup runs and failed offsite replication; periodically retest restores.
6. If validation fails, disable the timer, preserve existing backups and resolve the issue before proceeding.

The code does **not** delete old backups automatically. Define and approve retention rules for backups, access, payment events and audit trails before implementing automated expiration. The private age identity must remain separate from the backups. A backup without a tested restore, offsite copy and alerting is not an operationally verified backup strategy.
