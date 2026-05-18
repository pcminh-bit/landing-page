#!/bin/bash
# Chạy trên VPS (root): bash scripts/fix-product-permissions.sh
set -euo pipefail
ROOT="${1:-/var/www/landing-page}"
cd "$ROOT"

# Cho phép www-data đi vào project + đọc trang sản phẩm
chmod a+x /var/www /var/www/landing-page 2>/dev/null || true
chown -R www-data:www-data "$ROOT/san-pham" "$ROOT/public/san-pham" "$ROOT/public/downloads" 2>/dev/null || true
chmod -R a+rX "$ROOT/san-pham" "$ROOT/public/san-pham" 2>/dev/null || true

if sudo -u www-data test -r "$ROOT/san-pham/linkedin-easy-posting-machine/index.html"; then
  echo "www-data:OK"
else
  echo "www-data:DENIED — kiểm tra quyền thư mục cha (namei -l ...)"
  exit 1
fi
