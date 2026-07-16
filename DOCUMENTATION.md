# Imboni — Project Documentation

Technical documentation for the Imboni school-management platform: what the
system is, how it's architected, and where everything lives. For hands-on
learning material that teaches each underlying concept, see the guides in
`Guides/` (local study material, indexed by `Guides/README.md`). For end-user
manuals per portal, see [`Docs/user-guides/`](Docs/user-guides/).

- **Stack:** Django 6 / DRF / PostgreSQL (django-tenants) / Celery + Redis —
  React 19 / Vite / custom CSS — Docker Compose / nginx / GitHub Actions
- **Shape:** one deployment, many schools; each school is an isolated
  PostgreSQL schema reachable on its own subdomain.

---

## 1. System overview

Imboni is a **multi-tenant SaaS** school-management system. Two very different
kinds of users exist:

- **School users** — seven role-based portals per school: Director of Studies
  (DOS), Teacher, Student, Parent, Discipline, Matron, Admin. They log in on
  the *school's subdomain* (`greenhills.example.com`).
- **Platform operators** (the vendor) — a separate console on the *bare
  domain* for onboarding applications, contracts, revenue/expenses, support,
  and platform health.

A school signs up (self-serve `/signup` or operator-approved `/apply`), a
background job provisions its schema, and its admin invites staff, students,
and parents — there is **no open registration**; every account starts as an
invitation.

## 2. Architecture

### 2.1 Runtime topology (docker-compose)

```
                    browser
                       │ :80/:443
                 ┌─────▼─────┐
                 │ web·nginx │  serves the built SPA; proxies /imboni/* and
                 └─────┬─────┘  /django-admin/ to the backend, forwarding Host
                       │
                 ┌─────▼─────┐      ┌───────┐
                 │  backend  │◄────►│ redis │  db0 celery broker · db1 results
                 │ gunicorn  │      └───▲───┘  db2 django cache
                 └─────┬─────┘          │
                 ┌─────▼─────┐   ┌──────┴──────┐
                 │ postgres16│   │ worker/beat │  celery (provisioning, emails,
                 └───────────┘   └─────────────┘  daily contract lifecycle)
```

`docker compose up --build` starts all six services; the backend entrypoint
waits for Postgres, applies shared migrations, and seeds the public tenant —
no manual DB steps. (`docker-compose.prod.yml` holds production overrides.)

### 2.2 Multi-tenancy (the load-bearing design decision)

django-tenants gives every school its **own PostgreSQL schema**; isolation is
enforced by the database + routing, not by per-query filtering:

- `SHARED_APPS` live in the `public` schema — the platform layer:
  `apps.tenants` (Client/Domain/billing/platform models) and framework tables.
- `TENANT_APPS` are created inside **every school's schema** — including
  `apps.authentication`: *users exist per school*; the same email at two
  schools is two unrelated accounts.
- `TenantMainMiddleware` resolves the schema from the request's Host
  (subdomain). The bare domain serves `Imboni/urls_public.py` (onboarding,
  platform API, Stripe webhook); subdomains serve the app (`Imboni/urls.py`).
- Request lifecycle: `Host: school1.…` → tenant lookup → connection
  `search_path` set to the school's schema → every ORM query is scoped.

Full design + runbook: [MULTI_TENANCY_GUIDE.md](MULTI_TENANCY_GUIDE.md).

### 2.3 Tenant lifecycle

`provision_tenant()` (`apps/tenants/services.py`) is the single provisioning
path, used by the `provision_school` management command, self-serve signup
(async via Celery: signup returns 202 + a status URL the frontend polls), and
operator-approved applications. Suspension is enforced by
`SubscriptionStatusMiddleware`: suspended school → HTTP 402 on everything but
login; `past_due` → warning header. Suspension can come from Stripe webhooks
or the daily contract-lifecycle beat task.

## 3. Backend

### 3.1 Django apps

| App (`Backend/apps/`) | Owns |
|---|---|
| `tenants` | **Public schema.** Client/Domain, onboarding + applications, Stripe billing, plan limits & metering, platform auth (`PlatformUser` + platform-claim JWT), operator console APIs (schools, contracts, payments, expenses, support, health), contract lifecycle |
| `authentication` | **Tenant.** Custom `User` (role field), invitations, portal-aware login (+ rate throttle), JWT (SimpleJWT), 2FA (TOTP/pyotp), password reset, preferences |
| `student` | Student records |
| `teacher` | `Class`, `ClassAssignment`, `SubjectTeacherAssignment` (+ `periods_per_week`), `Timetable`, teacher tasks/reminders, assignments & submissions, question bank |
| `results` | `Subject`, `AcademicTerm`, `Result` (+ approval workflow), assessments |
| `attendance` | Student & teacher attendance |
| `behavior` | Discipline incidents, conduct grades |
| `announcements` | Announcements with audience targeting |
| `messages` | Cross-portal messaging (contacts, conversations) |
| `notifications` | Generic per-user notifications (the header bell, all portals) |
| `dos` | DOS dashboards/analytics, exam schedules, rooms, school config/settings, PDF report cards & CSV exports, **scheduling generators** (`apps/dos/scheduling/`) |
| `analytics` | School-wide analytics endpoints |
| `discipline`, `matron`, `parents` | Those portals' views/models |
| `audit` | Administrative audit log |

### 3.2 API conventions

- All app endpoints under **`/imboni/…`** (e.g. `/imboni/dos/students/`);
  Django admin at `/django-admin/` (the React admin portal owns `/admin/*`).
- DRF defaults: JWT auth on everything (views opt out explicitly),
  `IsAuthenticated`, PageNumberPagination (20), django-filter,
  `COERCE_DECIMAL_TO_STRING=False` (money comes back as numbers).
- Role gating via permission classes in `apps/authentication/permissions.py`
  (`IsDOS`, `IsDOSOrAdmin`, `IsTeacherOrDOS`, …) — one per role combination.
- Platform endpoints are public-schema only and require the `platform` JWT
  claim — school tokens are rejected and vice versa; they 404 on subdomains.

### 3.3 Authentication model

- SimpleJWT: 60-min access / 7-day refresh, **rotation + blacklist** enabled,
  `Bearer` header. Login is portal-aware (`PORTAL_ROLES` — a student cannot
  log into the DOS portal) and rate-throttled with counters in Redis.
- Optional TOTP 2FA per user (`TwoFactorConfig`, QR provisioning).
- Invitation-only account creation, tracked per role; plan limits count
  pending invitations as occupied seats.

### 3.4 Billing & plans

Stripe Checkout (hosted) + webhook → `Client.status` mapping
(`map_subscription_status()`), `Payment` recorded idempotently. Plans:
free 50 students/10 staff · basic 500/50 · premium unlimited; unknown plan →
most restrictive. `enforce_capacity()` gates every roster-growing endpoint
(HTTP 402); `capacity_snapshot()` feeds Admin Billing usage meters. All
`STRIPE_*` config optional — billing disabled cleanly when unset. Contract
schools are handled by `Contract` + daily auto-suspend lifecycle.

### 3.5 Scheduling auto-generators (`apps/dos/scheduling/`)

Three-layer architecture, both generators:

```
*_api.py      DRF: validation, IsDOSOrAdmin, preview + commit endpoints
*_service.py  ORM in → plain data → solver → persist (atomic, replace-style)
*_solver.py   pure algorithms, no Django — unit-tested, Celery-ready
```

- **Exam scheduler** — bounded-capacity **DSatur graph colouring**; exams from
  `SubjectTeacherAssignment`, slot capacity = active `Room`s, invigilator
  prefers the subject teacher. `POST /imboni/dos/exam-schedule/generate/`
  (preview) and `…/generate/commit/`.
- **Timetable generator** — **CSP backtracking** (MRV + subject-spread
  ordering); inputs: `periods_per_week` per (class, subject) and the
  `TimetablePeriod` bell grid (breaks excluded); rooms round-robin per slot.
  `POST /imboni/dos/timetable/generate/` + `…/generate/commit/`.
- Both are deterministic (preview == commit) and report unplaceable items
  instead of failing.

### 3.6 Background jobs (Celery)

Redis broker; worker + beat services in compose. Current tasks: async tenant
provisioning (`provision_school_task`), daily contract lifecycle enforcement
(beat, 03:00). `CELERY_TASK_ALWAYS_EAGER=True` in tests/CI runs tasks inline.

### 3.7 Reports

`apps/dos/report_views.py`: single-student report card (Django template →
xhtml2pdf → `application/pdf`), whole-class zip of PDFs, and CSV results
export. Template: `Backend/templates/reports/report_card.html`.

## 4. Frontend

### 4.1 Structure (`Frontend/src/`)

- `api/` — one module per portal; `client.js` is the axios instance:
  JWT attachment, global 401 handling, **offline layer** (GET responses cached
  in IndexedDB and served on network failure; queued writes replayed on
  reconnect; `/auth/` never cached).
- `pages/<Portal>/` — Admin, Dos, Teacher, Student, Parent, Dis, Matron,
  Platform (+ `sections/`), plus public pages (LandingPage, PortalLogin,
  Signup, Apply, TeacherRegistration, reset password, 404).
- `components/` — `layout/` (Sidebar, DashboardHeader…), `ui/` (DataTable,
  Modal on native `<dialog>`, Select, Loading…), `messaging/` (shared
  LiveMessages/MessagesPage used by all seven portals), `ProtectedRoute`.
- `hooks/` — `useAuth`, `useSessionUser` (real logged-in identity),
  `useNotifications`, `useSchoolSettings`.
- `context/` — `ToastContext` (the error-surfacing convention: failures are
  never silent; they toast).
- `styles/` — design tokens in `index.css`; global `u-*` utilities
  (`utilities.css`); shared component styles; one stylesheet per portal with
  prefixed classes. **No static inline styles in pages** — only data-driven
  values (widths/colors computed from data, CSS-variable passes).

### 4.2 Tenancy & auth on the client

The SPA is served per subdomain; same-origin API calls carry the Host that
selects the schema. Tokens live in `localStorage` (`imboni_access` /
`imboni_refresh`; platform console uses separate `imboni_platform_*` keys).
Each portal has its own login route (`/login/dos`, `/login/teacher`, …) and
the backend enforces the portal↔role match. PWA: Workbox service worker
precaches the app shell (hard-refresh after a rebuild if the UI looks stale).

## 5. Testing

| Layer | Tool | Where | Notes |
|---|---|---|---|
| Backend | pytest + pytest-django + factory_boy | `Backend/apps/**/test*.py` | 441 tests. `conftest.py` builds a `test` tenant on domain `testserver` and pins the connection — the multi-tenant harness. Name files `test_*.py` (`tests_*.py` is **not** collected) |
| Frontend | Vitest + React Testing Library | `src/**/*.test.jsx` | jsdom; polyfills in `src/test/setup.js` (scrollTo, `<dialog>`); run with `--no-file-parallelism` (parallel runs time out) |
| E2E | Playwright | `Frontend/e2e/` | Real Chromium; boots the dev server itself; backend mocked at the network layer (`page.route`) |

```bash
cd Backend  && python -m pytest -q                      # needs Postgres on 5432
cd Frontend && npm test                                 # vitest, serial
cd Frontend && npm run e2e                              # playwright
```

Local Postgres for tests (compose's db isn't published to the host):
`docker run -d --name imboni-testpg -e POSTGRES_USER=imboni -e POSTGRES_PASSWORD=imboni -e POSTGRES_DB=imboni -p 5432:5432 postgres:16`

## 6. CI (GitHub Actions)

`.github/workflows/ci.yml` — three parallel jobs on push/PR to main (+ weekly
cron for fresh CVEs):

1. **Backend** — postgres:16 service container → `pip-audit` (fails on any
   known CVE) → `manage.py check` → `migrate_schemas --shared` → full pytest.
2. **Frontend** — `npm audit --audit-level=high` → vitest → production build.
3. **E2E** — Playwright Chromium; uploads the HTML report as an artifact on
   failure.

## 7. Configuration

Read via python-decouple from **`Backend/Imboni/.env`** (next to settings.py —
not `Backend/.env`; gitignored):

| Variable | Purpose |
|---|---|
| `THE_SECRET_KEY` | Django/JWT signing key |
| `MY_DEBUG`, `ALLOWED_HOSTS` | `.localhost` in ALLOWED_HOSTS enables `*.localhost` subdomains in dev |
| `DATABASE_NAME/USER/PASSWORD/HOST/PORT` | PostgreSQL (required — engine is `django_tenants.postgresql_backend`) |
| `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Redis db0/db1 |
| `REDIS_CACHE_URL` | Redis db2; unset → LocMemCache (dev/test) |
| `STRIPE_SECRET_KEY / PUBLISHABLE_KEY / WEBHOOK_SECRET / PRICE_BASIC / PRICE_PREMIUM` | All optional; billing disabled when unset |
| `CORS_ALLOWED_ORIGINS`, `SECURE_SSL_REDIRECT` | Production hardening |
| Email (`EMAIL_*`), Sentry DSN | SMTP + monitoring |

Frontend: `VITE_API_BASE` (empty = same-origin through nginx).

## 8. Operations quick-reference

```bash
# Full local stack
docker compose up --build
# Create a school (schema + admin)
docker compose exec backend python manage.py provision_school \
    --name "Green Hills" --subdomain school1 --admin-email admin@school1.com
# Reach it: http://school1.localhost/ (hosts-file entry or Host header)
# Platform operator account
docker compose exec backend python manage.py create_platform_user --email ... --password ...
# Invitation cleanup / contract enforcement
python manage.py cleanup_invitations --dry-run
python manage.py enforce_contracts
# After changing backend code: rebuild ALL images that share it
docker compose build backend worker beat
```

Deployment runbook (server, TLS, backups, go-live checklist):
`Guides/Backend/DEPLOYMENT_GUIDE.md` (local).

## 9. Known constraints & gotchas

- **Postgres only** — django-tenants cannot run on SQLite/MySQL (CI and
  compose both use postgres:16).
- Plain `manage.py migrate` is disabled; use `migrate_schemas` (the Docker
  entrypoint and CI already do).
- Tenant-specific cache keys must embed `connection.schema_name` — a bare key
  is shared across schools.
- JWTs in `localStorage` (XSS-readable); httpOnly-cookie migration is on the
  roadmap. Mitigations in place: 60-min access, rotation, blacklist.
- The custom `<Select>` is clipped inside `showModal()` dialogs unless
  portalled to the dialog (fixed in the shared component; `TimetableEditForm`
  still uses native selects).
- Windows-generated `package-lock.json` lacks Linux-only optionals — CI uses
  `npm install`, not `npm ci`.
- Full backend suite needs ~30 min serial; frontend suite must run
  `--no-file-parallelism`.

## 10. Documentation map

| Audience | Where |
|---|---|
| Anyone — what is this project? | [README.md](README.md) |
| Developers — this file | DOCUMENTATION.md |
| Multi-tenancy deep dive | [MULTI_TENANCY_GUIDE.md](MULTI_TENANCY_GUIDE.md) |
| Learning guides (concept courses) | `Guides/` + `Guides/README.md` (local study material) |
| End-user manuals (per portal) | [Docs/user-guides/](Docs/user-guides/) |
| Accessibility notes | [Docs/ACCESSIBILITY.md](Docs/ACCESSIBILITY.md) |
| Privacy policy | [PRIVACY_POLICY.md](PRIVACY_POLICY.md) |
