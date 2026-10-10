"""Background work has to run inside the right school."""
from types import SimpleNamespace

import pytest
from django.db import connection

from apps.common import tenancy

pytestmark = pytest.mark.django_db


def test_a_task_queued_from_a_school_carries_that_school():
    headers = {}
    tenancy.stamp_schema(headers)
    # The suite runs inside the `test` school.
    assert headers == {'schema_name': connection.schema_name}


def test_nothing_is_stamped_from_the_public_schema():
    from django_tenants.utils import get_public_schema_name, schema_context
    headers = {}
    with schema_context(get_public_schema_name()):
        tenancy.stamp_schema(headers)
    assert headers == {}


def test_a_task_switches_into_its_school_and_back_out():
    original = connection.schema_name
    try:
        connection.set_schema_to_public()
        assert tenancy.enter_schema('t1', SimpleNamespace(schema_name='test')) is True
        assert connection.schema_name == 'test'
        tenancy.leave_schema('t1')
        assert connection.schema_name == 'public'
    finally:
        connection.set_schema(original)


def test_a_task_stamped_public_does_not_switch():
    assert tenancy.enter_schema('t2', SimpleNamespace(schema_name='public')) is False


def test_a_task_with_no_school_leaves_the_connection_alone():
    before = connection.schema_name
    assert tenancy.enter_schema('t3', SimpleNamespace()) is False
    tenancy.leave_schema('t3')           # not ours, so it must not reset anything
    assert connection.schema_name == before


def test_a_scheduled_job_runs_once_per_school_and_one_failure_does_not_stop_the_rest():
    seen = []

    def job():
        seen.append(connection.schema_name)
        if connection.schema_name == 'test':
            raise RuntimeError('boom')
        return connection.schema_name

    out = tenancy.run_in_every_school(job)

    assert 'public' not in out
    assert out['test'] is None                       # failed, recorded, not raised
    assert sorted(seen) == sorted(out)               # every school was visited once
