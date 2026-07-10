# Deployment Guide — Taking Imboni to a Pilot

This is the operational runbook for putting Imboni on a real server for a school
pilot. It assumes one Linux box (or a PaaS like Render/Railway). Follow it top to
bottom the first time.

---

## The moving parts

```
                          ┌─────────── nginx (TLS, :443) ───────────┐
  Browser ── HTTPS ──▶    │  /            → React build (static)     │
                          │  /imboni/...  → gunicorn (Django API)    │
                          └──────────────────┬──────────────────────┘
                                             │ 127.0.0.1:8000
                                   ┌─────────▼─────────┐
                                   │  gunicorn (web)   │
                                   └─────────┬─────────┘
                     ┌───────────────────────┼───────────────────────┐
              ┌──────▼──────┐        ┌───────▼───────┐        ┌───────▼───────┐
              │   MySQL     │        │     Redis     │        │  Celery       │
              │  (data)     │        │ (broker+cache)│◀───────│  worker+beat  │
              └─────────────┘        └───────────────┘        └───────────────┘
```

Five processes: **nginx**, **gunicorn** (web), **MySQL**, **Redis**, and
**Celery** (a worker *and* a beat scheduler). The frontend is a static build
served by nginx.

## 1. Prerequisites on the server

```bash
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3-pip \
    mysql-server redis-server nginx \
    pkg-config default-libmysqlclient-dev build-essential \
    # WeasyPrint (report cards) runtime libs:
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev
```

Secure MySQL and create the database + a dedicated user:

```sql
CREATE DATABASE imboni CHARACTER SET utf8mb4;
CREATE USER 'imboni'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON imboni.* TO 'imboni'@'localhost';
FLUSH PRIVILEGES;
```

## 2. Backend setup

```bash
cd /srv/imboni/Backend
python3.13 -m venv venv && source venv/bin/activate
pip install -r requirements.txt gunicorn

cp .env.example .env    # then edit .env — see the checklist in section 6
```

Generate a real secret key and paste it into `.env` as `THE_SECRET_KEY`:

```bash
python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
```

Run the release steps:

```bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py createsuperuser   # first admin login
```

## 3. Run the processes

**Web (gunicorn):**
```bash
gunicorn -c gunicorn.conf.py Imboni.wsgi:application
```

**Celery worker + beat** (two processes — on Linux drop the Windows `--pool=solo`):
```bash
celery -A Imboni worker -l info
celery -A Imboni beat -l info
```

On a PaaS these three map directly to the `Procfile` process types
(`web`, `worker`, `beat`) — the platform runs them for you and the `release:`
line handles migrate + collectstatic on each deploy.

On a plain server, run them as **systemd** services so they restart on boot and
on crash. Minimal unit for gunicorn (`/etc/systemd/system/imboni-web.service`):

```ini
[Unit]
Description=Imboni gunicorn
After=network.target mysql.service redis-server.service

[Service]
User=imboni
WorkingDirectory=/srv/imboni/Backend
EnvironmentFile=/srv/imboni/Backend/.env
ExecStart=/srv/imboni/Backend/venv/bin/gunicorn -c gunicorn.conf.py Imboni.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

Duplicate for `imboni-worker` (ExecStart → `celery -A Imboni worker -l info`)
and `imboni-beat` (→ `celery -A Imboni beat -l info`). Then:

```bash
sudo systemctl enable --now imboni-web imboni-worker imboni-beat
```

## 4. nginx (TLS + reverse proxy)

nginx terminates HTTPS and forwards API calls to gunicorn. The
`X-Forwarded-Proto` header is **required** — settings.py reads it
(`SECURE_PROXY_SSL_HEADER`) to know the request is secure, which is what makes
the secure cookies and SSL redirect work.

```nginx
server {
    listen 443 ssl;
    server_name imboni.example.rw;

    ssl_certificate     /etc/letsencrypt/live/imboni.example.rw/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/imboni.example.rw/privkey.pem;

    # React build
    root /srv/imboni/Frontend/dist;
    index index.html;

    # API → gunicorn
    location /imboni/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # ← critical
    }
    location /admin/ { proxy_pass http://127.0.0.1:8000; proxy_set_header X-Forwarded-Proto $scheme; }
    location /static/ { alias /srv/imboni/Backend/staticfiles/; }
    location /media/  { alias /srv/imboni/Backend/media/; }

    # SPA routing — every other path serves index.html so React Router works
    location / { try_files $uri /index.html; }
}
server {  # http → https
    listen 80;
    server_name imboni.example.rw;
    return 301 https://$host$request_uri;
}
```

Get the certificate with `sudo certbot --nginx -d imboni.example.rw`.

> **HTTPS is not optional here** — the offline PWA's service worker only
> registers over HTTPS, and the JWT/secure cookies depend on it. The pilot must
> be on a real certificate, not plain HTTP.

## 5. Frontend build

```bash
cd /srv/imboni/Frontend
npm ci
# Point the build at the production API origin:
echo "VITE_API_BASE=https://imboni.example.rw" > .env.production
npm run build      # outputs dist/ (nginx serves it)
```

Rebuild and let nginx pick up `dist/` on every frontend change.

## 5.5 Onboarding a school's data

Setting up a pilot school without hand-entering hundreds of rows. Sample CSVs
and the full walk-through live in `Backend/onboarding_samples/` — export the
school's real data as **CSV UTF-8** into those shapes. Every step has a
`--dry-run`; always preview first.

**Order matters** (each step depends on the previous):

1. **Staff & students** — upload `people.csv` via **Admin/DOS → Invitations →
   Import CSV** (the existing bulk-invite). Staff get an account on accepting;
   students/parents register from their invite link.
2. **Classes** — `python manage.py import_classes onboarding_samples/classes.csv`
   (matched on grade+section, safe to re-run).
3. **Subjects** — create them (DOS portal or seed) so the timetable can
   reference them by code.
4. **Timetable** — `python manage.py import_timetable onboarding_samples/timetable.csv`
   (needs a current `AcademicTerm`; skips teacher double-bookings rather than
   clashing them).

```bash
# Always dry-run first
python manage.py import_classes  onboarding_samples/classes.csv  --dry-run
python manage.py import_timetable onboarding_samples/timetable.csv --dry-run
```

Class and timetable imports are recorded in the audit log.

## 6. Go-live checklist

Before letting a real school in, confirm:

- [ ] `MY_DEBUG=False` in `.env` (never run a pilot with DEBUG on)
- [ ] `THE_SECRET_KEY` is a fresh random value, not the example
- [ ] `ALLOWED_HOSTS` lists the real domain(s)
- [ ] `CORS_ALLOWED_ORIGINS` lists the real frontend origin only
- [ ] `REDIS_CACHE_URL` set (so login throttling works across workers)
- [ ] TLS certificate installed; http redirects to https
- [ ] `python manage.py check --deploy` reports no critical warnings
- [ ] A superuser exists and can log into `/admin/`
- [ ] Celery worker AND beat are both running (`celery -A Imboni inspect ping`)
- [ ] A test email actually sends (invitation or password reset)
- [ ] Database backups scheduled (`mysqldump` cron, off-box copy)
- [ ] Install the PWA on a phone and confirm offline attendance syncs
- [ ] `SENTRY_DSN` set on backend **and** `VITE_SENTRY_DSN` set at frontend build (see §6.5)
- [ ] Admin/staff enable two-factor auth (**Account → Security → Two-Factor**) — TOTP is built in; strongly recommended for accounts that can see every child's records

Run the built-in deployment audit — it flags anything still insecure:

```bash
python manage.py check --deploy
```

## 6.5 Error monitoring (Sentry)

Without this you have zero visibility when a real teacher hits a bug — no stack
trace, no idea it happened. Sentry is wired into both backend and frontend and
stays a **complete no-op until a DSN is provided**, so dev and CI send nothing.

**Set up (once):** create a free project at sentry.io — one for the Django
backend (platform: Django) and one for the React frontend (platform: React).
Each gives you a DSN.

**Backend** — put the DSN in the server `.env`:

```bash
SENTRY_DSN=https://<key>@o0.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1     # 10% of requests traced; raise to debug a slowdown
```

The init lives at the end of `Imboni/settings.py`; it wires the Django **and
Celery** integrations, so unhandled errors in web requests *and* background
tasks both report automatically.

**Frontend** — Vite bakes env vars in **at build time**, so the DSN must be set
*before* `npm run build`, not at runtime:

```bash
VITE_SENTRY_DSN=https://<key>@o0.ingest.sentry.io/<project>
VITE_SENTRY_ENVIRONMENT=production
```

A top-level `Sentry.ErrorBoundary` (see `src/main.jsx`) also replaces the white
screen-of-death with a recoverable "Something went wrong" page.

**Privacy — important for children's data:** both SDKs are configured with
`send_default_pii=False` and scrub cookies, request bodies, and URL query
strings, so grades, medical notes, and auth/reset tokens never leave in an error
report. Do not enable PII capture.

**Verify it works:** after deploy, trigger a test error (e.g. hit a URL that
raises, or add a throwaway `1/0` view temporarily) and confirm the event appears
in the Sentry dashboard within a minute.

## 7. Day-2 operations

| Task | Command |
|---|---|
| Apply new migrations | `python manage.py migrate` (in `release:` on PaaS) |
| Refresh static after deploy | `python manage.py collectstatic --noinput` |
| Tail API logs | `journalctl -u imboni-web -f` |
| Check Celery health | `celery -A Imboni inspect active` |
| Run a scheduled job now | `python manage.py send_weekly_digest` / `send_due_date_reminders` |
| Back up the database now | `python manage.py backup_database` |
| Erase a person's data (GDPR) | `python manage.py erase_user_data <email> --dry-run` |

## 7.5 Data protection — backups & erasure

Two management commands cover the data-protection basics. Both are also
documented for the school in `PRIVACY_POLICY.md` (repo root — a template to
review and publish; the school is the data controller).

### Automated backups

`backup_database` writes a gzipped `mysqldump` snapshot and prunes ones older
than the retention window (default 14 days):

```bash
python manage.py backup_database                 # writes to BACKUP_DIR
python manage.py backup_database --dry-run       # show the plan, change nothing
python manage.py backup_database --retention-days 30
```

It runs automatically **every day at 02:00** via Celery beat
(`apps.audit.tasks.backup_database_task`) — so keep the beat process running
(§3). Configure where snapshots land and how long to keep them:

```bash
BACKUP_DIR=/var/backups/imboni     # point at a volume that is copied OFF the DB host
BACKUP_RETENTION_DAYS=14
```

> A backup on the same disk as the database is not a backup. Ensure `BACKUP_DIR`
> is (or is synced to) separate, off-box storage.

**Restore drill — do this once before go-live** (a backup you have never
restored is only a guess):

```bash
# 1. Pick a snapshot and unzip it
gunzip -k /var/backups/imboni/imboni-imboni-20260710T020000Z.sql.gz

# 2. Restore into a scratch database (NOT production) to prove it's valid
mysql -e "CREATE DATABASE imboni_restore_test"
mysql imboni_restore_test < /var/backups/imboni/imboni-imboni-20260710T020000Z.sql

# 3. Sanity-check row counts, then drop the scratch DB
mysql imboni_restore_test -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM students;"
mysql -e "DROP DATABASE imboni_restore_test"
```

### Data-erasure requests ("right to be forgotten")

When a parent or staff member asks for their (or their child's) data to be
erased, use `erase_user_data`. Default mode **anonymises** — it scrubs all
personal data (name, email, phone, address, DOB, emergency contact, avatar, and
pupil medical fields) and deactivates the account, while keeping the row so
academic/attendance history stays intact where the school must retain it:

```bash
python manage.py erase_user_data parent@example.com --dry-run   # preview
python manage.py erase_user_data parent@example.com --actor dpo@school.rw
python manage.py erase_user_data <user-id> --delete             # full hard delete
```

Every erasure is written to the audit log (`user.erased`), so the erasure itself
stays accountable.

## 8. What still needs a human decision before real pupils

- **Data protection policy**: children's grades, medical (medication/health) and
  disciplinary records are sensitive. The app enforces role permissions, keeps an
  audit log, backs up automatically, and can erase/anonymise on request (§7.5) —
  but the school must adopt `PRIVACY_POLICY.md`, set a retention period, and
  confirm consent.
- **Backups tested**: run the restore drill in §7.5 before go-live.
- **A rollback plan**: keep the previous release and a DB snapshot so a bad
  deploy can be reverted in minutes.
