#!/bin/bash
# Replace the legacy hocbong-upgrad.com deployment with the current repo.
# Run ON THE VPS after SSH (not on Windows):
#   bash /var/www/landing-page/scripts/vps-replace-old-site.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/landing-page}"
PORT="${PORT:-3000}"
EXPECTED_BUILD_ID="2026-06-23-main"

cd "$APP_DIR"

echo "==> 1. Pull latest code"
git fetch origin
git checkout main
git pull origin main
git log -1 --oneline

echo "==> 2. Remove legacy single-file HTML from old deployment"
for legacy in \
  index.html \
  chuong-trinh.html \
  gioi-thieu-ban-be.html \
  login.html; do
  if [ -f "$APP_DIR/$legacy" ]; then
    echo "Removing legacy file: $legacy"
    rm -f "$APP_DIR/$legacy"
  fi
done

echo "==> 3. Install, build, seed program catalog"
npm install
npm run build
node scripts/seed-programs.js

echo "==> 4. Stop stale node processes and restart systemd service"
if [ -f "$APP_DIR/scripts/restart-landing-page.sh" ]; then
  bash "$APP_DIR/scripts/restart-landing-page.sh"
elif command -v systemctl >/dev/null 2>&1; then
  sudo systemctl stop landing-page || true
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 2
  sudo systemctl start landing-page
  sleep 2
  sudo systemctl is-active landing-page
else
  echo "ERROR: systemctl not found. Start node manually from $APP_DIR."
  exit 1
fi

echo "==> 5. Verify new deployment"
STORE_INFO="$(curl -s "http://127.0.0.1:${PORT}/api/store-info" || true)"
echo "store-info: $STORE_INFO"

if ! echo "$STORE_INFO" | grep -q "\"buildId\":\"${EXPECTED_BUILD_ID}\""; then
  echo "FAIL: API is not serving buildId ${EXPECTED_BUILD_ID}."
  echo "      VPS is still running old code or wrong WorkingDirectory in systemd."
  exit 1
fi

HOME_HTML="$(curl -s "http://127.0.0.1:${PORT}/" || true)"
if echo "$HOME_HTML" | grep -q "Nhận Bằng Cao Học"; then
  echo "FAIL: homepage still shows legacy hero copy."
  exit 1
fi

if ! echo "$HOME_HTML" | grep -q "Giới thiệu Học viên"; then
  echo "FAIL: homepage missing new navigation."
  exit 1
fi

echo "OK: new site is live on localhost:${PORT} (buildId ${EXPECTED_BUILD_ID})."
echo "    Public check: curl -s https://www.hocbong-upgrad.com/api/store-info"
