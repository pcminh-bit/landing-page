# hocbong-upgrad landing

Landing page + admin + API built with Node.js (`server.js`) and static HTML/CSS/JS.

## Stack

- Node.js HTTP server (CommonJS)
- SQLite (`brain.db`) by default via `node:sqlite`
- Optional Postgres (`DATABASE_URL`) via `@neondatabase/serverless`
- Email sending via Resend REST API

## Local run

1. Copy sample env:
   - `cp .env.example .env`
2. Install deps:
   - `npm install`
3. Build admin assets:
   - `npm run build`
4. Run server:
   - `node server.js`

Default URL: `http://localhost:3000`

## Basic VPS deploy (Linux)

1. Prepare server
   - Install Node.js `>=22`
   - Install Nginx
2. Pull code and install
   - `git pull origin main`
   - `npm install`
   - `npm run build`
3. Create production env file
   - `cp .env.example .env.production`
   - Fill real values in `.env.production`
4. Set up systemd
   - Copy `deploy/systemd/landing-page.service` to `/etc/systemd/system/`
   - Update `WorkingDirectory`, `EnvironmentFile`, `User`, and Node path if needed
   - Run:
     - `sudo systemctl daemon-reload`
     - `sudo systemctl enable landing-page`
     - `sudo systemctl start landing-page`
5. Set up Nginx
   - Copy `deploy/nginx/landing-page.conf` to `/etc/nginx/sites-available/landing-page`
   - Replace domain and upstream port if needed
   - Enable config + reload nginx
6. Set up cron for email sequence
   - Use `deploy/cron/email-sequence-cron.sh`
   - Example crontab (daily 09:00 UTC):
     - `0 9 * * * CRON_SECRET=... BASE_URL=https://your-domain.com /var/www/landing-page/deploy/cron/email-sequence-cron.sh`

## Security notes

- Never commit `.env`, `.env.*`, or `resend_config.txt`
- Rotate any previously exposed keys immediately
- Keep secrets only in server env / secret manager
