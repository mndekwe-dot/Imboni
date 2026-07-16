# Imboni — School Management System

> **Status: Active Development** — All seven portals built and wired to the backend API. Now a multi-tenant SaaS: schema-per-tenant isolation, self-serve onboarding, subscription billing, and a vendor platform console. Backed by an automated test suite and CI (2026).

**Imboni Education Connects** is a full-stack, multi-role, **multi-tenant** school management platform built to digitise academic operations for secondary schools. It provides dedicated portals for every stakeholder — from the Director of Studies down to students and parents — each with role-appropriate data, actions, and workflows. A single deployment serves many schools, each isolated in its own database schema and reachable on its own subdomain.

---

## Screenshots

**Landing Page**
![Landing Page](/Screenshots/Screenshot%202026-03-24%20144243.png)

**Director of Studies — Dashboard**
![DOS Dashboard](/Screenshots/Screenshot%202026-03-24%20144355.png)

**Student Portal — Results**
![Student Portal](/Screenshots/Screenshot%202026-03-24%20144408.png)

**Mobile View — Responsive Design**
![Mobile View](/Screenshots/Screenshot%202026-03-24%20144429.png)

---

## Portals

| Role | Key Responsibilities |
|---|---|
| Director of Studies | Analytics, results approval, timetables, exam schedules, attendance overview |
| Teacher | Classes, attendance, results entry, assignments, timetable, messaging |
| Student | Timetable, results, assignments, attendance record, activities, discipline |
| Parent | Monitor children's results, attendance, behaviour, announcements |
| Discipline Master | Behaviour records, boarding, dining, student leaders, activities |
| Matron | Student welfare, health, incidents, schedule, messaging |
| Admin | Per-school administration — staff, students, announcements, approvals, reports, settings, billing, support |
| Platform (vendor) | Cross-school operator console — onboarding applications, contracts, revenue, expenses, support, health |

---

## Features

### Authentication & Access Control
- Invitation-based registration — users are invited by an admin, not self-registered
- Role-based permissions (DOS, Teacher, Student, Parent, Discipline, Matron)
- JWT token authentication
- Password reset via email with secure token links

### Director of Studies Portal
- **Dashboard** — school-wide KPIs at a glance
- **Analytics** — attendance trends, result distributions, class comparisons
- **Results Approval** — review and approve teacher-submitted results before publication
- **Teacher Management** — view all teaching staff, subjects, and class assignments
- **Student Management** — full student directory with academic standing
- **Attendance** — weekly attendance register per class, filterable by subject and year group
- **Exam Schedule** — plan and publish exam timetables for O-Level (S1–S3) and A-Level (S4–S6) with room allocation
- **Timetable** — weekly class timetable management
- **Announcements** — create and publish school-wide announcements by audience

### Teacher Portal
- Class roster and student profiles
- Mark attendance per lesson with daily/weekly/monthly/report views
- Enter and submit academic results per assignment
- Create and manage paper and online (auto-marked) assignments
- Weekly timetable view
- Direct messaging with parents and staff

### Student Portal
- Personal weekly timetable
- Results history and performance trends
- Assignment tracker (upcoming, submitted, graded)
- Attendance record
- School announcements
- Discipline record
- Co-curricular activities

### Parent Portal
- Monitor multiple children from one account
- View each child's results, attendance, behaviour reports
- Receive school announcements
- Direct communication with school

### Discipline Portal
- Student behaviour incident recording and management
- Boarding and dormitory management
- Dining schedule and meal planning
- Activity scheduling and tracking
- Student leader management
- Staff communication

### Matron Portal
- Student welfare and sick bay tracking
- Health and wellness records
- Incident reporting with parent notifications
- Daily schedule management
- Messaging with parents

### Cross-Cutting Features
- **Internal messaging** — one shared messaging system across all seven portals (contacts, conversations, live updates)
- **Notifications** — a generic notification backend feeding the header bell in every portal
- **Audit log** — tracked administrative actions
- **Session-aware identity** — every portal derives the real logged-in user; role-validated login per portal

---

## Multi-Tenant SaaS Platform

Imboni runs as a single deployment serving many schools, using **`django-tenants` schema-per-tenant isolation on PostgreSQL**. Each school lives in its own database schema and is routed by subdomain (`school1.imboni.app`), so no query can leak one school's data into another.

- **Self-serve onboarding** — a public `/signup` provisions a new school asynchronously (Celery): a schema is created, migrated, and seeded with an admin account in the background while the client polls to ready. Prospects can also `/apply` for operator review.
- **Subscription billing (Stripe)** — checkout, subscription lifecycle webhooks, and automatic suspend/restore. A suspended school is blocked at the middleware layer (HTTP 402) while still allowing login.
- **Plan limits & usage metering** — per-plan caps on students/staff (seats count active users *and* pending invitations, so mass-inviting can't bypass the cap); per-resource usage meters surface in the Admin billing page.
- **Platform super-admin console** — a separate vendor control plane (its own principal, JWT, and login) for onboarding applications, contracts (with auto-suspend lifecycle), revenue/expense tracking, a cross-school support inbox, and a live health dashboard. Isolated to the bare domain — 404s on any school subdomain.
- **Containerized** — `docker compose up --build` brings up Postgres, Redis, the API (Gunicorn), Celery worker + beat, and an Nginx front that serves the SPA and reverse-proxies the API with tenant-aware Host forwarding.

Full design and runbook: [`MULTI_TENANCY_GUIDE.md`](MULTI_TENANCY_GUIDE.md).

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 6 (Python 3.13) |
| API | Django REST Framework |
| Authentication | JWT (SimpleJWT); social auth (djoser + social-auth) |
| Database | PostgreSQL — schema-per-tenant multi-tenancy via `django-tenants` |
| Background jobs | Celery + Redis (provisioning, scheduled lifecycle tasks) |
| Payments | Stripe (subscriptions, webhooks) |
| PDF / documents | WeasyPrint, xhtml2pdf, ReportLab |
| Monitoring | Sentry |
| Email / SMS | Django SMTP email; Africa's Talking (SMS) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 |
| Routing | React Router v7 |
| HTTP Client | Axios (interceptors for JWT + global error handling) |
| Styling | Custom CSS — CSS variables, responsive grid, no UI library |
| Charts | Recharts |
| Icons | Google Material Symbols Rounded |
| Typography | Inter (Google Fonts) |
| Build tool | Vite |

### Infrastructure
| Component | Tool |
|---|---|
| Orchestration | Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) |
| Web server / reverse proxy | Nginx (serves the SPA, proxies the API, forwards Host for tenant routing) |
| Application server | Gunicorn |
| Task queue | Celery worker + beat, Redis broker |
| Database | PostgreSQL 16 |
| CI | GitHub Actions (tests + dependency vulnerability audits) |
| CDN & DDoS protection | Cloudflare (recommended) |
| SSL | Let's Encrypt via Certbot (recommended) |

---

## Project Structure

```
Imboni/
├── docker-compose.yml       # Full local stack: db, redis, backend, worker, beat, web
├── MULTI_TENANCY_GUIDE.md   # SaaS design + runbook
├── Backend/
│   ├── Dockerfile
│   ├── Imboni/              # Django project settings & URL routing (tenant + public URLconfs)
│   └── apps/
│       ├── tenants/         # Multi-tenancy: Client/Domain, onboarding, Stripe billing,
│       │                    #   plan limits, platform super-admin console, contracts
│       ├── authentication/  # User models, JWT auth, invitation system, password reset
│       ├── analytics/       # School-wide analytics endpoints
│       ├── announcements/   # Announcement CRUD and audience targeting
│       ├── attendance/      # Student and teacher attendance records
│       ├── audit/           # Administrative audit log
│       ├── behavior/        # Discipline and behaviour incidents
│       ├── discipline/      # Discipline master app
│       ├── dos/             # Director of Studies views and reports
│       ├── matron/          # Matron portal views
│       ├── messages/        # Internal messaging system (all portals)
│       ├── notifications/   # Generic notification backend (header bell)
│       ├── parents/         # Parent portal and child linking
│       ├── results/         # Academic results and approval workflow
│       ├── student/         # Student portal views
│       └── teacher/         # Teacher portal views
│
└── Frontend/                # React + Vite application
    ├── src/
    │   ├── api/             # One file per portal — all axios calls
    │   │   ├── client.js    # Axios instance with JWT interceptors
    │   │   ├── auth.js      # Login, logout, password reset
    │   │   └── account.js   # Profile, password change, avatar upload
    │   ├── hooks/           # Custom React hooks
    │   │   └── useAuth.jsx  # Login, logout, isAuthenticated
    │   ├── assets/          # Images and static files
    │   ├── components/      # Shared layout and UI components
    │   │   ├── layout/      # Sidebar, DashboardHeader, WelcomeBanner, etc.
    │   │   ├── ui/          # DataTable, Modal, ClassPicker, FilterBar, etc.
    │   │   └── ProtectedRoute.jsx  # Redirects to /login if no token
    │   ├── pages/           # Page components per portal
    │   │   ├── Admin/
    │   │   ├── Dis/         # Discipline portal
    │   │   ├── Dos/         # Director of Studies
    │   │   ├── Matron/
    │   │   ├── Parent/
    │   │   ├── Platform/    # Vendor super-admin console (+ sections/)
    │   │   ├── Student/
    │   │   ├── Teacher/
    │   │   ├── Signup.jsx   # Public self-serve school onboarding
    │   │   └── Apply.jsx    # Public prospect application
    │   └── styles/          # Per-portal and shared CSS files (utility-class based)
    ├── e2e/                 # Playwright end-to-end specs
    └── index.html
└── .github/workflows/ci.yml # Backend + frontend + E2E pipeline
```

---

## Getting Started

### Prerequisites
- Python 3.13
- Node.js 20+ (24 in CI)
- PostgreSQL 16 (required — `django-tenants` uses schemas; SQLite/MySQL won't work)
- Redis (for Celery background jobs)
- Docker + Docker Compose (optional, for the one-command stack)

### Option A — Docker (recommended)

Brings up Postgres, Redis, the API, Celery worker + beat, and Nginx in one command:

```bash
git clone https://github.com/mndekwe-dot/Imboni.git
cd Imboni
docker compose up --build

# In another terminal, provision your first school (creates its schema + admin):
docker compose exec backend python manage.py provision_school --help
```

The app is served through Nginx on `http://localhost/`. Because it's multi-tenant, each
school is reached on its own subdomain (e.g. `http://school1.localhost/`) — for local dev
without DNS, send a `Host: school1.localhost` header or add a hosts-file entry.

### Option B — Run services directly

**Backend**

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
venv\Scripts\activate           # Windows

# 2. Install dependencies
pip install -r Backend/requirements.txt

# 3. Configure environment (python-decouple reads Backend/Imboni/.env)
#    Point DATABASE_* at your local PostgreSQL; set THE_SECRET_KEY, etc.

# 4. Apply migrations across schemas, then provision a school
cd Backend
python manage.py migrate_schemas --shared
python manage.py provision_school --help

# 5. Start the API (plus `celery -A Imboni worker` and `beat` for background jobs)
python manage.py runserver
```

API available at `http://127.0.0.1:8000/`

**Frontend**

```bash
cd Frontend
npm install
npm run dev
```

App available at `http://localhost:5173/`

---

## Testing & CI

Every push and pull request runs the full pipeline in **GitHub Actions** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

| Suite | Stack | What it covers |
|---|---|---|
| Backend | `pytest` + `pytest-django` + coverage | Models, views, permissions, multi-tenant isolation, billing/plan gating |
| Frontend | Vitest + React Testing Library | Per-page component and integration tests |
| End-to-end | Playwright | Public flows (login, smoke) against a live dev server |

The pipeline also **fails the build on any known dependency vulnerability** — `pip-audit`
against `requirements.txt` (backend) and `npm audit --audit-level=high` (frontend) — and a
weekly scheduled run catches newly-disclosed CVEs in unchanged dependencies.

```bash
# Backend
cd Backend && python -m pytest -q

# Frontend unit/integration
cd Frontend && npm test

# Frontend end-to-end
cd Frontend && npm run e2e
```

---

## Roadmap

### Done
- [x] Multi-role authentication with invitation system
- [x] Director of Studies portal — analytics, results approval, exam schedule, timetable
- [x] Teacher portal — classes, attendance, results, assignments, timetable, messaging
- [x] Student, Parent, Discipline, Matron, Admin portals
- [x] React frontend — all portals fully built
- [x] Responsive design (mobile + tablet + desktop)
- [x] Shared component library (DataTable, Modal, ClassPicker, FilterBar, etc.)
- [x] JWT authentication — login, logout, protected routes, token interceptors
- [x] Portal-specific login pages with role validation
- [x] Profile page — load real user, edit profile, change password, avatar upload
- [x] Forgot password — sends real reset email via backend
- [x] **All seven portals connected to the backend API** (DOS, Teacher, Student, Parent, Discipline, Matron, Admin)
- [x] Internal messaging across all portals; header notification bell
- [x] School config management (subjects, rooms, timezone) via Admin settings
- [x] **Multi-tenancy** — schema-per-tenant isolation with `django-tenants`
- [x] Self-serve onboarding with async (Celery) school provisioning
- [x] Stripe subscription billing, plan limits, and usage metering
- [x] Platform super-admin console (applications, contracts, revenue, expenses, support, health)
- [x] Docker Compose stack (Postgres, Redis, API, worker, beat, Nginx)
- [x] Automated test suite + CI with dependency vulnerability auditing

### In Progress / Next
- [ ] Wire the shared messaging backend into the remaining `*Messages` pages
- [ ] Academic term tracking
- [ ] Auto-generators (class timetable, exam schedule) — queued via Celery

### Planned
- [ ] Real-time notifications (WebSockets)
- [ ] School branding / media / backups per tenant
- [ ] Switch token storage from localStorage to httpOnly cookies

---

## Design Decisions

**Why invitation-based auth instead of open registration?**
A school is a closed community. Teachers, students, and parents should be added by an administrator — not self-register. This prevents unauthorized access and ensures every account is tied to a real person.

**Why Django REST Framework?**
Django's ORM and DRF together make it easy to write clean, testable, permission-aware API endpoints. The permission system maps cleanly onto the multi-role structure of a school.

**Why custom CSS instead of Tailwind or a UI library?**
The design system uses CSS variables throughout, giving full control over every token (color, spacing, radius, shadow) per portal. Styling is applied through a shared utility-class layer plus per-portal stylesheets (rather than inline styles), so the look stays consistent and the bundle stays small — with no third-party class names leaking into the markup.

**Why schema-per-tenant instead of a `school_id` column?**
Row-level isolation would mean auditing every query and every singleton for a missing tenant filter — a permanent leak risk, especially with children's data. `django-tenants` gives each school its own PostgreSQL schema, so isolation is enforced by the database and routing, not by remembering to filter. It suits the target scale (a modest number of schools) and keeps per-school data cleanly separable for backups and export.

**Why axios instead of fetch?**
Axios interceptors allow attaching the JWT token to every request in one place and handling 401 errors globally — no repetition across 50+ API calls. When the project scales to React Query, axios works seamlessly as the fetcher.

**Why portal-specific login pages?**
Each portal has its own login URL (`/login/dos`, `/login/teacher`, etc.) and the backend validates that the user's role matches the portal before issuing a token. A student cannot log into the DOS portal even with valid credentials.

---

## Author

Built by **NDEKWE Dieu Merci**
Rwanda | 2025–2026

---

## License

This project is private and not licensed for redistribution.
