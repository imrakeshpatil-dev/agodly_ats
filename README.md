# Agodly ATS

Agodly ATS is a recruitment platform built as a **single Next.js application**:
- ATS dashboard and workflow UI (`index.html`, `styles.css`, `app.js`, served by Next)
- API as Next.js Route Handlers under `app/api/*` (backend logic in `lib/server/`)
- Embedded **SQLite** database via Prisma (`better-sqlite3` driver adapter)
- AI-assisted resume parsing and AI match scoring

There is no separate backend service — frontend and API run in one process.

## Project layout

```
app/                      Next.js app router
  page.tsx                Serves the ATS UI (index.html + app.js)
  api/**/route.ts         API endpoints (thin adapters over lib/server controllers)
  ready/ , health/        Liveness / readiness endpoints
lib/server/               Framework-agnostic backend (controllers, services, utils, config)
  http.ts                 Request shim mapping Next Request/Response to controllers
prisma/                   Prisma schema + SQL migrations
data/                     SQLite database + runtime JSON (gitignored)
instrumentation.ts        Startup guard (fatal-config check) + revocation-list load
```

## Local Run

```bash
npm install
cp .env.example .env   # Ollama is the default; then set admin/auth secrets
npm run dev
```

Open `http://localhost:3000` (or `/app`).

> Storage is an embedded **SQLite** file — no external database or Docker needed.
> `npm run dev` / `npm run start` automatically create the SQLite file when
> needed, run `prisma generate`, and apply migrations before booting.

## Production Deploy

Run the app as a **long-lived Node server** (`npm run build` then `npm run start`)
on a host with a **persistent disk** — a VPS, or Render / Railway / Fly with a
mounted volume.

> **SQLite durability requirement:** the SQLite file must live on a persistent
> disk or mounted volume (e.g. `/var/lib/agodly-ats`). Point
> `AGODLY_DATA_DIR` / `DATABASE_URL` at that mount. Do **not** deploy to a purely
> serverless/ephemeral runtime (e.g. Vercel functions) — its filesystem resets on
> every deploy and all data is lost. `/ready` reports `degraded` if the database
> path is ephemeral.

### Steps
1. Create a Web Service from this repo (root directory — no subfolder).
   - Render: `render.yaml` is picked up automatically (includes a 1 GB disk).
   - Build: `npm ci && npm run build`  ·  Start: `npm run start`  ·  Health check: `/ready`
2. Attach a persistent volume mounted at `/var/lib/agodly-ats`.
3. Configure environment variables (see `.env.production.example`):
   - `NODE_ENV=production`
   - `PORT=3000`
   - `AGODLY_DATA_DIR=/var/lib/agodly-ats`
   - `DATABASE_URL=file:/var/lib/agodly-ats/agodly-ats.sqlite`
   - `ADMIN_EMAIL=admin@agodly.com`
   - `ADMIN_PASSWORD=<strong_password>`
   - `AUTH_TOKEN_SECRET=<openssl rand -hex 32>`  ← **required; server won't start without it**
   - `AI_PROVIDER=openai` and `OPENAI_API_KEY=...` for production OpenAI support
   - See `docs/ai-local-ollama.md` and `docs/ai-production-provider.md` for other modes and fallbacks
4. Deploy, then confirm readiness:
   ```bash
   curl https://<your-domain>/ready
   ```

A `Dockerfile` is also provided for container hosts.

## Important Endpoints

- Readiness: `GET /ready` · Liveness: `GET /health`
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password`
- Candidates: `GET/POST /api/candidates`, `GET/PUT /api/candidates/:id`
- AI: `POST /api/ai/chat`, `POST /api/ai/match-score`
- Resume: `POST /api/resume/process` · Bulk upload: `POST /api/bulk-upload/parse`

## Pre-deploy Check

```bash
npm run deploy:check   # typecheck + prisma validate + next build
```

## Database

The Prisma schema lives in `prisma/schema.prisma` and uses an embedded **SQLite**
file (via the `better-sqlite3` driver adapter). Versioned migrations live in
`prisma/migrations/`.

- Setup / upgrade: nothing to install. The `prestart` / `predev` hooks run
  `prisma generate` and `prisma migrate deploy`, creating or migrating the SQLite
  file automatically on boot.
- Location: controlled by `DATABASE_URL` (`file:...`) or `AGODLY_DATA_DIR`.
  In production this **must** resolve to a persistent disk. `/ready` reports
  `database.durable` and `runtimeStorage.durable` so you can confirm the path.
- Backups: the store is a single file — back it up by copying the `.sqlite` file
  (or snapshotting the volume) on a schedule.
- Safe online backup: `npm run db:backup`. Automated production deploys create
  and integrity-check a backup before applying migrations, retaining the latest
  10 backups by default (`AGODLY_BACKUP_RETENTION` can override this).
- Schema changes: edit `schema.prisma`, then
  `npm run prisma:migrate:dev -- --name <change>` and commit the generated folder.

Runtime application state is persisted as JSON documents in the `RuntimeState`
table. The relational models (`Candidate`, `Job`, `Client`, ...) are defined and
migrated, ready for the store services to be moved onto them as a follow-up.

## Notes

- For production, also add object storage for resume files.
- `.gitignore` excludes the runtime SQLite database and JSON data in `data/`.
