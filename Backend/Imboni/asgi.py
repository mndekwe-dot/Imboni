"""
ASGI config for Imboni project.

It exposes the ASGI callable as a module-level variable named ``application``.

Two protocols are served by the same process:

  http  -> the ordinary Django application (all REST endpoints, admin, static).
  ws    -> the Channels router, currently just the notification stream.

For more information, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Imboni.settings')

# get_asgi_application() must run before any module that imports models is
# imported, so it stays above the routing import below.
from django.core.asgi import get_asgi_application  # noqa: E402

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.notifications.routing import websocket_urlpatterns  # noqa: E402

# NOTE: deliberately no AuthMiddlewareStack / SessionMiddleware here.
# Browsers cannot attach an Authorization header to a WebSocket handshake, and
# this API is stateless-JWT (no session cookie). The consumer authenticates the
# `?token=` query parameter itself — see apps/notifications/consumers.py.
application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(websocket_urlpatterns),
})
