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
import re
from urllib.parse import urlparse

from django.conf import settings
from django.db import connection

# Wide enough to stay sharp on a 300dpi letterhead, small enough that a logo
# does not turn every receipt into a megabyte.
LOGO_MAX_PX = 360


# The product's own blue, used when a school sets no colour of its own.
DEFAULT_BRAND_COLOR = '#003d7a'

# White text sits on the brand colour (primary buttons, the sidebar), so the
# colour has to carry it. 4.5:1 is WCAG AA for normal text.
MIN_BRAND_CONTRAST = 4.5

_HEX = re.compile(r'^#[0-9a-fA-F]{6}$')


def _channel(value):
    v = value / 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def contrast_with_white(hex_color):
    """WCAG contrast ratio of white text on `hex_color` (#rrggbb)."""
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    luminance = 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)
    return 1.05 / (luminance + 0.05)


def validate_brand_color(value):
    """
    The cleaned colour ('' for none) or ValueError saying what is wrong.

    Checked here, not only in the picker, because the API is the thing a
    school's colour has to survive: a colour that fails contrast would put
    unreadable white text on every button of every portal.
    """
    value = (value or '').strip()
    if not value:
        return ''
    if not _HEX.match(value):
        raise ValueError('Use a colour like #1a56db.')
    value = value.lower()
    if contrast_with_white(value) < MIN_BRAND_CONTRAST:
        raise ValueError('That colour is too light: white text on it would be hard to read. Pick a darker one.')
    return value


# What a school may reword on what it prints: key -> (default, max length).
# Plain text only, never HTML. A blank value falls back to the default.
DOCUMENT_TEXT_FIELDS = {
    'motto': ('', 120),
    'footer_text': ('', 160),
    'report_note': ('', 300),
    'report_signatory_left': ("Class Teacher's Signature:", 60),
    'report_signatory_right': ('The School HeadMaster', 60),
    'exam_instructions': ('', 600),
}


def clean_document_text(value):
    """Validate the editable wording; returns a dict of only the set keys."""
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError('Document text must be an object.')
    unknown = set(value) - set(DOCUMENT_TEXT_FIELDS)
    if unknown:
        raise ValueError('Unknown document field: ' + ', '.join(sorted(unknown)))
    cleaned = {}
    for key, text in value.items():
        if not isinstance(text, str):
            raise ValueError(f'{key} must be text.')
        text = text.strip()
        limit = DOCUMENT_TEXT_FIELDS[key][1]
        if len(text) > limit:
            raise ValueError(f'{key} is limited to {limit} characters.')
        if text:
            cleaned[key] = text
    return cleaned


def document_text():
    """Every editable string, with the school's wording over the defaults."""
    stored = getattr(_setting(), 'document_text', None) or {}
    return {key: (stored.get(key) or default)
            for key, (default, _limit) in DOCUMENT_TEXT_FIELDS.items()}


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
        'color': (getattr(setting, 'brand_color', '') or '').strip() or DEFAULT_BRAND_COLOR,
        'logo': _logo_data_uri(setting),
        'email': ((getattr(setting, 'contact_email', '') or '').strip()
                  or getattr(settings, 'SCHOOL_EMAIL', '')),
        'phone': ((getattr(setting, 'contact_phone', '') or '').strip()
                  or getattr(settings, 'SCHOOL_PHONE', '')),
    }


def logo_icon_png(size):
    """
    The logo as a square PNG of `size` pixels, or None when there is no logo.

    A phone or desktop shortcut wants a square icon; schools upload whatever
    shape their crest is. The logo is fitted inside with a margin on a white
    square, so it is never stretched or cropped.
    """
    setting = _setting()
    logo = getattr(setting, 'logo', None)
    if not logo:
        return None
    try:
        from PIL import Image
        with logo.open('rb') as handle:
            image = Image.open(handle)
            image.load()
        image = image.convert('RGBA')
        inner = int(size * 0.8)
        image.thumbnail((inner, inner))
        canvas = Image.new('RGBA', (size, size), (255, 255, 255, 255))
        canvas.paste(image, ((size - image.width) // 2, (size - image.height) // 2), image)
        out = io.BytesIO()
        canvas.convert('RGB').save(out, 'PNG', optimize=True)
        return out.getvalue()
    except Exception:
        return None


def frontend_url():
    """
    The address people at this school open: https://<the school's own domain>.

    Every emailed link (a password reset, an invitation, an email change) used
    to be built from the one deployment-wide FRONTEND_URL. In production that is
    the bare domain, which is the public site and knows nothing about any
    school's users, so a teacher's reset link led somewhere it could never
    work. The school's primary domain is the right host; the scheme and any
    port come from FRONTEND_URL so a local http setup keeps working.
    """
    base = str(getattr(settings, 'FRONTEND_URL', '')).rstrip('/')
    tenant = getattr(connection, 'tenant', None)
    try:
        from django_tenants.utils import get_public_schema_name
        if tenant is None or getattr(connection, 'schema_name', None) == get_public_schema_name():
            return base
        domain = tenant.domains.filter(is_primary=True).first() or tenant.domains.first()
    except Exception:
        return base
    if not domain:
        return base
    parsed = urlparse(base)
    port = f':{parsed.port}' if parsed.port else ''
    return f'{parsed.scheme or "https"}://{domain.domain}{port}'


def branding_context():
    """The same, under the names the document templates use."""
    b = school_branding()
    return {
        'school_name': b['name'],
        'school_logo': b['logo'],
        'school_email': b['email'],
        'school_phone': b['phone'],
        'brand_color': b['color'],
        'doc': document_text(),
    }
