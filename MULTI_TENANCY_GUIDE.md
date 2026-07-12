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

### Phase 2 — Onboarding / provisioning — ✅ DONE (commit 33e2d5b)

- [x] One `provision_tenant()` service (`apps/tenants/services.py`) creates `Client` + `Domain`,
      runs tenant migrations (auto_create_schema), seeds the admin; subdomain validation
      (format + reserved blocklist + uniqueness). Backs both entry points below.
- [x] Management command `provision_school` **and** a self-serve API
      `POST /imboni/onboarding/signup/` (`apps/tenants/onboarding.py`, `AllowAny`), best-effort
      welcome email, returns the new school URL.
- [x] `PUBLIC_SCHEMA_URLCONF` (`Imboni/urls_public.py`): the bare domain serves onboarding +
      the platform API; subdomains serve the full app. **This also wires the platform API**
      (Phase 5 code) to a URL — though its `IsAdminUser` still needs a shared-schema platform
      user model before anyone can authenticate to it.
- [x] Public `/signup` page on the frontend. Verified e2e through nginx: signup → live schema,
      new admin logs in on its subdomain (200) and 401 elsewhere; all validation paths → 400.
- [x] **Async provisioning (commit 77716c9):** signup records a `TenantProvision` row,
      dispatches `provision_school_task` (Celery) and returns **202** + a status URL; the worker
      builds the schema in the background and the frontend polls to `ready`. Password is hashed
      in the request and passed to the task as a hash (never persisted). Verified: 202 in ~0.5s,
      worker provisions in ~11s. (`GET /imboni/onboarding/status/<uuid>/`.)

### Phase 3 — Billing & access enforcement (the "rent or buy") — ✅ SCAFFOLDED (commit 6b02f28)

- [x] `Client` has `plan` + `status` (+ `stripe_customer_id`/`stripe_subscription_id`, migration 0003).
- [x] Stripe: `CheckoutView` (tenant, admin) starts a subscription Checkout session;
      `StripeWebhookView` (public/bare domain) maps `checkout.session.completed` /
      `customer.subscription.*` / `invoice.payment_failed` → `Client.status`.
      `map_subscription_status()` is a pure, unit-tested map. `BillingStatusView` (tenant)
      returns plan/status/`stripe_enabled`.
- [x] Middleware already blocks/degrades on status (`SubscriptionStatusMiddleware`:
      suspended → 402, past_due → header). Verified end-to-end via a **dev-mode webhook**
      (trusts payload when `STRIPE_WEBHOOK_SECRET` is unset): `subscription.deleted` → 402,
      `subscription.updated (active)` → restored.
- [ ] **To go live:** set real Stripe test keys + `STRIPE_PRICE_BASIC/PREMIUM` price IDs and
      exercise live Checkout; point a Stripe webhook at `/imboni/billing/webhook/` with a secret.
- [ ] **Frontend:** admin Billing page (plan cards + upgrade button → checkout redirect).

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

### Phase 8 — Full containerization (Docker) — ✅ DONE (commit 27b4e22)

Whole stack runs in containers; verified end-to-end through nginx on :80.

- [x] **Backend `Dockerfile`** (`python:3.13-slim`) — cairo/pango + `pkg-config` + `libcairo2-dev`
      (pycairo builds) + `postgresql-client`; gunicorn; `entrypoint.sh` waits for db, runs
      `migrate_schemas --shared`, seeds the public tenant.
- [x] **Frontend `Dockerfile`** — multi-stage `node:22` (rolldown-vite needs ≥22.12) → `nginx:alpine`.
- [x] **Full `docker-compose.yml`** — `db` (postgres:16), `redis`, `backend` (gunicorn),
      `worker` + `beat` (Celery), `web` (nginx serves SPA + reverse-proxies API). nginx forwards
      the `Host` header so `TenantMainMiddleware` routes subdomains. Healthchecks + startup order.
- [x] **Env wiring** — compose env (`DATABASE_HOST=db`, `CELERY_BROKER_URL=redis://redis:6379/0`,
      `SECURE_SSL_REDIRECT=False` for local http); secrets out of the image via `.dockerignore`.
- [x] **Volumes** — named `imboni_pgdata` + `imboni_media`.
- [x] **One image, all tenants** — same backend image for every school; subdomain routing at nginx +
      `TenantMainMiddleware`.
- [ ] Optional production override (`docker-compose.prod.yml`: TLS termination + `X-Forwarded-Proto=https`
      so `SECURE_SSL_REDIRECT` can go back on, no code bind-mounts, restart policies).

**Run it:**
```bash
docker compose up --build -d
docker compose exec backend python manage.py provision_school \
    --name "Green Hills" --subdomain school1 --admin-email admin@school1.com
curl -H "Host: school1.localhost" http://localhost/                       # SPA
curl -X POST -H "Host: school1.localhost" -H "Content-Type: application/json" \
     -d '{"email":"admin@school1.com","password":"changeme123"}' \
     http://localhost/imboni/auth/login/                                   # 200
```
Build gotchas already handled: node 22 (not 20) for rolldown-vite; `npm install` (the Windows
`package-lock.json` lacks Linux optional deps that strict `npm ci` demands); backend needs
`pkg-config`+`libcairo2-dev` to compile `pycairo`.

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
