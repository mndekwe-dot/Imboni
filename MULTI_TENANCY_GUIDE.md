# Imboni Multi-Tenancy Guide

How Imboni becomes a multi-school SaaS platform where each school ("tenant") gets a
fully isolated copy of the app and can **rent or buy** access.

Status: **in progress** — this document is both the design record and the step-by-step
implementation runbook. Each phase is checkable; update the boxes as they land.

---

## 1. Goal

Turn Imboni from a single-school app into a platform where many schools sign up, each
with their own students, staff, results, timetables, etc., completely isolated from every
other school — and where access is gated by a paid subscription.

---

## 2. Architecture decision: schema-per-tenant (PostgreSQL + `django-tenants`)

We evaluated three isolation models:

| Option | How | Verdict |
|---|---|---|
| **A. Row-level `school_id`** | Add a `School` FK to all ~50 models; every query filters by school. | Rejected — requires auditing **~496 query sites** + fixing **74 global singletons**; a single missed filter leaks one school's children's data into another. |
| **B. Database-per-tenant (MySQL)** | One MySQL DB per school, routed by subdomain. | Viable, but weaker ecosystem support and heavier connection management than C. |
| **C. Schema-per-tenant (Postgres + `django-tenants`)** ✅ | One Postgres schema per school; middleware routes by subdomain. | **Chosen.** Models and all 496 queries stay unchanged; the 74 singletons "just work" per schema; canonical, well-maintained Django SaaS path. |

**Why C for Imboni**

- **No query rewrites, no leak surface.** Each school lives in its own Postgres schema.
  `AcademicTerm.objects.filter(is_current=True)` and `SchoolSetting.get_or_create(pk=1)`
  resolve within the active schema, so the 74 existing single-tenant assumptions remain correct.
- **Best long-term engine.** Postgres is stronger for analytics/JSON/concurrency and is
  offered as managed infrastructure by every credible host (RDS, Render, Neon, Supabase, Fly).
- **Migrate now while single-tenant.** Moving MySQL → Postgres is a one-time cost and is
  cheapest before real multi-school data exists.
- **Scale fit.** Target is 1–20 schools initially; schema-per-tenant is trivial at this scale
  and comfortable into the low hundreds.

### How it works at runtime

```
school-a.imboni.com ─┐
school-b.imboni.com ─┼─► TenantMainMiddleware reads the subdomain
school-c.imboni.com ─┘        │
                              ▼
                     public schema  ── Client (school registry) + Domain + billing
                              │  looks up which schema the subdomain maps to
                              ▼
                     SET search_path = school_b
                              │
         ┌────────────────────┴────────────────────┐
   schema: school_a        schema: school_b     schema: school_c
   (all 16 apps' tables)   (all 16 apps' tables)  (all 16 apps' tables)
```

- **`public` schema** holds shared/platform data: the tenant registry, domains, and
  (later) billing + platform super-admin.
- **Each tenant schema** holds a full copy of the app's tables — students, users, results,
  everything. A request can only ever see the schema its subdomain resolved to.

---

## 3. App split: SHARED vs TENANT

`django-tenants` requires `INSTALLED_APPS` to be expressed as two lists:

- **`SHARED_APPS`** — created in the `public` schema. Platform-level only.
  - `django_tenants`, `apps.tenants` (the new registry), `django.contrib.contenttypes`,
    admin/static plumbing.
- **`TENANT_APPS`** — created in *every* tenant schema. Basically the whole existing app.
  - `apps.authentication` (so each school has its own users/logins/invitations),
    `apps.results`, `apps.attendance`, `apps.teacher`, `apps.student`, `apps.dos`,
    `apps.matron`, `apps.discipline`, `apps.messages`, `apps.notifications`,
    `apps.announcements`, `apps.behavior`, `apps.analytics`, `apps.parents`, `apps.audit`,
    plus `rest_framework*`, `simplejwt` + token blacklist.

`INSTALLED_APPS = list(SHARED_APPS) + [a for a in TENANT_APPS if a not in SHARED_APPS]`.

**Key call: the `User` model lives in `TENANT_APPS`.** A user belongs to exactly one
school, so per-schema users are the clean fit — login, invitations, and password resets are
automatically scoped once the subdomain resolves the schema.

---

## 4. Prerequisites

- **PostgreSQL** — run via Docker (no local install needed):
  ```bash
  docker run --name imboni-postgres -e POSTGRES_USER=imboni \
    -e POSTGRES_PASSWORD=imboni -e POSTGRES_DB=imboni \
    -p 5432:5432 -d postgres:16
  ```
- **Python deps** (added to `Backend/requirements.txt`):
  - `django-tenants`
  - `psycopg[binary]`
- **Local subdomains** — add to your hosts file so subdomains resolve to localhost:
  ```
  127.0.0.1  imboni.localhost school1.localhost school2.localhost
  ```
  (Windows: `C:\Windows\System32\drivers\etc\hosts`, needs admin.)

---

## 5. Implementation phases

### Phase 1 — Foundation: two isolated schools running side by side  ✅ DONE (commit 8abc456)

- [x] Add `django-tenants` + `psycopg` to requirements; Postgres running in Docker.
- [x] Create `apps/tenants` with `Client(TenantMixin)` and `Domain(DomainMixin)`.
- [x] Restructure settings: `SHARED_APPS` / `TENANT_APPS` / `INSTALLED_APPS`,
      `DATABASE_ROUTERS`, `TenantMainMiddleware` first in `MIDDLEWARE`,
      engine → `django_tenants.postgresql_backend`.
- [x] `migrate_schemas --shared`; create the `public` tenant.
- [x] Create two demo tenants (`school1.localhost`, `school2.localhost`), seed an admin each.
- [x] **Milestone:** logged into both over HTTP by subdomain; school1 admin gets 401 on
      school2 and vice-versa; schema/table isolation confirmed. Also verified suspension
      enforcement (suspended school → 402, login still reachable).

**Verified `authentication` must be TENANT-only** (not shared): its `Invitation` model
FKs into per-school `students`/`classes`, so it cannot live in the public schema.

**Test suite: GREEN under django-tenants.** `Backend/conftest.py` now builds a `test` tenant
(domain `testserver`) so `TenantMainMiddleware` routes every test request into its schema, and
pins the connection to that schema for ORM calls. Full suite: **333 passed**. Also ported the
`backup_database` command MySQL→Postgres (`pg_dump`) — it was the only real code casualty of the
engine switch.

**Still owed:** the platform super-admin API (`apps/tenants/views.py`) is built but unwired,
pending a shared-schema platform-auth model (Phase 5).

### Phase 2 — Onboarding / provisioning

- [ ] Programmatic "create school" flow: create `Client` + `Domain`, run
      `migrate_schemas --tenant`, seed defaults (academic term, first admin, roles),
      send welcome email — idempotent and reusable.
- [ ] A management command `provision_school` and/or an API endpoint for it.

### Phase 3 — Billing & access enforcement (the "rent or buy")

- [ ] `Client` gains `plan` + `status` (`trial` / `active` / `past_due` / `suspended`).
- [ ] Stripe: plans/prices, checkout, trials, invoices, **webhooks** that flip `status`.
- [ ] Middleware that blocks/degrades access when `status ∈ {past_due, suspended}`.

### Phase 4 — Plan gating & limits

- [ ] Seat limits (max students/staff), storage caps, tier-gated features.
- [ ] Enforced backend (source of truth) + reflected in frontend (upgrade prompts).

### Phase 5 — Platform super-admin console

- [ ] Vendor-only area (separate from any school's Admin portal): list schools, billing
      status, suspend non-payers, impersonate for support, usage metrics.

### Phase 6 — Per-tenant branding, media, backups

- [ ] `SchoolSetting` per tenant drives logo/name/theme + `DEFAULT_FROM_EMAIL`.
- [ ] Media isolation (S3 prefix per schema) for avatars + `StudentDocument`.
- [ ] Per-tenant backup + data-erasure runs (extend existing tooling to loop schemas).

### Phase 7 — Public signup funnel

- [ ] Marketing/pricing pages + self-serve signup wired to Phase 2 provisioning + Phase 3 billing.

---

## 6. Frontend changes (summary)

- Subdomain-aware API base + tenant context; render each school's logo/name/theme.
- Public marketing/pricing/signup pages (extend the existing `LandingPage`).
- Plan-gated UI (upgrade prompts, "seats used", trial banners).
- A billing/subscription screen in the school Admin portal.

---

## 7. Gotchas specific to Imboni

- **74 global singletons** (`is_current=True`, `get_or_create(pk=1)`) — safe under
  schema-per-tenant because each schema has exactly one. Do **not** "fix" them.
- **JWT (`simplejwt`)** — token auth runs *after* tenant middleware resolves the schema, so
  tokens validate against the right school's user table. Keep tenant middleware first.
- **CORS/CSRF with subdomains** — allow the wildcard of your tenant domain
  (`*.imboni.com` / `*.localhost`) in `CORS_ALLOWED_ORIGIN_REGEXES` and `CSRF_TRUSTED_ORIGINS`.
- **contenttypes** must be in `SHARED_APPS` (django-tenants requirement).
- **Auto-generators** (timetable/exam CSP) must run in **Celery per tenant** at scale, never
  synchronously across many schools in a web request.
- **Migrations** now run with `migrate_schemas` (shared + tenant), not plain `migrate`.

---

## 8. Deployment (credible infra)

- **Managed Postgres** (RDS / Render / Neon / Supabase).
- **Wildcard DNS** `*.imboni.com` + **wildcard TLS** (Let's Encrypt / host-managed certs).
- Celery + broker (Redis) for background generation and per-tenant jobs.
- Container image already viable (Docker present); one web image serves all tenants.

### Phase 8 — Full containerization (Docker) — REQUESTED, not started

Goal: run the whole stack in containers so dev == prod and deploys are reproducible.
Currently only Postgres is containerized (`docker-compose.yml`). To do:

- [ ] **Backend `Dockerfile`** — Python image, install `Backend/requirements.txt`, collectstatic,
      run gunicorn; entrypoint runs `migrate_schemas --shared` (and `--tenant`) on start.
- [ ] **Frontend `Dockerfile`** — multi-stage: `npm run build` then serve the static bundle
      (nginx or a small static server).
- [ ] **Extend `docker-compose.yml`** into the full stack: `db` (postgres), `redis`,
      `backend` (gunicorn), `worker` + `beat` (Celery), `frontend`, and a reverse proxy
      (nginx/Caddy) that terminates TLS and routes `*.localhost` / `*.imboni.com` subdomains.
- [ ] **Env wiring** — pass `DATABASE_HOST=db`, `CELERY_BROKER_URL=redis://redis:6379/0`, etc.
      via compose env, not the host `.env`; keep secrets out of the image.
- [ ] **Volumes** — named volume for Postgres data; bind-mount media (or use S3 in prod).
- [ ] **One image, all tenants** — the same backend image serves every school; no per-tenant
      images. Subdomain routing happens at the proxy + `TenantMainMiddleware`.
- [ ] Optionally a production `docker-compose.prod.yml` override (no code bind-mounts,
      restart policies, healthchecks).

---

## 9. Everyday commands

```bash
# migrations
python manage.py migrate_schemas --shared      # public schema only
python manage.py migrate_schemas --tenant      # all tenant schemas
python manage.py migrate_schemas               # both

# create a tenant (once provisioning command exists)
python manage.py provision_school --name "Green Hills" --subdomain greenhills --admin-email head@greenhills.edu

# open a shell scoped to one tenant
python manage.py tenant_command shell --schema=school1
```
