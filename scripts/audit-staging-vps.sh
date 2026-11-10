#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'Read-only staging infrastructure audit (no environment/secret dump)'
uname -sr
ss -ltn '( sport = :5432 or sport = :3100 )'
if command -v docker >/dev/null; then
  docker version --format '{{.Server.Version}}'
  docker compose version
  docker ps --format '{{.Names}} {{.Image}} {{.Status}} {{.Ports}}'
fi
if command -v psql >/dev/null; then
  # Requires a private pg_service.conf/.pgpass entry, never a command-line password.
  PGSERVICE=swiftmc_staging psql -X -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, current_setting('server_version'), current_setting('listen_addresses');"
fi
