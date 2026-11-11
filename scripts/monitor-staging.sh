#!/usr/bin/env bash
set -euo pipefail

# Lightweight resource/health monitor with persistent diagnostics.
# Intended for cron/systemd timer on the VPS. Read-only: does not restart services.

COMPOSE_FILE="${COMPOSE_FILE:-compose.staging.yaml}"
HEALTH_URL="${STAGING_HEALTH_URL:-http://127.0.0.1:3100/api/health/ready}"
DIAG_DIR="${STAGING_DIAGNOSTICS_DIR:-./deploy/diagnostics}"
LOG_FILE="$DIAG_DIR/monitor.log"
MAX_LOG_BYTES="${STAGING_MONITOR_MAX_LOG_BYTES:-5242880}"

mkdir -p "$DIAG_DIR"
timestamp() { date -Is; }

rotate_if_large() {
  [ -f "$LOG_FILE" ] || return 0
  local size
  size=$(stat -c '%s' "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$size" -gt "$MAX_LOG_BYTES" ]; then
    mv "$LOG_FILE" "$LOG_FILE.$(date -u +%Y%m%dT%H%M%SZ).old"
  fi
}

health_code="000"
health_body="unreachable"
if command -v curl >/dev/null 2>&1; then
  health_body=$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)
  if [ -n "$health_body" ]; then health_code="200"; else health_body="unreachable"; fi
fi

mem_avail_mb=$(awk '/MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)
swap_mb=$(awk '/SwapTotal:/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)
disk_avail_mb=$(df -Pm . | awk 'NR==2 {print $4}' 2>/dev/null || echo 0)
load=$(awk '{print $1","$2","$3}' /proc/loadavg 2>/dev/null || echo "na,na,na")
backend_status=$(docker compose -f "$COMPOSE_FILE" ps --status running --services 2>/dev/null | grep -xc backend || echo 0)

rotate_if_large
{
  printf '%s health=%s backend_running=%s mem_avail_mb=%s swap_mb=%s disk_avail_mb=%s load=%s\n' \
    "$(timestamp)" "$health_code" "$backend_status" "$mem_avail_mb" "$swap_mb" "$disk_avail_mb" "$load"
  if [ "$health_code" != "200" ] || [ "$backend_status" != "1" ]; then
    echo "  detail: $health_body"
    docker compose -f "$COMPOSE_FILE" ps 2>&1 | sed 's/^/  ps: /' || true
  fi
} >> "$LOG_FILE"

# Exit non-zero on unhealthy state so schedulers can alert if desired.
if [ "$health_code" != "200" ] || [ "$backend_status" != "1" ]; then exit 1; fi
