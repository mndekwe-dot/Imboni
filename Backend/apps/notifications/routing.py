"""
WebSocket URL routes for the notification stream.

The path deliberately sits under the existing `/imboni/` prefix. Frontend/nginx.conf
already reverse-proxies that location to the backend WITH `proxy_http_version 1.1`
and the `Upgrade`/`Connection` headers, so the socket works through the container
proxy with no nginx change at all. A new top-level `/ws/` prefix would have needed
its own location block (and would 404 against the SPA fallback until someone added
one).
"""
from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'^imboni/ws/notifications/$', consumers.NotificationConsumer.as_asgi()),
]
