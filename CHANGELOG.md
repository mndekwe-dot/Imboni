# Changelog

All notable changes to Imboni, a multi-tenant school management platform for
Rwandan secondary schools.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**A note on versions.** This repository carries no git tags, so the entries
below are *milestones* reconstructed from the commit history, not tagged
releases. Each heading is dated with the day that body of work landed on
`main`. If you start tagging, the natural first tag is `v1.0.0` at
`2026-07-19`, the point at which every planned SaaS phase was complete.

---

## [Unreleased]

Work in the tree, not yet committed.

### Fixed

- **Tenant schemas are migrated on every container boot.** The Docker
  entrypoint ran only `migrate_schemas --shared`, which touches the public
  schema. A tenant schema was migrated exactly once, at provisioning time by
  `Client.save()`, and never again — so any migration shipped in a `TENANT_APPS`
  app left every existing school running against stale tables until someone
  remembered to intervene by hand. Seven such migrations (`discipline.0010`,
  `dos.0005`-`0007`, `results.0005`-`0006`, `teacher.0008`) were found pending
  across all six live schemas. The entrypoint now runs `migrate_schemas
  --tenant` after seeding the public tenant, making a deploy self-healing.

### Added

- **`seed_demo_schools` management command** — populates each demo tenant with
  its own distinct school rather than six copies of the same one. Six profiles
  vary by size, year range, gender mix, boarding arrangement, subject emphasis
  and subscription state, so clicking between subdomains shows six different
  institutions. Fills the models added after `seed_all` was written:
  `TimetablePeriod`, `Dormitory`/`DormRoom`, `DutyPost`/`DutyAssignment`,
  `DiningSitting`/`DiningAssignment`, and the subject scheduling weights the
  DOS auto-generators read.
- **`apps/tenants/school_profiles.py`** — the school identities as data,
  separate from the generator's logic, so a profile can be retuned without
  reading the seeding code.

### Changed

- Documented the `migrate_schemas` flag distinction in `README.md` and
  `DOCUMENTATION.md`: `--shared` reaches only the public schema, so a
  `TENANT_APPS` migration needs `--tenant` (or no flag) to reach schools that
  already exist.
- Corrected stale comments that described behaviour the code no longer had:
  the `VITE_API_BASE` note in `Frontend/Dockerfile` (an empty string means
  same-origin and has for some time), the gunicorn references in
  `docker-compose.yml` (the stack runs uvicorn), and the "provisioning should
  move to Celery" note in `apps/tenants/services.py` (self-serve signup has
  been async since 2026-07-12).

---

## 2026-08-03 — Deployment tooling

### Added

- `deploy.sh` and an Oracle Free Tier setup runbook for standing the stack up
  on a single always-free ARM instance.

---

## 2026-07-19 — Auto-generators and real-time delivery

The last planned feature wave. Every scheduling task a Director of Studies
previously did by hand now has a generator behind it.

### Added

- **Real-time notifications over WebSockets** (Django Channels). The same ASGI
  process serves HTTP and `/imboni/ws/notifications/`. Because a browser cannot
  set an `Authorization` header on a handshake, the consumer validates a
  query-string JWT itself and re-derives the tenant from the handshake `Host` —
  `TenantMainMiddleware` never runs for WebSocket connections. Channel groups
  are namespaced by a digest of schema and user id, so no bug in group
  bookkeeping can cross-deliver between schools.
- **Duty roster auto-generator** — fair round-robin across staff.
- **Dining planner auto-generator** — greedy first-fit decreasing over sitting
  capacity.
- **Dormitory assignment generator** — first-fit decreasing.
- **Drag-and-drop exam rescheduling.**

### Fixed

- The WebSocket test fixture polluted the shared test schema.

### Changed

- Removed em and en dashes from all user-visible text, frontend and backend.

---

## 2026-07-16 — Scheduling engines and documentation

### Added

- **Exam schedule auto-generator** using DSatur graph colouring — models the
  timetable as a conflict graph and colours it, so no student sits two papers
  at once.
- **Class timetable auto-generator** using CSP backtracking.
- **Subject weights** (`exam_weight`, `timetable_weight`) that steer both
  generators: heavier subjects are placed first when the window is tight and
  prefer earlier slots.
- `DOCUMENTATION.md` — full technical documentation.

### Fixed

- CI backend job ran MySQL; switched to Postgres 16 to match django-tenants,
  which cannot run on MySQL or SQLite at all.
- Bumped Pillow 12.2.0 to 12.3.0, clearing eight known CVEs.

### Changed

- Added ruff and eslint gates plus a coverage floor to CI. The new gates caught
  three real bugs, fixed in the same change.

---

## 2026-07-12 — Multi-tenant SaaS, phases 2 through 8

The largest single day in the project's history: the platform went from a
single-school application to a subscription SaaS.

### Added

- **Containerized stack** (Phase 8) — Postgres, Redis, backend, Celery worker
  and beat, and an nginx service that serves the SPA and reverse-proxies the
  API on each school's subdomain, forwarding the `Host` header so
  `TenantMainMiddleware` can route by it. Plus a production compose override.
- **Self-serve school signup** (Phase 2) — public, unauthenticated, returning
  202 immediately and provisioning asynchronously through Celery so the request
  never blocks on a schema migration.
- **Stripe subscription scaffolding** (Phase 3) — checkout, customer portal and
  webhook, with an admin Billing page. Entirely optional: with no keys set the
  endpoints report "not configured" rather than erroring.
- **Plan limits and usage metering** (Phase 4).
- **Vendor super-admin console** (Phase 5) and an **operations dashboard** with
  finance and a support desk (Phase 6).
- **School applications** — apply, review, provision (Phase 7.1); **contracts
  and lifecycle** enforcement (Phase 7.2); **school overview and platform
  health** (Phase 7.3-7.4).

### Fixed

- The React admin portal and Django admin both claimed `/admin/*`. Django admin
  moved to `/django-admin/`.
- `/login` was non-functional and failed silently instead of surfacing errors.
- Platform route guards resolved asynchronously, briefly exposing the console.

---

## 2026-07-11 — Multi-tenancy foundation

### Added

- **Schema-per-tenant isolation** via django-tenants. Each school gets its own
  Postgres schema; `SHARED_APPS` holds the tenant registry and table-less
  third-party libraries, while every app carrying school data lives in
  `TENANT_APPS`. The custom `User` model is deliberately tenant-scoped, so each
  school has entirely separate users, logins and invitations.
- Tenant subdomain detection on the frontend.
- A tenant-aware pytest harness; the backup command was ported to Postgres.

---

## 2026-07-10 — Hardening for pilot

### Added

- **TOTP two-factor authentication**, backend and frontend.
- **Sentry error monitoring**. `send_default_pii` is left off deliberately and
  permanently: this application holds minors' grades, medical and disciplinary
  records, and error reports must never carry them.
- **Data-protection basics** — automated backups, a data-erasure command, and a
  privacy policy.
- **Bulk import** of classes and timetables for new-school setup.
- **Playwright end-to-end tests** for login and smoke flows.
- End-user guides for all seven portals.

### Performance

- **Code-split every portal route**: 2 MB first load down to 479 kB.
- Added database indexes for the hottest filter and ordering patterns.

### Security

- Fixed dependency CVEs and added audit gates to CI.
- `debug_toolbar` URLs are now wired only when `DEBUG=True`; importing them
  otherwise crashed a production start.

### Accessibility

- First pass on shared layout components.

---

## 2026-07-05 — Background jobs, offline, messaging

### Added

- **Celery integration** for background tasks and scheduling, with a beat
  schedule for due-date reminders, the weekly parent digest, nightly database
  backups and contract lifecycle enforcement.
- **Offline-first PWA** — precached app shell, a read-through cache for GETs
  and an outbox that queues idempotent writes (attendance marking, medication
  administration, night checks) and replays them on reconnect. API traffic is
  deliberately kept away from the service worker and handled by the Dexie layer.
- **Real messaging backend** with a staff-mediated safeguarding policy, wired
  into all seven portals.
- CI running backend pytest and frontend vitest plus a build on every push.

### Security

- Closed a privilege-escalation hole ahead of the pilot.

### Performance

- Fixed N+1 queries on the hottest list endpoints.

---

## 2026-07-02 — Portal feature wave

### Added

- Real-time absence notifications to parents; automatic parent notification when
  a serious or critical incident is filed.
- Teacher and room **double-booking detection** when saving timetable slots.
- Automatic escalation to a required parent meeting after three conduct reports.
- An **audit log** of sensitive administrative actions.
- Graded-quiz review with answers and explanations for students.
- A grading queue for paper assignments, and question-bank sharing between
  teachers.
- Performance trend charts for teachers and students; an at-risk student flag
  in DOS Analytics.
- Dormitory occupancy board; medication schedule with a daily dose checklist.
- Permission and consent requests between parents and the discipline office.
- Report card PDF download, and a guided term-rollover wizard.

---

## 2026-06-28 — Test infrastructure and the bug sweep it exposed

Adding tests immediately surfaced a run of real defects, several serious.

### Added

- pytest infrastructure for the whole backend, then **228 tests** across
  authentication, DOS, teacher, student, discipline, matron, results,
  attendance, behavior, announcements, messages and analytics.
- Vitest and React Testing Library infrastructure, then coverage for API
  modules, hooks, utils, shared components and every portal.

### Fixed

- **A critical data-isolation vulnerability in the parents app** — plus three
  related bugs.
- A result-approval permission gap in DOS, and a teacher search crash.
- Conversation membership was not enforced in messaging.
- `StudentProfileView` and `StudentResultsView` crashed unconditionally.
- Grade-specific announcement targeting had never worked.
- Router ordering and class-ownership scoping in the teacher app.
- A form-encoded `admitted: False` was read as truthy by the matron app.
- Roughly a dozen frontend defects: double response unwrapping, timezone-unsafe
  date arithmetic, wrong React list keys, and a series of unassociated form
  labels.

---

## 2026-06-25 — Notifications and real sessions

### Added

- Generic cross-portal notifications backend, frontend API and hook, wired into
  every portal page.
- `useSessionUser`; the DOS, Discipline, Matron and Parent portals moved off
  placeholder data onto the real session.
- `cleanup_invitations` management command.
- Password reset confirmation page, a redesigned 404, and a reusable loading
  spinner.

### Fixed

- Login showed a generic message instead of the backend's real error.
- The student list loaded the entire school roster client-side.
- Dropdowns were clipped inside modal dialogs.

---

## 2026-06-01 — Scheduling and facilities

### Added

- Teacher attendance.
- Room management in DOS settings and timetable.
- Exam scheduling with custom session management and printing.
- Discipline reports management and facility management.
- Matron boarding schedule management.

---

## 2026-05-13 — Authentication and API integration

The frontend stopped being a mockup.

### Added

- Authentication API and `PortalLogin`; `ProtectedRoute` and `useAuth`.
- Password reset and account management, including avatar upload.
- Academic term endpoints and a singleton `SchoolSetting` model carrying the
  school's timezone and name, with a DOS-only settings endpoint. Every
  inline-header page now shows the date in the *school's* timezone rather than
  the browser's.
- Discipline, matron, parent, student and teacher API endpoints.
- Teacher invitation and registration flow; student invitations with single and
  bulk upload, class assignment and history tracking.
- Student detail view with suspend, class change and leader appointment.

---

## 2026-04-21 — React frontend

### Added

- Vite configuration, Vercel URL rewrites, and a mobile-capable sidebar.
- Reusable `DataTable` with pagination.
- Performance charts and stat cards on the Admin, DOS and Teacher dashboards.
- Add-student modal and CSV export.

---

## 2026-03-17 — Role-based portals and invitation auth

### Added

- Role-based portals, avatar validation, password reset and email templates.
- **Invitation-based authentication** with multi-channel delivery.

### Changed

- All Django apps moved into `apps/`.
- The `students` app was renamed `parent`, with foreign keys repointed from
  `parents.Student` to `student.Student`.

### Security

- Removed a duplicate `DEFAULT_PERMISSION_CLASSES` that overrode
  `IsAuthenticated` with `AllowAny`, leaving every endpoint unprotected by
  default.

---

## 2026-02-17 — Initial models

### Added

- Core data models; auth and student app migrations; the first student
  endpoints and sample data.
