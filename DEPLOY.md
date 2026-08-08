# Deploying Agodly ATS to CloudPanel (Node.js site)

This is a single Next.js app (frontend + API + Prisma/SQLite) run as a long-lived
Node server under PM2, behind CloudPanel's nginx reverse proxy.

- **Server:** Vultr VPS, CloudPanel v2, site `admin.agodly.com`, site user `rakeshpatil1`
- **App dir:** `/home/rakeshpatil1/htdocs/admin.agodly.com`
- **Database (persistent):** `/home/rakeshpatil1/data/agodly-ats/agodly-ats.sqlite`
- **App port:** `3000` (must match CloudPanel → Site → Settings → App Port, and the
  `proxy_pass` port in the Vhost)
- **Node:** 24 LTS (via the site user's nvm)

## First-time / fresh deploy

1. Build the deploy zip locally (source only — **no** `node_modules`/`.next`, because
   `better-sqlite3` is native and must compile on the server). The zip contains the
   app source plus `deploy.sh`.
2. Upload `agodly-ats-deploy.zip` into `htdocs/admin.agodly.com` via CloudPanel File Manager.
3. SSH in **as the site user** (`ssh rakeshpatil1@<ip>`), then:
   ```bash
   cd ~/htdocs/admin.agodly.com && unzip -o agodly-ats-deploy.zip && bash deploy.sh
   ```
   `deploy.sh` loads nvm, runs `npm ci`, writes `.env` (first run only), builds,
   migrates the DB, and starts the app under PM2.
4. Issue SSL: CloudPanel → Site → **SSL/TLS** → New Let's Encrypt Certificate.
5. Persist PM2 across reboots:
   ```bash
   export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && pm2 save
   ```
   Then CloudPanel → **Cron Jobs**:
   ```
   @reboot export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; pm2 resurrect
   ```

## Redeploy (updates)

Upload the new zip, then re-run the same one-liner. `deploy.sh` keeps the existing
`.env` and database, rebuilds, migrates, and restarts:
```bash
cd ~/htdocs/admin.agodly.com && unzip -o ~/htdocs/agodly-ats-deploy.zip && bash deploy.sh
```

## Environment (.env)

Lives at `~/htdocs/admin.agodly.com/.env`. Key values:
```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://admin.agodly.com   # REQUIRED — a wildcard (*) fails /ready in prod
AGODLY_DATA_DIR=/home/rakeshpatil1/data/agodly-ats
DATABASE_URL=file:/home/rakeshpatil1/data/agodly-ats/agodly-ats.sqlite
ADMIN_EMAIL=admin@agodly.com
ADMIN_PASSWORD=<change me>
AUTH_TOKEN_SECRET=<32+ random chars; server won't start without it>
OPENAI_API_KEY=<optional; AI parsing falls back to heuristics without it>
```
After editing `.env`: `pm2 restart agodly-ats`.

## Operations

```bash
# always load nvm first in a fresh shell
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"

pm2 status                       # process state / restart count
pm2 logs agodly-ats              # live logs
pm2 restart agodly-ats           # restart
curl -s http://127.0.0.1:3000/ready   # readiness (want "success":true)
```

Backups: the whole database is one file — copy it on a schedule:
```
/home/rakeshpatil1/data/agodly-ats/agodly-ats.sqlite
```

## Gotchas we hit (and the fixes, now baked into the source/zip)

1. **nvm + `set -u`** — `deploy.sh` must not use `set -u`; sourcing `nvm.sh` under
   nounset aborts the script silently. Fixed: `set -eo pipefail`.
2. **`CORS_ORIGIN=*` → dashboard HTTP 503** — in production `/ready` treats a wildcard
   CORS origin as a blocking config issue. Must be the real origin.
3. **SSL** — the default self-signed cert makes the login `fetch` fail with
   `ERR_CERT_AUTHORITY_INVALID`. Install Let's Encrypt.
4. **Two databases / Prisma 7 doesn't auto-load `.env`** — with a `prisma.config.ts`
   present, `prisma migrate deploy` ignored `.env` and migrated
   `<cwd>/data/agodly-ats.sqlite` while the app used the `.env` path — so the app's DB
   had no tables (`Candidate`/`RuntimeState` "does not exist"). Fixed by calling
   `dotenv.config()` at the top of `prisma.config.ts`, so the CLI/`prestart` and the
   app share one database.
5. **Stale "Backend disconnected"** — after any transient blip the UI can latch into a
   disconnected state and reject uploads ("Backend database unavailable" / "Failed to
   fetch"). A page reload reconnects it; the backend itself is unaffected.

## Automated deploys (GitHub Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which SSHes into the
server as the site user and runs: `git reset --hard origin/main` → `npm ci` →
`npm run build` → `prisma migrate deploy` → `pm2 restart`. `.env` and the database
are untouched (gitignored / stored outside the repo).

### One-time setup

1. **Convert the app dir to a git checkout** (it started as an unzipped copy). On the
   server, preserving `.env`:
   ```bash
   cd ~/htdocs
   cp admin.agodly.com/.env ~/agodly.env.bak
   mv admin.agodly.com admin.agodly.com.zipbak
   git clone https://github.com/imrakeshpatil-dev/agodly_ats.git admin.agodly.com
   cp ~/agodly.env.bak admin.agodly.com/.env
   cd admin.agodly.com
   export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
   npm ci && npm run build && npm run prisma:migrate:deploy && pm2 restart agodly-ats
   ```
   Once confirmed working, remove `~/htdocs/admin.agodly.com.zipbak`.

2. **Create an SSH key for GitHub Actions** (on the server, as the site user):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/gh_deploy -N "" -C "github-actions"
   cat ~/.ssh/gh_deploy.pub >> ~/.ssh/authorized_keys
   chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
   cat ~/.ssh/gh_deploy        # copy this PRIVATE key
   ```

3. **Add GitHub repo secrets** (Settings → Secrets and variables → Actions → New):
   - `SSH_HOST` = server IP (65.20.66.62)
   - `SSH_USERNAME` = rakeshpatil1
   - `SSH_KEY` = the full private key from `gh_deploy` (including the BEGIN/END lines)

After that, every push to `main` deploys automatically. Watch progress in the repo's
**Actions** tab.
