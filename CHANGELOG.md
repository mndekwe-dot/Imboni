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

## 2026-08-24 — Exam papers, and the walls between portals

### Added

- **A teacher can write an exam paper, and the DOS approves it before it is
  printed.** The paper is divided into sections, each with its own instruction
  and its own "answer any three of six" rule, which is how papers are actually
  written here — and which changes what the paper is out of. A section where
  the candidate answers three of six is worth three questions, not six;
  counting all six would overstate the paper and quietly break every
  percentage taken from it afterwards. The rule is computed identically on
  both sides so the running total a teacher sees while writing matches the
  total printed on the paper.

  Once a paper is handed up it becomes read-only to its author: approving one
  version while the author edits another is how a school ends up printing a
  paper nobody approved. Sending it back requires a reason — a refusal without
  one makes the teacher guess, and they will guess wrong — and returns control
  to them. The DOS gets every paper in the school in one list, opening on the
  ones waiting, and prints two documents from the same data: the question
  paper, and the marking scheme, which is the same paper with the answers left
  in. A paper that has not been approved still prints, watermarked on every
  page, because the DOS reads on paper too.

  Question editing reuses the existing editor rather than growing a second one;
  it gained a `types` prop so an exam can also offer essay, structured,
  matching and code questions, which a machine cannot mark and a person will.

- **A paper can hold what the subject actually needs.** Sub-questions — (a),
  (b), (c) — because that is how most structured questions are set, with marks
  on the part and the stem showing their sum. A shared stimulus per section, so
  a comprehension passage, a historical source or a data table prints once
  above the questions that refer to it rather than being pasted into the first
  one. Answer space chosen per question — ruled lines, a blank box to work a
  calculation in, or a graph grid — because a paper printed with nowhere to
  answer is answered in the margin. `x^2` and `H_2O` render as real superscript
  and subscript, which is the least a science or maths paper can manage without
  and far less than a teacher would type in LaTeX. Code listings keep their
  whitespace; matching questions print as two columns and a blank. Approving and
  sending back are both audited, and the author is notified either way.

### Fixed

- **Any signed-in user could open any portal.** `ProtectedRoute` checked one
  thing: that an access token existed. An admin could load `/teacher/classes`
  and get the teacher's sidebar, header and layout, which the API then filled
  with "Access restricted to teachers". All seventy-three protected routes now
  name the role that owns them, and the wrong role is sent to its own home
  rather than to a login form it does not need.

- **Seventeen API views never said who could call them.** DRF falls back to
  `DEFAULT_PERMISSION_CLASSES` when a view declares nothing, and here that is
  `IsAuthenticated` — "any signed-in user", which in a school means every
  student and parent. That left reachable, to anyone with an account at the
  school: any child's attendance; any student's assessments, term results and
  teacher comments, to any parent and any teacher; creating a password-bearing
  parent account linked to any child; GET/PATCH/DELETE on an exam schedule
  entry and on school announcements; and full CRUD on student records and
  parent-child links through two viewsets no screen in the product calls.

  None of those views decided to be open. They said nothing, and the framework
  decided for them. Student-scoped views now go through `can_view_student` —
  school-wide staff see everyone, a parent their own children, a teacher the
  students they teach, a student themselves, an unknown role nothing — and a
  test walks the real URL conf so silence cannot be the bug a second time. The
  tenant schema held throughout: this was escalation inside one school, never
  across them.

- **`/admin` was unreachable in development.** Django's admin had moved to
  `/django-admin/` so the React portal could own `/admin/*`, but the Vite proxy
  still forwarded `/admin` to a Django path that no longer existed — shadowing
  eleven screens and answering with a 404 rather than Django's login.

- **Five teacher pages labelled the viewer "Teacher" regardless of who they
  were**, in English, in a trilingual app.

- **Template scaffolding printed onto the exam paper.** Django's `{# #}` is a
  single-line comment, so two of them spanning a line break were not comments
  at all — they were text, and they rendered between a question and its parts
  on the PDF a candidate would have sat. Caught by reading the generated file
  rather than by any assertion; a test now extracts the PDF text and fails on
  any template token reaching it.

---

## 2026-08-20 — UI modernization, and deployment durability

### Fixed

- **Database backups no longer vanish on the next deploy.** `backup_database`
  writes to `settings.BACKUP_DIR`, which defaulted to `BASE_DIR / 'backups'` —
  `/app/backups` inside the container. Nothing was mounted there: `backend` and
  `worker` mounted only `imboni_media:/app/media`, and `.env.prod.example` never
  set `BACKUP_DIR`. Every dump therefore landed in the container's writable
  layer, which is discarded when the container is recreated — exactly what
  `up -d --build` does. So the nightly Celery backup survived only until the
  next deploy, and the pre-deploy backup was destroyed by the deploy it was
  taken to protect against. `pg_dump` exits zero either way, so the loss was
  silent and nothing ever looked wrong.

  `docker-compose.prod.yml` now sets `BACKUP_DIR: /app/backups` in the shared
  backend environment and bind-mounts `./backups` there on `backend`, `worker`
  **and** `beat`. All three matter, and `worker` most of all: `beat` only
  schedules `apps.audit.tasks.backup_database_task`, the worker executes it, so
  mounting `backend` alone would have preserved manual dumps while still losing
  every automatic one. A host bind mount rather than a named volume, because the
  point of a backup is getting it off the machine and `rsync`/`scp` can reach
  `/opt/imboni/backups` directly. Already covered by `.gitignore: backups/`.

  Containers keep their old mounts until recreated, so on the first deploy after
  this change, rescue what is still inside first:
  `docker cp imboni-backend-1:/app/backups /opt/imboni/backups`.

- **Container logs are capped.** Docker's `json-file` driver is unbounded by
  default and neither compose file set a limit. Seven always-restarting services
  writing logs for months take the root filesystem to 100%, at which point
  Postgres cannot write its WAL and the whole stack stops — with no deploy
  anywhere near the event, making it the last place anyone thinks to look. An
  `x-logging: &default_logging` anchor (10 MB × 3 files, so 30 MB per container)
  now applies to every service in `docker-compose.yml`, and to `certbot` in the
  production override. Declared in compose rather than
  `/etc/docker/daemon.json` so the limit travels with the repository instead of
  being one more thing to remember on a new server. Also takes effect only on
  container recreation.

- **Tenant schemas are migrated on every container boot.** The Docker
  entrypoint ran only `migrate_schemas --shared`, which touches the public
  schema. A tenant schema was migrated exactly once, at provisioning time by
  `Client.save()`, and never again — so any migration shipped in a `TENANT_APPS`
  app left every existing school running against stale tables until someone
  remembered to intervene by hand. Seven such migrations (`discipline.0010`,
  `dos.0005`-`0007`, `results.0005`-`0006`, `teacher.0008`) were found pending
  across all six live schemas. The entrypoint now runs `migrate_schemas
  --tenant` after seeding the public tenant, making a deploy self-healing.

- **Portal stylesheets were overwriting each other.** Vite bundles every
  portal's CSS into one document and route chunks accumulate as you navigate —
  they are never unloaded. 108 class names were defined in more than one
  stylesheet with no scoping, so which definition applied depended on the order
  the route chunks happened to load, which depends on where the user navigated
  from. The messaging vocabulary was the worst case: `conv-panel`, `thread-body`
  and 33 other classes carried a near-copy in five files, and `student.css` /
  `teacher.css` described a *different layout* (separate bordered cards) from
  `pages.css` / `discipline.css` (one bordered box). The same page rendered in
  two different shapes depending on browsing history.

  204 duplicate messaging rules were deleted; `pages.css` is now the single
  owner and is imported directly by `LiveMessages.jsx` and `MessagesPage.jsx`,
  so it is guaranteed present wherever messaging renders. Portal-specific
  theming moved onto a `data-portal` attribute set by a new `usePortalTheme`
  hook. Verified by diffing the selector set in the built CSS before and after —
  which caught the one rule that genuinely only existed in a portal copy
  (`.thread-head-info`) and would otherwise have been lost.

- **Every dashboard's task list was silently empty.** DRF paginates by default
  in this project (`PAGE_SIZE: 20`) and `TeacherTaskViewSet` never opted out, so
  `GET /imboni/tasks/` answered with `{count, next, previous, results}`. All
  three dashboards read it as `Array.isArray(data) ? data : []`, which is
  `false` for an object — so the list reset to empty on every load. Creating a
  task appeared to work, because the POST response is not paginated and went
  straight into component state; refreshing lost it. 19 of 20 registered routes
  return the paginated envelope, so a new `toList()` helper in `api/client.js`
  now accepts either shape. Personal lists (tasks, reminders) also stopped
  paginating server-side — at `PAGE_SIZE: 20` the 21st task would have been
  unreachable even after the client fix.

- **Conversation avatars never took their role colour.** `ConversationItem`
  accepted an `avatarClass` prop and never applied it — the className was a
  template literal with a trailing space where the variable belonged. Every
  role-specific avatar rule in the messaging stylesheet had been dead code. The
  `discipline` role additionally had no colour defined at all, despite
  `roleClass()` emitting it.

- **The "N of N loaded" badge on announcements counted two different things.**
  It measured the *published* count against an *all-status* server total, and
  ignored the active filter — so selecting **Draft 0** left "15 of 15 loaded"
  sitting above an empty list. "Load more" was also gated to the All tab, so a
  filtered view had no way to reach the rest of the list.

- **The sidebar forgot its own collapse.** `collapsed` was component state in a
  component that all 64 pages mount their own copy of, so collapsing the panel
  and then clicking any nav item sprang it straight back open. It is now a
  stored preference.

- **Focus indicators were missing on 34 controls**, which set `outline: none` in
  favour of a border that a keyboard user cannot see. `utilities.css` now sets
  an accessibility floor that component styles cannot override. The sidebar's
  active nav item sat at roughly 1.5:1 against its background; several CSS
  custom properties (`--radius-full`, `--scrollbar-*`, `--text-muted`) were
  referenced but never defined; and `color: var(--muted)` was used as ink in 29
  places.

- **Generate buttons opened dialogs that could only fail.** The dining planner
  and duty roster let you configure and submit a plan with no active sittings or
  posts, discovering the precondition through an error toast afterwards. Both
  now gate on there being something to schedule.

- **Every portal header rendered an empty pill.** `formatDateWithWeekday()`
  returns `''` for a missing value by design, and was being called with no
  argument.

### Changed

- **One type scale instead of 105 font sizes.** Roughly 105 distinct values
  across the stylesheets collapsed onto a six-step scale (12 / 13 / 15 / 18 /
  24 / 32px) plus a four-step icon scale; 1,660 declarations now reference a
  token. The values left raw are all display type above 32px.

- **The palette was rebuilt on five well-separated hue families**, with every
  foreground/background pairing measured rather than eyeballed. Alpha colours
  are composited against their backing before measuring, which is where the
  original checks went wrong. Page, card and border tones were separated enough
  to actually see a card edge — they had been sitting at 1.05:1.

- **Controls that do the same job are defined once.** `components.css` now owns
  a shared vocabulary — selection chips, icon buttons, stat cards, filter tabs,
  pagination, row-delete buttons — rather than each portal forking its own.

- **Borders belong to the container, not to every row.** A list whose rows each
  carried a full border read as a pile of separate objects; the frame moved to
  the wrapper, with dividers inside. Recorded as `.u-framed-list`.

- **The class timetable was rewritten.** Every academic cell resolved to a
  single pale green at 1.05:1, so colour carried no information: subjects now
  take a hue from a stable hash with collision resolution, shown as an edge bar.
  The break row printed the word "Break" once per day column and is now one
  band; the home room is stated once instead of appearing in 25 of 30 cells; the
  period column and header are sticky; the grid is `table-layout: fixed` so day
  columns are equal width. The result is roughly 41% shorter, so a full week
  fits on one screen without scrolling. Printing is supported.

- **Fonts are self-hosted and the icon font is subset.** Material Symbols
  shipped ~361 KB of glyphs to render 267 icons' worth of UI; the subset is
  27 KB. With Inter's latin subset that is a font payload of 408 KB → 74 KB, and
  both files are now precached by the service worker instead of depending on
  `fonts.googleapis.com` being reachable — which an offline-capable PWA cannot
  assume. Tabular figures are enabled wherever digits are read as data.

- **The collapsed sidebar rail is usable.** It had no labels of any kind — 11
  unlabelled icons — and each carried its own tinted box in a rail 4px narrower
  than its own contents. Labels now become hover tooltips, the boxes are gone,
  and the collapse toggle moved to the panel edge where it no longer sits on top
  of the brand tagline.

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

### Added

- **`npm run fonts`** (`scripts/fetch-fonts.mjs`) — downloads Inter and builds
  the Material Symbols subset from a scan of the source. Because the subset is
  derived from usage, adding an icon without regenerating it would render as a
  blank box; `src/test/icon-subset.test.js` imports the same scan and fails the
  build instead of letting that reach production.

- **`PaginationBar`**, **`toList()`**, **`usePortalTheme()`** and
  **`timetableDisplay.js`** — extracted so pagination, list-response handling,
  portal theming and timetable formatting each have one implementation.

- **Task management on the dashboards** — delete a single task, or clear all
  completed ones. The API endpoints already existed and were never called from
  any UI.

- **A class filter on the timetable tab**, using the same level/class chips the
  exam tab uses, replacing a dropdown that hid all 18 classes behind a click.

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
