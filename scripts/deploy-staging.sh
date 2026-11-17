#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="compose.staging.yaml"
ENV_FILE="deploy/staging.env"
LOCK_FILE="${STAGING_DEPLOY_LOCK_FILE:-/tmp/swiftmc-staging-deploy.lock}"
STATE_DIR="${STAGING_STATE_DIR:-./deploy/.staging-state}"
DIAG_DIR="${STAGING_DIAGNOSTICS_DIR:-./deploy/diagnostics}"
MIN_FREE_MEM_MB="${STAGING_MIN_FREE_MEM_MB:-256}"
MIN_FREE_DISK_MB="${STAGING_MIN_FREE_DISK_MB:-1024}"
MIN_SWAP_MB="${STAGING_MIN_SWAP_MB:-900}"
HEALTH_URL="${STAGING_HEALTH_URL:-http://127.0.0.1:3100/api/health/ready}"
HEALTH_ATTEMPTS="${STAGING_HEALTH_ATTEMPTS:-30}"
HEALTH_INTERVAL_SEC="${STAGING_HEALTH_INTERVAL_SEC:-2}"

log() { printf '[deploy-staging] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

usage() {
  cat >&2 <<'EOF'
Usage: STAGING_IMAGE_TAG=<immutable-tag> scripts/deploy-staging.sh [--preflight-only]
Deploys a prebuilt immutable staging image (no local build). Requires deploy/staging.env,
deploy/certs/origin-ca.pem, Docker Compose, and GHCR access for private images.
EOF
}

preflight_only=false
if [ "${1:-}" = "--preflight-only" ]; then preflight_only=true; shift; fi
[ "$#" -eq 0 ] || { usage; exit 2; }

[ -f "$ENV_FILE" ] || die "Create private $ENV_FILE first."
[ "$(stat -c '%a' "$ENV_FILE")" = 600 ] || die "$ENV_FILE must have mode 600."
[ -r deploy/certs/origin-ca.pem ] || die "Install trusted Cloudflare Origin CA root at deploy/certs/origin-ca.pem (mode 444)."
command -v docker >/dev/null 2>&1 || die "docker is required."
docker compose version >/dev/null 2>&1 || die "docker compose v2 is required."

: "${STAGING_IMAGE_TAG:?Set STAGING_IMAGE_TAG to an immutable tag (e.g. staging-<sha>)}"
case "$STAGING_IMAGE_TAG" in
  local|latest|*' '*) die "STAGING_IMAGE_TAG must be an immutable, non-floating tag." ;;
  staging-*) ;; 
  *) log "WARNING: STAGING_IMAGE_TAG does not start with 'staging-'; ensure it is immutable." ;;
esac

mkdir -p "$STATE_DIR" "$DIAG_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || die "Another staging deploy is in progress (lock: $LOCK_FILE)."
printf '%s\n' "$$" >&9

timestamp() { date -u +%Y%m%dT%H%M%SZ; }
TS="$(timestamp)"
DIAG_FILE="$DIAG_DIR/deploy-$TS.log"

capture_diagnostics() {
  local label="${1:-snapshot}"
  {
    echo "===== $label $(date -Is) ====="
    echo "-- host --"
    uptime || true
    free -h || true
    swapon --show || true
    df -h / . || true
    echo "-- docker compose ps --"
    docker compose -f "$COMPOSE_FILE" ps || true
    echo "-- backend health --"
    curl -fsS --max-time 5 "$HEALTH_URL" || echo "health=unreachable"
    echo "-- backend logs (tail 120) --"
    docker compose -f "$COMPOSE_FILE" logs --no-color --tail=120 backend 2>&1 || true
    echo "-- docker stats (no-stream) --"
    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}' 2>&1 || true
  } >>"$DIAG_FILE" 2>&1
}

resource_preflight() {
  log "Running resource preflight checks..."
  local mem_avail_kb disk_avail_kb swap_kb
  mem_avail_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  disk_avail_kb=$(df -Pk . | awk 'NR==2 {print $4}')
  swap_kb=$(awk '/SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  local mem_avail_mb=$((mem_avail_kb / 1024))
  local disk_avail_mb=$((disk_avail_kb / 1024))
  local swap_mb=$((swap_kb / 1024))

  [ "$mem_avail_mb" -ge "$MIN_FREE_MEM_MB" ] || die "Insufficient available memory: ${mem_avail_mb}MB < ${MIN_FREE_MEM_MB}MB."
  [ "$disk_avail_mb" -ge "$MIN_FREE_DISK_MB" ] || die "Insufficient free disk: ${disk_avail_mb}MB < ${MIN_FREE_DISK_MB}MB."
  # Preserve existing 1 GB swap: require it to be present/configured.
  [ "$swap_mb" -ge "$MIN_SWAP_MB" ] || die "Required swap missing or too small: ${swap_mb}MB < ${MIN_SWAP_MB}MB (existing 1 GB swap must be preserved)."

  if ! docker info >/dev/null 2>&1; then die "Docker daemon unavailable."; fi
  docker compose -f "$COMPOSE_FILE" config --quiet >/dev/null || die "Compose config invalid."
  log "Preflight OK (mem_avail=${mem_avail_mb}MB disk_free=${disk_avail_mb}MB swap=${swap_mb}MB tag=${STAGING_IMAGE_TAG})."
}

current_backend_image() {
  docker inspect --format '{{.Config.Image}}' "$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null | head -n1)" 2>/dev/null || true
}

wait_healthy() {
  local i
  for i in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$HEALTH_INTERVAL_SEC"
  done
  return 1
}

rollback() {
  local previous_tag="${1:-}"
  local previous_image="${2:-}"
  [ -n "$previous_tag" ] || { log "No previous release tag recorded; cannot auto-rollback."; return 1; }
  log "Rolling back backend to previous immutable tag: $previous_tag"
  export STAGING_IMAGE_TAG="$previous_tag"
  if [ -n "$previous_image" ]; then export STAGING_IMAGE="$previous_image"; fi
  if docker compose -f "$COMPOSE_FILE" up -d --no-build --pull never --no-deps backend; then
    if wait_healthy; then
      log "Rollback succeeded (tag=$previous_tag)."
      printf '%s\n' "$previous_tag" > "$STATE_DIR/last-known-good-tag"
      return 0
    fi
  fi
  log "Rollback failed; manual intervention required."
  return 1
}

resource_preflight
if [ "$preflight_only" = true ]; then
  log "Preflight-only mode complete."
  exit 0
fi

PREVIOUS_TAG=""
PREVIOUS_IMAGE=""
if [ -f "$STATE_DIR/current-tag" ]; then PREVIOUS_TAG="$(tr -d '\r\n' < "$STATE_DIR/current-tag")"; fi
if [ -f "$STATE_DIR/current-image" ]; then PREVIOUS_IMAGE="$(tr -d '\r\n' < "$STATE_DIR/current-image")"; fi
RUNNING_IMAGE="$(current_backend_image)"
if [ -z "$PREVIOUS_IMAGE" ] && [ -n "$RUNNING_IMAGE" ]; then PREVIOUS_IMAGE="$RUNNING_IMAGE"; fi

log "Deploying immutable staging tag=$STAGING_IMAGE_TAG (previous=${PREVIOUS_TAG:-none})"
capture_diagnostics "pre-deploy"

log "Pulling prebuilt images (no local build)..."
docker compose -f "$COMPOSE_FILE" pull backend migrate

log "Running migrations with immutable migrate image..."
if ! docker compose -f "$COMPOSE_FILE" run --rm --pull never --no-deps migrate; then
  capture_diagnostics "migrate-failed"
  die "Migration failed; backend not restarted. Inspect $DIAG_FILE and database state before retry."
fi

log "Starting backend..."
if ! docker compose -f "$COMPOSE_FILE" up -d --no-build --pull never --no-deps --wait backend; then
  capture_diagnostics "up-failed"
  rollback "$PREVIOUS_TAG" "$PREVIOUS_IMAGE" || true
  capture_diagnostics "post-rollback-attempt"
  die "Backend failed to start/become healthy. Diagnostics: $DIAG_FILE"
fi

log "Verifying health endpoint..."
if ! wait_healthy; then
  capture_diagnostics "health-verification-failed"
  rollback "$PREVIOUS_TAG" "$PREVIOUS_IMAGE" || true
  capture_diagnostics "post-rollback-attempt"
  die "Health verification failed after deploy. Diagnostics: $DIAG_FILE"
fi

printf '%s\n' "$STAGING_IMAGE_TAG" > "$STATE_DIR/current-tag"
printf '%s\n' "$STAGING_IMAGE_TAG" > "$STATE_DIR/last-known-good-tag"
printf '%s\n' "${STAGING_IMAGE:-ghcr.io/brielmarca/swiftmc-staging:${STAGING_IMAGE_TAG}}" > "$STATE_DIR/current-image"
capture_diagnostics "post-deploy-success"
log "Deploy complete (tag=$STAGING_IMAGE_TAG). Diagnostics: $DIAG_FILE"
