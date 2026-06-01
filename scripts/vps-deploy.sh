#!/bin/bash
# Deploy latest main on VPS (run ON THE SERVER after SSH, not on Windows).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/landing-page}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"
echo "==> Directory: $(pwd)"
echo "==> Remote:"
git remote -v
echo "==> Before pull (HEAD):"
git log -1 --oneline

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> After pull (HEAD):"
git log -1 --oneline

npm install
npm run build

echo "==> Restarting landing-page..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart landing-page
  sleep 2
  sudo systemctl is-active landing-page
else
  echo "WARN: systemctl not found — restart node manually."
fi

PORT="${PORT:-3000}"
echo "==> Verify /api/store-info (expect buildId: 2026-05-29-main):"
curl -s "http://127.0.0.1:${PORT}/api/store-info" || true
echo
echo "==> Verify homepage has new nav (Giới thiệu Học viên):"
if curl -s "http://127.0.0.1:${PORT}/" | grep -q "Giới thiệu Học viên"; then
  echo "OK: new homepage detected."
else
  echo "FAIL: still serving old HTML — check WorkingDirectory in systemd and port ${PORT}."
  exit 1
fi
