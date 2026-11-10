#!/usr/bin/env bash
set -euo pipefail
test -f deploy/staging.env || { printf '%s\n' 'Create private deploy/staging.env first.' >&2; exit 1; }
test "$(stat -c '%a' deploy/staging.env)" = 600 || { printf '%s\n' 'deploy/staging.env must have mode 600.' >&2; exit 1; }
test -r deploy/certs/origin-ca.pem || { printf '%s\n' 'Install trusted Cloudflare Origin CA root at deploy/certs/origin-ca.pem (mode 444).' >&2; exit 1; }
docker compose -f compose.staging.yaml config --quiet
docker compose -f compose.staging.yaml build backend migrate
docker compose -f compose.staging.yaml run --rm migrate
docker compose -f compose.staging.yaml up -d --no-deps --wait backend
curl --fail --silent --show-error http://127.0.0.1:3100/api/health/ready
