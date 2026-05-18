#!/bin/bash
# Dừng process cũ trên PORT (thường do chạy tay node server.js bằng root), rồi start systemd.
set -euo pipefail
PORT="${PORT:-3000}"
echo "Stopping landing-page service..."
systemctl stop landing-page || true
echo "Killing anything on port ${PORT}..."
fuser -k "${PORT}/tcp" 2>/dev/null || true
sleep 2
if ss -tlnp | grep -q ":${PORT} "; then
  echo "WARN: port ${PORT} still in use:"
  ss -tlnp | grep ":${PORT} " || true
  exit 1
fi
systemctl start landing-page
sleep 2
systemctl is-active landing-page
echo "Listener:"
ss -tlnp | grep ":${PORT} " || true
echo "Health:"
curl -s "http://127.0.0.1:${PORT}/api/digital-health" || true
echo
