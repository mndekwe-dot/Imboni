"""
Turning a queryset into something a school can hold.

Two output shapes, used by both the finance office and the library:

    csv_response()  — a list somebody will open in a spreadsheet
    pdf_response()  — a document somebody will print, sign, or file

Both were already being written by hand in `apps/dos` (report_views.py builds a
CSV inline, exam_paper_views.py drives xhtml2pdf inline). Doing it a third and
fourth time in two more apps is how the school's name ends up spelled three
different ways on three different documents, so the shape lives here once.

Nothing here knows what a fee or a book is. Callers bring their own rows and
their own template.
"""
import csv
import io
from datetime import date

from django.conf import settings
from django.db import connection
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify


def school_name():
    """
    Whose letterhead this is.

    The tenant's own name first: under django-tenants every school is its own
    schema and `connection.tenant` is the row describing it, so a document
    printed at one school must never carry another's name. `SCHOOL_NAME` in
    settings is the single-school fallback for local development.
    """
    tenant = getattr(connection, 'tenant', None)
    return (getattr(tenant, 'name', None)
            or getattr(settings, 'SCHOOL_NAME', 'Imboni School'))


def document_context(title, subtitle='', **extra):
    """The header every printed document shares."""
    return {
        'school_name': school_name(),
        'school_email': getattr(settings, 'SCHOOL_EMAIL', ''),
        'school_phone': getattr(settings, 'SCHOOL_PHONE', ''),
        'title': title,
        'subtitle': subtitle,
        'printed_on': timezone.localtime(),
        **extra,
    }


def _filename(stem, extension):
    """A safe, dated filename: `debtors-2026-09-01.csv`."""
    stem = slugify(stem) or 'export'
    return f'{stem}-{date.today():%Y-%m-%d}.{extension}'


def csv_response(stem, headers, rows):
    """
    Stream `rows` as a CSV download.

    `rows` may be any iterable of sequences — a generator is fine and preferred
    for a long list, since nothing here holds the whole file in memory twice.

    utf-8-sig, not plain utf-8, and deliberately: Excel on Windows reads a
    BOM-less UTF-8 CSV as the system codepage, which turns every accented name
    in a Rwandan roster into mojibake the first time somebody opens it.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(['' if value is None else value for value in row])

    response = HttpResponse(buffer.getvalue().encode('utf-8-sig'),
                            content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{_filename(stem, "csv")}"'
    return response


def pdf_response(template, context, stem, *, inline=False):
    """
    Render `template` with `context` and return it as a PDF download.

    `inline=True` asks the browser to display it rather than save it — what you
    want for a receipt the parent is standing there waiting for, since a
    download that lands in a folder is one more click before it reaches a
    printer.
    """
    from xhtml2pdf import pisa

    html = render_to_string(template, context)
    buffer = io.BytesIO()
    result = pisa.CreatePDF(io.StringIO(html), dest=buffer)

    if result.err:
        # A broken template must not hand back a zero-byte file that a printer
        # silently swallows. Say so instead.
        return HttpResponse('This document could not be rendered.', status=500,
                            content_type='text/plain')

    disposition = 'inline' if inline else 'attachment'
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'{disposition}; filename="{_filename(stem, "pdf")}"'
    return response


def wants(request, fmt):
    """True if the caller asked for this format: `?format=csv`."""
    return (request.query_params.get('format') or '').lower() == fmt


def money(value):
    """Format a Decimal for a document: 1490000 -> '1,490,000'."""
    try:
        return f'{float(value):,.0f}'
    except (TypeError, ValueError):
        return '0'
