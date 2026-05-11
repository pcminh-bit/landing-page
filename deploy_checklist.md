# Deploy Checklist (VPS Linux)

Ngay kiem tra: 2026-05-11
Cap nhat moi nhat:
- Da chuan hoa `.gitignore`.
- Da bo tracking cho `.env`, `resend_config.txt`, `.env.local`, va tat ca `desktop.ini`.
- Da them file mau deploy: `deploy/systemd/landing-page.service`, `deploy/nginx/landing-page.conf`, `deploy/cron/email-sequence-cron.sh`.

## 1) Du an dang dung ngon ngu/framework gi?

- **Runtime chinh:** Node.js (CommonJS), server thu cong bang `node:http` trong `server.js`.
- **Frontend:** HTML/CSS/JS thuan (khong dung React/Vue/Next).
- **Backend/API:** Tu viet route trong `server.js` (`/api/...`).
- **Database:**
  - Mac dinh: SQLite file `brain.db` qua `node:sqlite`.
  - Tuy chon: Neon Postgres qua `@neondatabase/serverless` khi co `DATABASE_URL`.
- **Email:** Resend REST API (`https://api.resend.com/emails`) trong `resend-mail.js`.
- **Vercel-specific config:** `vercel.json` (khong bat buoc cho VPS Linux).

## 2) Co file nao can tao them de deploy duoc khong?

### Bat buoc de chay tren VPS

- **Khong bat buoc tao them file moi** neu ban chay truc tiep:
  - `npm install`
  - `node server.js`

### Rat nen tao (de van hanh on dinh)

- `/.env.production` (hoac file env rieng tren server) de tach bien moi truong production.
- `/deploy/systemd/landing-page.service` (hoac PM2 ecosystem file) de auto-restart.
- `/deploy/nginx/landing-page.conf` de reverse proxy 80/443 -> `PORT` app.
- Tu chon: `/deploy/backup.sh` de backup `brain.db` neu dung SQLite.

## 3) Co thong tin bi mat dang lo trong code khong?

## CANH BAO MUC NGHIEM TRONG (Critical)

### Secret dang nam trong file da track git

- `/.env` dang duoc track trong git (kiem tra `git ls-files` co hien file nay), va chua:
  - `SEPAY_WEBHOOK_SECRET=...`
  - `RESEND_API_KEY=...`
  - `RESEND_FROM_EMAIL=...`
  - `RESEND_TO_EMAIL=...`
- `/resend_config.txt` dang duoc track git va chua API key Resend (`re_...`).
- `/vercel.json` duoc track (khong phai secret, an toan).

### Secret dang lo trong local file (co the chua track)

- `/.env.local` chua `VERCEL_OIDC_TOKEN=...` (token rat nhay cam).
  - Hien tai chua thay track trong git, nhung van la secret local can bao ve.

### Khuyen nghi xu ly ngay

1. Rotate toan bo key/token da lo:
   - Resend API key
   - Sepay webhook secret
   - Vercel OIDC token
2. Xoa secret khoi repo va history (neu da push):
   - bo file `.env`, `resend_config.txt` khoi git tracking
   - neu da len remote, can rewrite history hoac tao repo moi neu can muc do sach cao
3. Sua `.gitignore` cho dung:
   - `.env`
   - `.env.*`
   - `resend_config.txt`
   - `node_modules/`
4. Chi de secret trong env tren VPS (khong commit file secret).

## 4) Danh sach day du can chuan bi truoc khi deploy

## A. Runtime va OS

- [ ] VPS Linux da cai Node.js **>=22**.
- [ ] Kiem tra lai: project dang dung `node:sqlite` (khong phu hop Node 18).  
      `package.json` hien de `node >=18` la **khong khop thuc te** voi code.
- [ ] Cai PM2 hoac systemd.
- [ ] Mo firewall cho 80/443 (va port app noi bo, vi du 3000).

## B. Source code va build

- [ ] `git pull` branch `main` moi nhat.
- [ ] `npm install`.
- [ ] Chay build asset admin: `npm run build` (copy `admin.js/admin.css` vao `public/`).
- [ ] Smoke test local server tren VPS: `PORT=3000 node server.js`.

## C. Environment variables (production)

- [ ] `PORT` (vi du `3000`).
- [ ] `RESEND_API_KEY`.
- [ ] `RESEND_FROM_EMAIL` (email/domain da verify tren Resend).
- [ ] `RESEND_TO_EMAIL` (mail nhan thong bao admin).
- [ ] `PUBLIC_SITE_URL` (vi du `https://hocbong-upgrad.com`).
- [ ] `CRON_SECRET` (bat buoc neu goi cron endpoint an toan).
- [ ] `DATABASE_URL` (khuyen nghi rat cao de dung Postgres thay vi SQLite local).
- [ ] (Neu dung Sepay) `SEPAY_WEBHOOK_SECRET`.

## D. Database strategy

- [ ] Quyet dinh 1 trong 2:
  - **Postgres (khuyen nghi):** set `DATABASE_URL`, bo qua rui ro file SQLite.
  - **SQLite:** dam bao persistence + backup cho `brain.db`.
- [ ] Neu dung SQLite, dat quyen ghi thu muc chua `brain.db`.
- [ ] Backup `brain.db` truoc khi release.

## E. Reverse proxy + TLS

- [ ] Cau hinh Nginx proxy `domain -> localhost:PORT`.
- [ ] Cap SSL bang Let's Encrypt.
- [ ] Bat redirect HTTP -> HTTPS.

## F. Job/Cron

- [ ] Tren VPS khong co Vercel cron, can tu tao cron Linux goi:
  - `GET /api/cron/email-sequence`
  - kem `Authorization: Bearer <CRON_SECRET>` hoac query `?secret=...`.
- [ ] Dat tan suat phu hop (dang tren Vercel la 09:00 UTC hang ngay).

## G. Monitoring/ops

- [ ] Log app (PM2/systemd journal) va rotate log.
- [ ] Healthcheck endpoint (toi thieu GET `/` va 1 API co ban).
- [ ] Alert khi loi gui mail Resend (HTTP >= 400).

## H. Security hardening nhanh

- [ ] Khong deploy file secret vao repo.
- [ ] Rotate key da lo truoc khi production.
- [ ] Gioi han truy cap `/admin` (IP allowlist, basic auth, hoac login layer).
- [ ] Dat webhook secret va verify chu ky/noi dung webhook khi can.

---

## Lenh deploy goi y (VPS Linux)

```bash
git pull origin main
npm install
npm run build
export PORT=3000
export RESEND_API_KEY=...
export RESEND_FROM_EMAIL=...
export RESEND_TO_EMAIL=...
export PUBLIC_SITE_URL=https://your-domain
export CRON_SECRET=...
# export DATABASE_URL=...   # khuyen nghi
node server.js
```

Neu can van hanh ben vung, chay bang PM2/systemd thay vi `node server.js` truc tiep.
