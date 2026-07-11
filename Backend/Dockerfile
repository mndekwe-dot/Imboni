# syntax=docker/dockerfile:1
FROM python:3.13-slim

# --- Python runtime behaviour ---
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# --- System dependencies (single layer) ---
# build-essential + libffi/cairo/pango dev headers: only needed if a wheel is
#   missing for this platform; kept minimal since most deps ship manylinux wheels.
# weasyprint / pycairo / reportlab runtime libs: cairo, pango, gdk-pixbuf, ffi,
#   shared-mime-info and a base font family.
# postgresql-client: provides pg_dump (backup_database command) and pg_isready.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libffi-dev \
        libcairo2 \
        libcairo2-dev \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu-core \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Python dependencies (copied first for layer caching) ---
COPY requirements.txt .
RUN pip install -r requirements.txt \
    && pip install "gunicorn==23.0.0"

# --- Application code ---
COPY . .

# --- Build-time defaults so collectstatic can import settings ---
# These are harmless placeholders only; real values are injected at runtime.
ENV THE_SECRET_KEY=build \
    ALLOWED_HOSTS=localhost \
    MY_DEBUG=False

RUN python manage.py collectstatic --noinput

EXPOSE 8000

# entrypoint prepares the database (wait, migrate, seed public tenant) then
# execs whatever CMD/command is supplied (gunicorn, celery worker, celery beat).
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["gunicorn", "Imboni.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
