#!/bin/bash
# Run on VPS to find why the public site still shows old HTML.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/landing-page}"
PORT="${PORT:-3000}"

echo "========== 1. Git (expected buildId in server.js: 2026-06-23-main) =========="
cd "$APP_DIR"
git log -1 --oneline
grep -n "SERVER_BUILD_ID" server.js | head -1 || true
test -f public/index.html && grep -o "Giới thiệu Học viên" public/index.html | head -1 || echo "MISSING: Giới thiệu Học viên in public/index.html"
test -f index.html && echo "WARN: old root index.html still exists" || echo "OK: no root index.html"

echo ""
echo "========== 2. What listens on port ${PORT}? =========="
ss -tlnp | grep ":${PORT} " || echo "Nothing on port ${PORT}"

echo ""
echo "========== 3. systemd landing-page =========="
systemctl status landing-page --no-pager -l || true

echo ""
echo "========== 4. curl localhost (must show buildId 2026-06-23-main) =========="
curl -s "http://127.0.0.1:${PORT}/api/store-info" || echo "(curl failed)"
echo ""
curl -s "http://127.0.0.1:${PORT}/" | head -c 400 | tr '\n' ' '
echo ""
echo ""

echo ""
echo "========== 5. Nginx proxy for hocbong-upgrad =========="
grep -r "server_name\|proxy_pass\|root " /etc/nginx/sites-enabled/ 2>/dev/null | grep -i "hocbong\|landing\|3000" || \
  grep -r "proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null || true

echo ""
echo "========== 6. Recent service logs =========="
journalctl -u landing-page -n 20 --no-pager 2>/dev/null || true
