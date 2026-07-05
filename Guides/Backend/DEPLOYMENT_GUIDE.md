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

Run the built-in deployment audit — it flags anything still insecure:

```bash
python manage.py check --deploy
```

## 7. Day-2 operations

| Task | Command |
|---|---|
| Apply new migrations | `python manage.py migrate` (in `release:` on PaaS) |
| Refresh static after deploy | `python manage.py collectstatic --noinput` |
| Tail API logs | `journalctl -u imboni-web -f` |
| Check Celery health | `celery -A Imboni inspect active` |
| Run a scheduled job now | `python manage.py send_weekly_digest` / `send_due_date_reminders` |
| Database backup | `mysqldump imboni | gzip > imboni-$(date +%F).sql.gz` |

## 8. What still needs a human decision before real pupils

- **Data protection**: children's grades, medical (medication/health) and
  disciplinary records are sensitive. Confirm who may access what, a retention
  policy, and consent — the app enforces role permissions and keeps an audit
  log, but policy is yours to set.
- **Backups tested**: a backup you haven't restored is a guess. Do one restore
  drill before go-live.
- **A rollback plan**: keep the previous release and a DB snapshot so a bad
  deploy can be reverted in minutes.
