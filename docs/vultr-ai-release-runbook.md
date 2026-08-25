# Vultr multi-provider AI release and rollback

This release keeps the existing Vultr CloudPanel architecture: one Next.js application under PM2 (`agodly-ats`), CloudPanel Nginx in front, and SQLite plus resumes under `/home/rakeshpatil1/data/agodly-ats`.

## Release gates

1. Push `codex/multi-provider-ai` and open a draft pull request into `main`.
2. Run the `Deploy to Vultr (CloudPanel)` workflow with `operation=audit` on the feature branch. This is read-only.
3. Confirm the audit reports the expected OS, app path, `main` branch, PM2 process, database path, resume path, record counts, Nginx status, and readiness.
4. Require the pull-request validation job to pass.
5. Merge only after production configuration and rollback information are ready.

A push to `main` validates the release, creates backups, and only then deploys. Any failed validation or backup stops the deployment job.

## Production AI configuration

The server-side `/home/rakeshpatil1/htdocs/admin.agodly.com/.env` must contain:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=<production project key>
# Legacy single-model setting retained for rollback compatibility.
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BULK_MODEL=gpt-5.6-luna
OPENAI_STANDARD_MODEL=gpt-5.4-mini
OPENAI_COMPLEX_MODEL=gpt-5.6-terra
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_RETRIES=1
AI_MAX_OUTPUT_TOKENS=2000
AI_RESUME_MAX_CHARS=18000
```

Before deployment, use the production project key to confirm access to `gpt-5.6-luna`, `gpt-5.4-mini`, and `gpt-5.6-terra`. Do not deploy this routing change if any model returns `model_not_found`; keep the current release active until the OpenAI project is granted access.

Keep `.env` mode `0600`. Never echo it, download it to a browser, commit it, or expose any of these values through a `NEXT_PUBLIC_*` variable.

## Backup layout

Immediately before deployment, GitHub Actions creates:

- integrity-checked SQLite backup in `/home/rakeshpatil1/data/agodly-ats/backups`;
- release bundle in `/home/rakeshpatil1/data/agodly-ats/release-backups/<UTC timestamp>`;
- `git-commit.txt` and `git-branch.txt` for the previous working release;
- `application.env` with mode `0600`;
- verified `resumes.tar.gz`;
- `data-counts.json` with the pre-release candidate/job/client counts;
- Nginx configuration when the site user has permission to read it;
- `SHA256SUMS` for the release bundle.

`/home/rakeshpatil1/data/agodly-ats/release-backups/LATEST` identifies the newest bundle.

## Exact code rollback

Run as `rakeshpatil1`:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd /home/rakeshpatil1/htdocs/admin.agodly.com
release_root=/home/rakeshpatil1/data/agodly-ats/release-backups
release_dir="$release_root/$(cat "$release_root/LATEST")"
previous_commit=$(cat "$release_dir/git-commit.txt")
git fetch origin
git reset --hard "$previous_commit"
cp "$release_dir/application.env" .env
chmod 600 .env
npm ci
npm run build
pm2 restart agodly-ats
pm2 save
curl -fsS http://127.0.0.1:3000/ready
```

This does not rewrite database or resume data.

## Database restore (only if database verification fails)

Do not restore the database for an application-only rollback. If a database restore is necessary:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
cd /home/rakeshpatil1/htdocs/admin.agodly.com
data_dir=/home/rakeshpatil1/data/agodly-ats
database="$data_dir/agodly-ats.sqlite"
backup=$(find "$data_dir/backups" -type f -name 'agodly-ats-*.sqlite' -print | sort | tail -1)
test -n "$backup" && test -s "$backup"
pm2 stop agodly-ats
cp "$database" "$database.failed-$(date -u +%Y%m%dT%H%M%SZ)"
cp "$backup" "$database"
chmod 600 "$database"
node -e 'const D=require("better-sqlite3");const db=new D(process.argv[1],{readonly:true,fileMustExist:true});if(db.pragma("integrity_check",{simple:true})!=="ok")process.exit(1);db.close()' "$database"
pm2 restart agodly-ats
curl -fsS http://127.0.0.1:3000/ready
```

The failed database is retained for investigation.

## Resume restore (only if upload verification fails)

```bash
data_dir=/home/rakeshpatil1/data/agodly-ats
release_root="$data_dir/release-backups"
release_dir="$release_root/$(cat "$release_root/LATEST")"
test -s "$release_dir/resumes.tar.gz"
tar -tzf "$release_dir/resumes.tar.gz" >/dev/null
mv "$data_dir/resumes" "$data_dir/resumes.failed-$(date -u +%Y%m%dT%H%M%SZ)"
tar -xzf "$release_dir/resumes.tar.gz" -C "$data_dir"
```

The post-release resume directory is retained rather than deleted.

## Post-rollback verification

Verify `/ready`, login, dashboard, Candidates, Jobs, Pipeline, Bulk Upload, MY LLM, AI Match, Revenue, an existing resume preview, and the candidate/job counts from `data-counts.json`.
