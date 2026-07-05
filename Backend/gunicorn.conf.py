"""
Gunicorn config for the Imboni backend.

Run:
    gunicorn -c gunicorn.conf.py Imboni.wsgi:application

Behind nginx (recommended): nginx terminates TLS and forwards to gunicorn on
127.0.0.1:8000 with the X-Forwarded-Proto header (settings.py reads it via
SECURE_PROXY_SSL_HEADER).
"""
import multiprocessing
import os

# Bind to localhost; nginx proxies to it. Override with GUNICORN_BIND for
# platforms that inject a $PORT (Render/Railway/Heroku).
bind = os.environ.get('GUNICORN_BIND', f"127.0.0.1:{os.environ.get('PORT', '8000')}")

# A common starting point: (2 x CPU cores) + 1. Tune to the box.
workers = int(os.environ.get('WEB_CONCURRENCY', multiprocessing.cpu_count() * 2 + 1))
worker_class = 'sync'
timeout = 60
graceful_timeout = 30
keepalive = 5

# Recycle workers periodically to bound memory growth (PDF/report generation
# can be memory-heavy).
max_requests = 1000
max_requests_jitter = 100

accesslog = '-'   # stdout — let the process manager collect logs
errorlog = '-'
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
