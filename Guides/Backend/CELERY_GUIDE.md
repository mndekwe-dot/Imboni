# Celery Guide — Background Tasks & Scheduling

Celery runs work **outside the request/response cycle**: scheduled jobs (nightly
reminders, weekly digests) and slow operations (notification fan-outs, emails)
happen in a separate worker process instead of making a user wait.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Setup — Redis](#2-setup--redis)
3. [Running Celery](#3-running-celery)
4. [What's Wired Up](#4-whats-wired-up)
5. [Writing a New Task](#5-writing-a-new-task)
6. [safe_delay — the fallback pattern](#6-safe_delay--the-fallback-pattern)
7. [Testing Tasks](#7-testing-tasks)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Architecture

```
Django view ──.delay()──▶  Redis (broker)  ──▶  Celery worker  ──▶  does the work
Celery beat ──schedule──▶  Redis (broker)  ──▶  Celery worker  ──▶  periodic jobs
                           Redis db 1 (result backend) ◀── task results (kept 1 day)
```

| Piece | File |
|---|---|
| Celery app + beat schedule | `Backend/Imboni/celery.py` |
| App loading on Django start | `Backend/Imboni/__init__.py` |
| All `CELERY_*` settings | `Backend/Imboni/settings.py` (bottom) |
| Task modules | `apps/<app>/tasks.py` (auto-discovered) |

Broker and result backend default to local Redis and can be overridden in `.env`:

```env
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
# Run every task inline with no broker (dev convenience):
CELERY_TASK_ALWAYS_EAGER=True
```

## 2. Setup — Redis

Celery needs a message broker. Easiest options on Windows:

**Docker (recommended):**
```bash
docker run -d --name imboni-redis -p 6379:6379 redis:7
```

**Memurai** (native Windows Redis): https://www.memurai.com — install, it runs as a service.

**WSL:** `sudo apt install redis-server && sudo service redis-server start`

Verify: `docker exec imboni-redis redis-cli ping` → `PONG`

## 3. Running Celery

From `Backend/` with the virtualenv active, in **two separate terminals**:

```bash
# Terminal 1 — the worker (executes tasks)
celery -A Imboni worker -l info --pool=solo

# Terminal 2 — beat (triggers the scheduled tasks)
celery -A Imboni beat -l info
```

> `--pool=solo` is required on **Windows** — the default prefork pool doesn't
> work there. On Linux servers drop it (or use `--concurrency=4`).

You should see both scheduled tasks registered in the worker banner:

```
[tasks]
  . apps.analytics.tasks.send_fee_reminders_task
  . apps.notifications.tasks.bulk_notify_task
  . apps.notifications.tasks.send_email_task
  . apps.parents.tasks.notify_consent_parents_task
  . apps.parents.tasks.send_weekly_digest_task
  . apps.teacher.tasks.send_due_date_reminders_task
```

## 4. What's Wired Up

### Periodic (Celery beat — replaces cron)

| Task | When | What it does |
|---|---|---|
| `send_due_date_reminders_task` | Daily 18:00 | Notifies students with unsubmitted assignments due tomorrow |
| `send_weekly_digest_task` | Friday 17:00 | In-app + email summary of each child's week to parents |

Times are in `Africa/Kigali` (from `TIME_ZONE`). Edit the schedule in
`Imboni/celery.py`.

### Request-path offloads (via `safe_delay`)

| Trigger | Task | Why |
|---|---|---|
| Staff creates a consent request | `notify_consent_parents_task` | A whole-school request notifies every parent — hundreds of inserts shouldn't block the response |
| Admin clicks "Send Fee Reminder" | `send_fee_reminders_task` | Same — the view returns counts immediately, the fan-out runs in the worker |
| Weekly digest emails | `send_email_task` (per parent) | Each email retries 3× on failure without sinking the whole digest |

### Reusable building blocks

- `send_email_task(subject, message, recipient_list)` — email with 3 retries, 60s apart
- `bulk_notify_task(user_ids, title, message, type, path)` — mass in-app notification

## 5. Writing a New Task

Create (or add to) `apps/<app>/tasks.py` — it's discovered automatically:

```python
from celery import shared_task

@shared_task
def rebuild_attendance_summaries(month, year):
    from apps.attendance.models import AttendanceSummary
    # ... heavy work here ...
    return updated_count
```

Rules of thumb:
- **Import Django models inside the function**, not at module top — avoids
  app-registry issues at worker boot.
- **Pass IDs (as strings for UUIDs), not model instances** — arguments must be
  JSON-serializable.
- Give retrying tasks `bind=True` and call `self.retry(exc=exc)` (see
  `send_email_task` for the pattern).

Call it:

```python
rebuild_attendance_summaries.delay(3, 2026)          # queue it (needs broker)
rebuild_attendance_summaries.apply(args=(3, 2026))   # run inline (no broker)
safe_delay(rebuild_attendance_summaries, 3, 2026)    # queue, inline fallback
```

## 6. safe_delay — the fallback pattern

`apps/notifications/tasks.py` exports `safe_delay(task, *args, **kwargs)`.
**Always use it from views** instead of `.delay()`:

- Broker up → task is queued normally.
- Broker down/missing → the task runs **inline** and the request still succeeds.

It probes the broker with a 1-second TCP check cached for 30s, because kombu
itself retries a dead broker for ~100 seconds — that would hang a request.
This means development works with zero setup, and production silently degrades
to synchronous instead of erroring if Redis has an outage.

## 7. Testing Tasks

Don't use `.delay()` in tests (needs a broker). Use `.apply()` — it runs the
task synchronously through the full Celery machinery:

```python
def test_my_task(self):
    result = my_task.apply(args=(3, 2026)).get()
    assert result == 5
```

Existing examples: `apps/notifications/tests.py` → `TestCeleryTasks`,
`TestPeriodicTaskWrappers` (includes a test that fails if a beat schedule
entry points at a task that doesn't exist).

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ValueError: not enough values to unpack` on Windows worker | Missing `--pool=solo` |
| Tasks queued but never run | Worker not running, or watching a different Redis db than the producer |
| `Connection refused` in worker logs | Redis isn't running — see section 2 |
| Task raises `apps aren't loaded yet` | Model imported at module top of tasks.py — move the import inside the function |
| Changed a task but worker runs old code | Workers don't auto-reload — restart the worker |
| Beat task fires at the wrong hour | Beat uses `CELERY_TIMEZONE` (Africa/Kigali) — check the server clock |
| Need to run a scheduled job right now | `python manage.py send_weekly_digest` / `send_due_date_reminders` still work directly |
