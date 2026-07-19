"""
Tests for the real-time notification WebSocket.

The important one is `test_tenant_isolation_*`: it runs two live Postgres
schemas, connects one real socket into each, creates a notification in school B
and asserts school A's socket stays silent. That is the property whose failure
would leak one school's data to another.
"""
import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django_tenants.utils import schema_context

from Imboni.asgi import application

from .consumers import notification_group_name

WS_PATH = '/imboni/ws/notifications/'


def _communicator(host, token=None):
    path = WS_PATH if token is None else f'{WS_PATH}?token={token}'
    return WebsocketCommunicator(application, path, headers=[(b'host', host.encode())])


@database_sync_to_async
def _create_notification(schema_name, user_id, title):
    """Create a notification the production way (services.notify_user)."""
    from apps.authentication.models import User

    from .services import notify_user
    with schema_context(schema_name):
        user = User.objects.get(pk=user_id)
        return str(notify_user(user, title, 'body text', 'announcement', '/x').pk)


@database_sync_to_async
def _delete_notifications(schema_name, user_id):
    from .models import Notification
    with schema_context(schema_name):
        Notification.objects.filter(user_id=user_id).delete()


# ── group naming ───────────────────────────────────────────────────────────────

def test_group_name_is_namespaced_by_schema():
    """Same user id, different school -> different channel group. Always."""
    same_id = '11111111-1111-1111-1111-111111111111'
    assert notification_group_name('school_a', same_id) != \
        notification_group_name('school_b', same_id)


def test_group_name_is_channels_legal():
    """Channels rejects groups >100 chars or outside [A-Za-z0-9-_.]."""
    name = notification_group_name('x' * 63, '11111111-1111-1111-1111-111111111111')
    assert len(name) <= 100
    assert all(c.isalnum() or c in '-_.' for c in name)


# ── authentication ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db
async def test_rejects_connection_with_no_token(ws_tenants):
    comm = _communicator(ws_tenants['a']['host'])
    connected, code = await comm.connect()
    assert connected is False
    assert code == 4401
    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db
async def test_rejects_connection_with_garbage_token(ws_tenants):
    comm = _communicator(ws_tenants['a']['host'], token='not-a-jwt')
    connected, code = await comm.connect()
    assert connected is False
    assert code == 4401
    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db
async def test_rejects_unknown_host(ws_tenants):
    """A Host that maps to no school must be closed, never silently defaulted."""
    comm = _communicator('nosuchschool.testserver', token=ws_tenants['a']['token'])
    connected, code = await comm.connect()
    assert connected is False
    assert code == 4404
    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db
async def test_accepts_valid_token(ws_tenants):
    comm = _communicator(ws_tenants['a']['host'], token=ws_tenants['a']['token'])
    connected, _ = await comm.connect()
    assert connected is True
    hello = await comm.receive_json_from()
    assert hello['type'] == 'connected'
    assert hello['schema'] == ws_tenants['a']['schema']
    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db
async def test_token_from_another_school_is_rejected(ws_tenants):
    """
    School B's token presented on school A's host must not authenticate: the
    user_id claim is resolved inside A's schema, where that user does not exist.
    (`b_only` is the user that exists in B and nowhere else.)
    """
    comm = _communicator(ws_tenants['a']['host'], token=ws_tenants['b_only']['token'])
    connected, code = await comm.connect()
    assert connected is False
    assert code == 4401
    await comm.disconnect()


# ── delivery ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db
async def test_receives_broadcast_notification(ws_tenants):
    a = ws_tenants['a']
    comm = _communicator(a['host'], token=a['token'])
    connected, _ = await comm.connect()
    assert connected is True
    await comm.receive_json_from()          # the 'connected' greeting

    try:
        await _create_notification(a['schema'], a['user_id'], 'Exam moved')
        message = await comm.receive_json_from(timeout=3)
        assert message['type'] == 'notification'
        assert message['notification']['title'] == 'Exam moved'
        assert message['notification']['read'] is False
    finally:
        await _delete_notifications(a['schema'], a['user_id'])
        await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db
async def test_tenant_isolation_across_schemas(ws_tenants):
    """
    THE data-leak test. Two real Postgres schemas, one live socket into each,
    and — crucially — the two users share the SAME primary key (ids are only
    unique within a schema). A notification created in school B must reach only
    school B's socket. If the channel group were keyed on the user id alone,
    school A would receive B's private notification here.
    """
    a, b = ws_tenants['a'], ws_tenants['b']
    assert a['user_id'] == b['user_id'], 'this test is only meaningful with a shared id'
    assert a['schema'] != b['schema']

    comm_a = _communicator(a['host'], token=a['token'])
    comm_b = _communicator(b['host'], token=b['token'])
    assert (await comm_a.connect())[0] is True
    assert (await comm_b.connect())[0] is True
    await comm_a.receive_json_from()
    await comm_b.receive_json_from()

    try:
        await _create_notification(b['schema'], b['user_id'], 'B private incident')

        received = await comm_b.receive_json_from(timeout=3)
        assert received['notification']['title'] == 'B private incident'

        # School A must have seen absolutely nothing.
        assert await comm_a.receive_nothing(timeout=1) is True
    finally:
        await _delete_notifications(b['schema'], b['user_id'])
        await comm_a.disconnect()
        await comm_b.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db
async def test_ping_is_answered_and_other_input_ignored(ws_tenants):
    a = ws_tenants['a']
    comm = _communicator(a['host'], token=a['token'])
    assert (await comm.connect())[0] is True
    await comm.receive_json_from()

    await comm.send_json_to({'type': 'ping'})
    assert (await comm.receive_json_from(timeout=3))['type'] == 'pong'

    await comm.send_json_to({'type': 'delete_everything'})
    assert await comm.receive_nothing(timeout=0.5) is True
    await comm.disconnect()
