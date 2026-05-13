# Deploy Notes (VPS Ubuntu Production)

## Project stack
- Backend: Node.js (CommonJS) with built-in `node:http` server in `server.js`
- Frontend: Static HTML/CSS/JS (`index.html`, `admin.html`, `payment.html`)
- Database: SQLite (`brain.db`) by default, optional Postgres via `DATABASE_URL`
- Email: Resend REST API

## Required environment variables on VPS
- `PORT` (example: `3000`)
- `PUBLIC_SITE_URL` (example: `https://your-domain.com`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`
- `CRON_SECRET`
- `SEPAY_WEBHOOK_SECRET`
- `DATABASE_URL` (optional, recommended for production)

## Server run commands
```bash
npm install
npm run build
node server.js
```

## Listening port
- App listens on: `process.env.PORT || 3000`
- Default when `PORT` is not set: `3000`

## Notes
- Keep `.env` only on server, never commit it.
- `brain.db` is ignored from git; if using SQLite, back it up regularly.
- Prefer setting `DATABASE_URL` on VPS to use Postgres for shared/persistent data.
