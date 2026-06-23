#!/bin/bash
# Deploy latest main on VPS (run ON THE SERVER after SSH, not on Windows).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/landing-page}"
BRANCH="${BRANCH:-main}"

EXPECTED_BUILD_ID="2026-06-23-main"

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
node scripts/seed-programs.js

echo "==> Remove legacy root HTML from old deployment (if any)"
for legacy in index.html chuong-trinh.html gioi-thieu-ban-be.html login.html admin.html payment.html; do
  if [ -f "$APP_DIR/$legacy" ]; then
    echo "Removing legacy file: $legacy"
    rm -f "$APP_DIR/$legacy"
  fi
done

echo "==> Restarting landing-page (kill stale node on port ${PORT:-3000})..."
if [ -f "$APP_DIR/scripts/restart-landing-page.sh" ]; then
  bash "$APP_DIR/scripts/restart-landing-page.sh"
elif command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart landing-page
  sleep 2
  sudo systemctl is-active landing-page
else
  echo "WARN: systemctl not found — restart node manually."
fi

PORT="${PORT:-3000}"
echo "==> Verify /api/store-info (expect buildId: ${EXPECTED_BUILD_ID}):"
STORE_INFO="$(curl -s "http://127.0.0.1:${PORT}/api/store-info" || true)"
echo "$STORE_INFO"
if ! echo "$STORE_INFO" | grep -q "\"buildId\":\"${EXPECTED_BUILD_ID}\""; then
  echo "FAIL: wrong build on port ${PORT}. Run: bash scripts/vps-replace-old-site.sh"
  exit 1
fi
echo
echo "==> Verify homepage has new nav (Giới thiệu Học viên):"
if curl -s "http://127.0.0.1:${PORT}/" | grep -q "Giới thiệu Học viên"; then
  echo "OK: new homepage detected."
else
  echo "FAIL: still serving old HTML — check nginx proxy_pass and systemd WorkingDirectory."
  exit 1
fi

if curl -s "http://127.0.0.1:${PORT}/" | grep -q "Nhận Bằng Cao Học"; then
  echo "FAIL: legacy hero still present."
  exit 1
fi
