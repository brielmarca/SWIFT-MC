#!/usr/bin/env bash
# Encrypted PostgreSQL backup. No automatic installation or scheduling.
set -Eeuo pipefail
umask 077
: "${PGSERVICE:?Set PGSERVICE to a configured PostgreSQL service}"
: "${BACKUP_DIR:?Set BACKUP_DIR to a private absolute backup directory}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to an age public recipient}"
[[ "$BACKUP_DIR" == /var/backups/swiftmc || "$BACKUP_DIR" == /var/backups/swiftmc/* ]] || { echo "BACKUP_DIR must be under /var/backups/swiftmc" >&2; exit 2; }
[[ ! -L "$BACKUP_DIR" ]] || { echo "BACKUP_DIR may not be a symlink" >&2; exit 2; }
[[ "$PGSERVICE" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "Invalid PGSERVICE" >&2; exit 2; }
for cmd in pg_dump pg_restore age sha256sum mktemp flock; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 2; }; done
mkdir -p -- "$BACKUP_DIR"
chmod 0700 -- "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo "Backup already running" >&2; exit 1; }
datepart="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$BACKUP_DIR/${PGSERVICE}-${datepart}.dump.age"
tmp="$(mktemp "$BACKUP_DIR/.new-XXXXXXXX.dump.age")"
trap 'rm -f -- "$tmp"' EXIT
# pg_dump exits nonzero on DB errors; pipefail avoids keeping partial encrypted dumps.
pg_dump --dbname="service=$PGSERVICE" --format=custom --no-owner --no-acl \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$tmp"
[[ -s "$tmp" ]] || { echo "Empty backup output" >&2; exit 1; }
chmod 0600 "$tmp"
mv -n -- "$tmp" "$archive"
sha256sum -- "$archive" > "$archive.sha256"
chmod 0600 -- "$archive.sha256"
echo "Encrypted backup created: $(basename "$archive")"
# No automatic deletion: retention and off-site replication require an approved policy.
# Restoration must be tested separately using the private age identity and pg_restore.
