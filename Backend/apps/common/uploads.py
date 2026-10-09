"""
What may be uploaded, checked in one place.

Teaching materials, assignment files, hand-ins, announcement and message
attachments and parent documents all accept a file from a signed-in user, and
most of them used to accept ANY file: an .html page, an .svg with a script in
it, an .exe, named whatever the uploader liked. Stored under /media and ever
served from this origin, an HTML or SVG file runs as this app and can read a
signed-in user's session. So the rule is an allowlist, applied to the NAME, the
SIZE and the CONTENT:

  * name:     only the extensions below. Nothing executable, nothing a browser
              will run as a page (html, svg, js, xhtml...).
  * size:     at most MAX_UPLOAD_MB.
  * content:  the first bytes must match the extension. A script renamed to
              .pdf has no "%PDF" at its head and is refused. The extension
              alone is only what the uploader typed.

Use as a serializer field validator, so there is no model change and no
migration:

    class Meta:
        extra_kwargs = {'attachment': {'validators': [validate_document]}}
"""
import os

from rest_framework import serializers

MAX_UPLOAD_MB = 15
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


# ── Content checks: each takes the first bytes of the file ─────────────────────

def _starts(*signatures):
    return lambda head: any(head.startswith(s) for s in signatures)


def _is_text(head):
    """Plain text: no NUL bytes, and it decodes. A binary renamed to .txt fails."""
    if b'\x00' in head:
        return False
    for encoding in ('utf-8', 'latin-1'):    # latin-1 for older spreadsheet exports
        try:
            head.decode(encoding)
            return True
        except UnicodeDecodeError:
            continue
    return False


def _is_webp(head):
    return head[:4] == b'RIFF' and head[8:12] == b'WEBP'


def _is_mp4_family(head):
    return head[4:8] == b'ftyp'


def _is_mp3(head):
    return head.startswith(b'ID3') or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0)


_PDF = _starts(b'%PDF')
_ZIP = _starts(b'PK\x03\x04')                       # docx/xlsx/pptx/odt/ods/odp are zip containers
_OLE = _starts(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1')  # legacy doc / xls / ppt
_PNG = _starts(b'\x89PNG\r\n\x1a\n')
_JPEG = _starts(b'\xff\xd8\xff')
_GIF = _starts(b'GIF87a', b'GIF89a')

DOCUMENT_TYPES = {
    'pdf': _PDF,
    'doc': _OLE, 'xls': _OLE, 'ppt': _OLE,
    'docx': _ZIP, 'xlsx': _ZIP, 'pptx': _ZIP,
    'odt': _ZIP, 'ods': _ZIP, 'odp': _ZIP,
    'rtf': _starts(b'{\\rtf'),
    'txt': _is_text, 'csv': _is_text,
    'png': _PNG, 'jpg': _JPEG, 'jpeg': _JPEG, 'gif': _GIF,
}

# Teaching materials also allow audio, video and a zip of resources.
MATERIAL_TYPES = {
    **DOCUMENT_TYPES,
    'webp': _is_webp,
    'mp3': _is_mp3, 'm4a': _is_mp4_family, 'mp4': _is_mp4_family,
    'zip': _ZIP,
}

CSV_TYPES = {'csv': _is_text}


def _extension(name):
    return os.path.splitext(name or '')[1].lstrip('.').lower()


def _head(upload, n=8192):
    """The first bytes, without disturbing the stream the framework saves next."""
    position = upload.tell() if hasattr(upload, 'tell') else 0
    upload.seek(0)
    head = upload.read(n)
    upload.seek(position)
    return head


def check_content(upload, allowed):
    """Raise unless the bytes match the extension. For callers that already
    check the name and size themselves (teaching materials do)."""
    ext = _extension(getattr(upload, 'name', ''))
    matches = allowed.get(ext)
    if matches is None:
        return upload                       # not a type we can recognise: the caller decides
    if not matches(_head(upload)):
        raise serializers.ValidationError(f"That file does not look like a real '.{ext}' file.")
    return upload


def check_upload(upload, allowed, max_bytes=MAX_UPLOAD_BYTES):
    """Raise ValidationError unless `upload` has an allowed name, size and content."""
    ext = _extension(getattr(upload, 'name', ''))
    if ext not in allowed:
        raise serializers.ValidationError(
            f"Files of type '.{ext or '?'}' are not accepted. "
            f"Allowed: {', '.join(sorted(allowed))}."
        )

    size = getattr(upload, 'size', 0) or 0
    if size == 0:
        raise serializers.ValidationError('That file is empty.')
    if size > max_bytes:
        raise serializers.ValidationError(
            f'That file is {size / (1024 * 1024):.1f} MB; the limit is {max_bytes // (1024 * 1024)} MB.'
        )

    return check_content(upload, allowed)


def validate_document(upload):
    """Assignment files, hand-ins, announcement and message attachments, parent documents."""
    return check_upload(upload, DOCUMENT_TYPES)


def validate_csv(upload):
    """CSV imports (students, books, invitations)."""
    return check_upload(upload, CSV_TYPES, max_bytes=5 * 1024 * 1024)
