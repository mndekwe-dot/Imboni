"""
What the library prints.

A library runs on paper as much as the finance office does: a chase list for a
form teacher, a notice a pupil is handed, a sheet of spine labels for the books
that arrived this morning, a stocktake report somebody signs.

Layout lives in `templates/documents/`; this module decides only what goes on
each page.
"""
from decimal import Decimal

from django.utils import timezone

from apps.common.documents import document_context, pdf_response

from . import codes
from . import services

ZERO = Decimal('0.00')


def overdue_pdf(loans, label):
    """The chase list: every late book, grouped for a form teacher to work from."""
    today = timezone.localdate()
    rows = [{
        'loan': loan,
        'days_late': (today - loan.due_on).days,
        'borrower': loan.borrower,
    } for loan in loans]
    context = document_context('Overdue books', subtitle=label,
                               rows=rows, count=len(rows), today=today)
    return pdf_response('documents/library_overdue.html', context, 'overdue-books')


def notices_pdf(groups, label):
    """
    One notice per borrower, each a page they can be handed.

    A single list naming forty pupils and their debts, pinned to a noticeboard,
    is not a reminder -- it is a punishment nobody chose to give.
    """
    context = document_context('Library reminder', subtitle=label,
                               groups=groups, today=timezone.localdate())
    return pdf_response('documents/library_notices.html', context, 'library-notices')


def borrower_pdf(history):
    """One reader\'s whole record, for the conversation at the desk."""
    borrower = history['borrower']
    name = f'{borrower.first_name} {borrower.last_name}'.strip() or borrower.username
    context = document_context('Borrower record', subtitle=name,
                               today=timezone.localdate(), **history)
    return pdf_response('documents/library_borrower.html', context, f'borrower-{name}')


def labels_pdf(copies, *, symbology='code128'):
    """
    Spine labels and barcode cards for copies just added.

    Sized as a grid of small cards rather than a table: these get cut up and
    stuck on books, so what matters is that each one is separable and carries
    the copy code in full.
    """
    kind = 'qr' if str(symbology).lower() == 'qr' else 'code128'
    # The barcode is the point of the label. Printing the copy code as text
    # only -- which is what this did -- gives a librarian a sheet of stickers
    # that nothing can scan, so every issue and every return is still typed by
    # hand and the stocktake scanner has nothing to read.
    rows = [{'copy': c, 'barcode': codes.barcode_data_uri(c.copy_code, kind=kind)}
            for c in copies]
    context = document_context('Spine labels',
                               subtitle=f'{len(copies)} label{"" if len(copies) == 1 else "s"}',
                               labels=rows, copies=copies, symbology=kind)
    return pdf_response('documents/library_labels.html', context, 'spine-labels')


def stocktake_pdf(stocktake, progress):
    """
    What the count found, as a document somebody signs.

    Missing copies and copies out on loan are listed separately, because they
    are different problems: one is a shelf that needs searching, the other is a
    pupil who needs asking.
    """
    context = document_context(
        'Stocktake report',
        subtitle=f'{stocktake.name} · started {stocktake.started_at:%d %b %Y}',
        stocktake=stocktake, **progress)
    return pdf_response('documents/library_stocktake.html', context,
                        f'stocktake-{stocktake.name}')


def usage_pdf(report, label):
    """What the collection is doing: what moves, what never does."""
    context = document_context('Library usage', subtitle=label, **report)
    return pdf_response('documents/library_usage.html', context, 'library-usage')


def catalogue_pdf(books, label):
    """The shelf list."""
    context = document_context('Catalogue', subtitle=label,
                               books=books, count=len(books))
    return pdf_response('documents/library_catalogue.html', context, 'catalogue')
