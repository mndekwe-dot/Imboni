"""
Keeping background work inside the right school.

Every school's data lives in its own database schema, and a Celery worker or the
beat scheduler starts out on the *public* schema, where none of the school
tables exist. Two things used to go wrong because of it:

* a task queued from a request ("push this notification", "remind these
  parents") ran in the worker on the public schema and failed, because the
  request's school was not carried across;
* the scheduled jobs (due-date reminders, the weekly digest, closing overdue
  assignments) ran once, on the public schema, instead of once per school.

``stamp_schema`` / ``enter_schema`` fix the first by carrying the school with
the task; ``run_in_every_school`` fixes the second.
"""
import logging

from django.db import connection
from django_tenants.utils import get_public_schema_name, get_tenant_model, schema_context

logger = logging.getLogger(__name__)

HEADER = 'schema_name'
_entered = set()          # task ids whose schema we switched, so we only undo our own


def stamp_schema(headers):
    """Add the current school to a task's message headers when it is queued."""
    schema = getattr(connection, 'schema_name', None)
    if headers is not None and schema and schema != get_public_schema_name():
        headers[HEADER] = schema


def enter_schema(task_id, request):
    """Switch to the school a task was queued from, if it carries one."""
    schema = getattr(request, HEADER, None)
    if not schema or schema == get_public_schema_name():
        return False
    connection.set_schema(schema)
    _entered.add(task_id)
    return True


def leave_schema(task_id):
    """Undo ``enter_schema`` for a task, and only for a task that used it."""
    if task_id in _entered:
        _entered.discard(task_id)
        connection.set_schema_to_public()


def schools():
    """Every school that should have its scheduled work done, as schema names."""
    return list(
        get_tenant_model().objects
        .exclude(schema_name=get_public_schema_name())
        .exclude(status='suspended')
        .values_list('schema_name', flat=True)
    )


def run_in_every_school(func, *args, **kwargs):
    """
    Call ``func`` once in each school's schema and return ``{schema: result}``.

    One school failing must not stop the rest, so a failure is logged against
    that school and recorded as ``None`` rather than raised.
    """
    results = {}
    for schema in schools():
        try:
            with schema_context(schema):
                results[schema] = func(*args, **kwargs)
        except Exception:  # noqa: BLE001
            logger.exception('Scheduled job failed for school %s', schema)
            results[schema] = None
    return results
