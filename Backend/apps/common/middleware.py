"""
Headers every API answer should carry.

Django's SecurityMiddleware already sends HSTS, nosniff and a referrer policy,
and the pages themselves get their Content-Security-Policy from nginx. This
covers what neither does for the API:

  * A school record must never sit in a cache. Without `no-store` a browser, a
    proxy or a school's content filter may keep a JSON answer (a class list,
    a child's marks) and hand it to the next person at that computer.
  * A JSON answer has no business running anything. If a browser is ever
    tricked into opening one as a page, `default-src 'none'` leaves it inert,
    and `frame-ancestors 'none'` stops it being framed.
  * Nothing served from the API needs the camera, microphone or location.
"""

API_CSP = "default-src 'none'; frame-ancestors 'none'"
PERMISSIONS = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'


class ApiSecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        content_type = response.get('Content-Type', '')
        if content_type.startswith('application/json'):
            # Only JSON: the Django admin and printed HTML documents have their
            # own needs, and a policy this strict would blank them.
            response.setdefault('Content-Security-Policy', API_CSP)
            # setdefault, so the few public answers that ask to be cached (the
            # installed app's icon and manifest) keep the header they set.
            response.setdefault('Cache-Control', 'no-store')

        response.setdefault('Permissions-Policy', PERMISSIONS)
        return response
