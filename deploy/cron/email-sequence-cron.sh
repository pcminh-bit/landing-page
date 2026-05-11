#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is missing"
  exit 1
fi

BASE_URL="${BASE_URL:-https://your-domain.com}"

curl -fsS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}/api/cron/email-sequence" >/dev/null
