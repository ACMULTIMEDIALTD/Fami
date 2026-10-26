# The Creator Club · קהילת היוצרות של נועה אביטל

אפליקציה סגורה לניהול קהילת היוצרות: הרשמה ופרופיל מלא, אישור תנאים (click-wrap), לוח קמפיינים עם בדיקת התאמה, הגשת מועמדות, בחירת יוצרות וייצוא למותג.

```
server/   Node + Express + PostgreSQL  → Render
client/   React + Vite (RTL, mobile-first) → Vercel
```

## Local development

Requires Node 22.9+ and PostgreSQL 14+.

```bash
createdb fami
cd server
cp .env.example .env        # edit ADMIN_EMAIL / ADMIN_PASSWORD
npm install
npm run setup               # migrations + seed (niches, regions, admin)
npm run dev                 # API on :4000

cd ../client
npm install
npm run dev                 # app on :5173, proxies /api → :4000
```

Without `SMTP_URL`, emails (magic links, approvals, selections) are printed to the API log, so you can click magic links locally.

Extra admin: `npm run create-admin -- idan@example.com 'password'`.

### Tests

```bash
createdb fami_test
cd server && npm test       # uses TEST_DATABASE_URL or postgres://postgres:postgres@localhost:5432/fami_test
```
The integration suite drops and recreates the `public` schema of that database. Never point it at real data.

## Deploy

**API (Render).** `render.yaml` is a Blueprint for the web service and the database. Set `APP_URL`, `CORS_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `WHATSAPP_GROUP_URL`, `TERMS_PDF_URL` and the SMTP settings. Migrations run on every boot, and the seed is idempotent.

**Client (Vercel).** Set the project root to `client/`. Before deploying, change the API host in `client/vercel.json` to your Render URL. Vercel proxies `/api/*` to Render, so the session cookie is first-party (`SameSite=Lax`). That matters because Safari and in-app browsers such as WhatsApp's block third-party cookies. If you call the API cross-origin instead, set `COOKIE_SAMESITE=none`.

## Key rules (enforced server-side)

| Rule | Where |
|---|---|
| Eligibility with reason codes (status, terms, deadline, type, followers, niche, region, duplicate) | `server/src/lib/eligibility.js` |
| `full_brief` / `payment_note` only for selected creators, never in list endpoints | `server/src/routes/campaigns.js` |
| Terms version + timestamp + IP stored. Bumping `CURRENT_TERMS_VERSION` forces a re-accept modal | `routes/me.js`, `TermsModal.jsx` |
| New signups are `pending` until Noa approves; the WhatsApp group link is shown only to active members | `routes/admin/creators.js`, `routes/auth.js` |
| Closing a campaign auto-rejects all pending applications ("לא הפעם, את במאגר להבא") | `routes/admin/campaigns.js` |
| Only `/`, `/join`, `/brands` and `/login` are public. `/c/:slug` redirects to login with `?next=` | `client/src/auth.jsx` |

## Notes / decisions beyond the spec
- Magic-link tokens are stored as SHA-256 hashes, are single-use and expire after 30 minutes.
- Pending creators see a locked board. Campaign cards are part of what membership gives them.
- A creator who withdraws can apply again while the campaign is open.
- `POST /me/terms` is the endpoint behind the re-accept modal. `GET /public/meta` serves the niches and regions lists. `POST /public/brand-inquiry` emails Noa from `/brands` and has a honeypot field against spam.
- `GET /admin/overview` powers the admin "today" screen.
- CSV exports include a UTF-8 BOM so Excel shows Hebrew correctly, and they guard against formula injection.
