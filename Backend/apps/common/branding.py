"""
Who a printed page or an email is from.

One answer to "what is this school called, what does its mark look like and how
do you reach it", used by every document the backend produces. Before this the
sidebar read the name the school typed into Settings, the finance letterhead
read the name it was provisioned with, and report cards and exam papers read a
single global `SCHOOL_NAME` setting, so every school's report card said
"Imboni School". The order here is the one the school would expect:

    1. what the school set for itself in Settings,
    2. the name it was provisioned with,
    3. the deployment-wide fallback (local development, single-school installs).
"""
import base64
import io

from django.conf import settings
from django.db import connection

# Wide enough to stay sharp on a 300dpi letterhead, small enough that a logo
# does not turn every receipt into a megabyte.
LOGO_MAX_PX = 360


def _setting():
    try:
        from apps.dos.models import SchoolSetting
        return SchoolSetting.get_setting()
    except Exception:
        # No tenant schema (public schema, a bare script): documents still render.
        return None


def _logo_data_uri(setting):
    """
    The logo as an inline PNG, or None.

    Inline rather than a URL because the PDF renderer fetches nothing over the
    network, and a media path means something different on every host. A
    missing or unreadable file is "no logo", never a failed document.
    """
    logo = getattr(setting, 'logo', None)
    if not logo:
        return None
    try:
        from PIL import Image
        with logo.open('rb') as handle:
            image = Image.open(handle)
            image.load()
        image.thumbnail((LOGO_MAX_PX, LOGO_MAX_PX))
        # Flatten transparency onto white: the renderer draws it black.
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGBA')
            flat = Image.new('RGB', image.size, 'white')
            flat.paste(image, mask=image.split()[-1])
            image = flat
        else:
            image = image.convert('RGB')
        out = io.BytesIO()
        image.save(out, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode('ascii')
    except Exception:
        return None


def school_branding():
    """{'name', 'logo', 'email', 'phone'} for the school behind this request."""
    setting = _setting()
    tenant = getattr(connection, 'tenant', None)
    name = ((getattr(setting, 'school_name', '') or '').strip()
            or getattr(tenant, 'name', None)
            or getattr(settings, 'SCHOOL_NAME', 'Imboni School'))
    return {
        'name': name,
        'logo': _logo_data_uri(setting),
        'email': ((getattr(setting, 'contact_email', '') or '').strip()
                  or getattr(settings, 'SCHOOL_EMAIL', '')),
        'phone': ((getattr(setting, 'contact_phone', '') or '').strip()
                  or getattr(settings, 'SCHOOL_PHONE', '')),
    }


def branding_context():
    """The same, under the names the document templates use."""
    b = school_branding()
    return {
        'school_name': b['name'],
        'school_logo': b['logo'],
        'school_email': b['email'],
        'school_phone': b['phone'],
    }
