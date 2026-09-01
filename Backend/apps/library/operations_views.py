"""
The rest of running a library: counting it, chasing it, labelling it, loading
it, and knowing what it does.

Kept out of `views.py`, which is the circulation desk -- issue, return, renew,
reserve. This is the work that happens when nobody is at the desk.

Every list answers `?format=csv` and, where a printed version is the point,
`?format=pdf`. Exports are built from the filtered queryset before any display
cap: a librarian who exports a chase list and silently receives the first 200
of 300 has been misled by their own tools.
"""
import csv
import io
from datetime import datetime

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response

from apps.authentication.models import User
from apps.common import documents

from . import documents as library_documents
from . import services
from .models import Book, BookCopy, CopyEvent, Loan, Stocktake, StocktakeScan
from .serializers import (
    BookCopySerializer, BookSerializer, CopyEventSerializer, LoanSerializer,
    StocktakeSerializer, StocktakeScanSerializer,
)
from .views import LibrarianView, LibraryView


def _fail(message, status=400):
    return Response({'detail': message}, status=status)


def _class_label(request):
    grade = (request.query_params.get('grade') or '').strip()
    stream = (request.query_params.get('stream') or '').strip()
    if grade and stream:
        return f'{grade}{stream}'
    return grade or (f'Stream {stream}' if stream else 'All classes')


def _borrower_class(user):
    profile = getattr(user, 'student_profile', None)
    return f'{profile.grade}{profile.section}' if profile else ''


def _borrower_name(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.username


# ── Chasing what is late ──────────────────────────────────────────────────────

class OverdueView(LibrarianView):
    """
    Every book out past its due date, filterable by class.

    Filterable by class because that is how a school actually chases: the list
    goes to a form teacher for one register, not to two hundred pupils.
    """

    def get(self, request):
        loans = services.overdue_loans(
            grade=(request.query_params.get('grade') or '').strip(),
            stream=(request.query_params.get('stream') or '').strip())
        today = timezone.localdate()
        label = _class_label(request)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'overdue-{label}',
                ['Borrower', 'Class', 'Title', 'Copy', 'Issued', 'Due', 'Days late'],
                ([_borrower_name(l.borrower), _borrower_class(l.borrower),
                  l.copy.book.title, l.copy.copy_code,
                  l.issued_at.date(), l.due_on, (today - l.due_on).days]
                 for l in loans))
        if documents.wants(request, 'pdf'):
            return library_documents.overdue_pdf(loans, label)

        return Response(LoanSerializer(loans, many=True).data)


class NoticesView(LibrarianView):
    """One printable notice per borrower, rather than one list naming everybody."""

    def get(self, request):
        loans = services.overdue_loans(
            grade=(request.query_params.get('grade') or '').strip(),
            stream=(request.query_params.get('stream') or '').strip())
        today = timezone.localdate()

        groups = {}
        for loan in loans:
            key = str(loan.borrower_id)
            group = groups.setdefault(key, {
                'borrower_name': _borrower_name(loan.borrower),
                'class_label': _borrower_class(loan.borrower),
                'owed': services.outstanding_fines_for(loan.borrower),
                'loans': [],
            })
            group['loans'].append({
                'title': loan.copy.book.title,
                'copy_code': loan.copy.copy_code,
                'due_on': loan.due_on,
                'days_late': (today - loan.due_on).days,
            })

        ordered = sorted(groups.values(), key=lambda g: g['borrower_name'])
        return library_documents.notices_pdf(ordered, _class_label(request))


class BorrowerHistoryView(LibrarianView):
    """Everything one reader has borrowed, and where they stand today."""

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        history = services.borrower_history(user)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'borrower-{_borrower_name(user)}',
                ['Title', 'Copy', 'Issued', 'Due', 'Returned'],
                ([l.copy.book.title, l.copy.copy_code, l.issued_at.date(),
                  l.due_on, l.returned_at.date() if l.returned_at else '']
                 for l in history['loans']))
        if documents.wants(request, 'pdf'):
            return library_documents.borrower_pdf(history)

        return Response({
            'borrower': {'id': str(user.id), 'name': _borrower_name(user),
                         'class_label': _borrower_class(user), 'role': user.role},
            'loans': LoanSerializer(history['loans'], many=True).data,
            'open_loans': LoanSerializer(history['open_loans'], many=True).data,
            'overdue': LoanSerializer(history['overdue'], many=True).data,
            'total_borrowed': history['total_borrowed'],
            'owed': str(history['owed']),
            'block': history['block'],
        })


# ── A copy's fate ─────────────────────────────────────────────────────────────

class CopyEventView(LibrarianView):
    """
    Mark a copy lost, damaged, repaired, found or written off.

    The event is the record; the copy's status is only where it left things.
    """

    def get(self, request, pk):
        copy = get_object_or_404(BookCopy, pk=pk)
        return Response(CopyEventSerializer(copy.events.all(), many=True).data)

    def post(self, request, pk):
        copy = get_object_or_404(BookCopy, pk=pk)
        borrower = None
        if request.data.get('borrower'):
            borrower = get_object_or_404(User, pk=request.data['borrower'])
        try:
            event = services.record_copy_event(
                copy, request.data.get('kind', ''),
                reason=request.data.get('reason', ''),
                borrower=borrower,
                charged=request.data.get('charged') or None,
                recorded_by=request.user)
        except services.LibraryError as exc:
            return _fail(str(exc))
        return Response(CopyEventSerializer(event).data, status=201)


class LostAndDamagedView(LibrarianView):
    """The copies that are not on the shelf and not on loan."""

    def get(self, request):
        copies = (BookCopy.objects.select_related('book')
                  .filter(Q(status__in=['lost', 'withdrawn']) | Q(condition='damaged'))
                  .prefetch_related('events'))
        which = (request.query_params.get('status') or '').strip()
        if which == 'lost':
            copies = copies.filter(status='lost')
        elif which == 'damaged':
            copies = copies.filter(condition='damaged').exclude(status='withdrawn')
        elif which == 'withdrawn':
            copies = copies.filter(status='withdrawn')

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'lost-and-damaged',
                ['Copy', 'Title', 'Author', 'Status', 'Condition', 'Price'],
                ([c.copy_code, c.book.title, c.book.author, c.get_status_display(),
                  c.get_condition_display(), c.price] for c in copies))

        return Response(BookCopySerializer(copies, many=True).data)


# ── Counting the shelves ──────────────────────────────────────────────────────

class StocktakeListView(LibrarianView):
    def get(self, request):
        return Response(StocktakeSerializer(Stocktake.objects.all(), many=True).data)

    def post(self, request):
        serializer = StocktakeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stocktake = serializer.save(started_by=request.user)
        return Response(StocktakeSerializer(stocktake).data, status=201)


class StocktakeDetailView(LibrarianView):
    def get(self, request, pk):
        stocktake = get_object_or_404(Stocktake, pk=pk)
        progress = services.stocktake_progress(stocktake)

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                f'stocktake-{stocktake.name}',
                ['Copy', 'Title', 'Author', 'Shelf', 'State'],
                ([c.copy_code, c.book.title, c.book.author, c.book.shelf,
                  'unaccounted for'] for c in progress['unaccounted_copies']))
        if documents.wants(request, 'pdf'):
            return library_documents.stocktake_pdf(stocktake, progress)

        return Response({
            'stocktake': StocktakeSerializer(stocktake).data,
            'total': progress['total'],
            'seen': progress['seen'],
            'on_loan': progress['on_loan'],
            'unaccounted': progress['unaccounted'],
            'percent_seen': progress['percent_seen'],
            'unaccounted_copies': BookCopySerializer(
                progress['unaccounted_copies'][:300], many=True).data,
        })

    def delete(self, request, pk):
        stocktake = get_object_or_404(Stocktake, pk=pk)
        if stocktake.status == 'closed':
            return _fail('A closed count is a record. Start a new one instead.')
        stocktake.status = 'abandoned'
        stocktake.save(update_fields=['status'])
        return Response(StocktakeSerializer(stocktake).data)


class StocktakeScanView(LibrarianView):
    """
    Tick one copy off by its barcode.

    Takes `copy_code` rather than an id: the person counting is holding a
    scanner pointed at a book, and the scanner types the code.
    """

    def post(self, request, pk):
        stocktake = get_object_or_404(Stocktake, pk=pk)
        code = (request.data.get('copy_code') or '').strip()
        copy = (BookCopy.objects.filter(copy_code__iexact=code).first()
                if code else BookCopy.objects.filter(pk=request.data.get('copy')).first())
        if copy is None:
            return _fail(f'No copy with the code "{code}".' if code
                         else 'Which copy?')
        try:
            scan, created = services.record_scan(
                stocktake, copy, found_as=request.data.get('found_as', 'shelf'),
                note=request.data.get('note', ''), scanned_by=request.user)
        except services.LibraryError as exc:
            return _fail(str(exc))
        return Response({**StocktakeScanSerializer(scan).data,
                         'already_seen': not created,
                         'progress': {k: v for k, v in
                                      services.stocktake_progress(stocktake).items()
                                      if not k.endswith('_copies')}},
                        status=201 if created else 200)

    def get(self, request, pk):
        stocktake = get_object_or_404(Stocktake, pk=pk)
        return Response(StocktakeScanSerializer(
            stocktake.scans.select_related('copy__book')[:400], many=True).data)


class StocktakeCloseView(LibrarianView):
    def post(self, request, pk):
        stocktake = get_object_or_404(Stocktake, pk=pk)
        try:
            result = services.close_stocktake(
                stocktake, closed_by=request.user,
                # Defaults to False: closing a count and writing books off are
                # two decisions, and the second must be asked for.
                mark_missing=request.data.get('mark_missing') is True)
        except services.LibraryError as exc:
            return _fail(str(exc))
        return Response(result)


# ── Labels ────────────────────────────────────────────────────────────────────

class LabelsView(LibrarianView):
    """
    Spine labels for a set of copies: a whole book's copies, a shelf, or a list.

    Cut up and stuck on books, so this is the one document that is always a PDF.
    """

    def get(self, request):
        copies = BookCopy.objects.select_related('book')
        book_id = request.query_params.get('book')
        shelf = (request.query_params.get('shelf') or '').strip()
        ids = request.query_params.get('copies')
        since = (request.query_params.get('acquired_since') or '').strip()

        if book_id:
            copies = copies.filter(book_id=book_id)
        if shelf:
            copies = copies.filter(book__shelf=shelf)
        if ids:
            copies = copies.filter(pk__in=[i for i in ids.split(',') if i])
        if since:
            copies = copies.filter(acquired_on__gte=since)

        # A sheet of every label in the library is nobody's intention; it is a
        # missing filter. Say so rather than printing 400 pages.
        if not any([book_id, shelf, ids, since]):
            return _fail('Choose a book, a shelf, a date, or specific copies.')

        return library_documents.labels_pdf(list(copies[:600]))


# ── Loading a catalogue ───────────────────────────────────────────────────────

class BookImportView(LibrarianView):
    """
    Load a catalogue from CSV. A school with 3,000 books will not type them in.

    GET returns the template so nobody has to guess the column names.
    """

    def get(self, request):
        return documents.csv_response(
            'catalogue-template', list(services.IMPORT_COLUMNS),
            [['Things Fall Apart', 'Chinua Achebe', '9780385474542', 'Fiction',
              'F-ACH', '1958', 'Anchor', '3', 'TFA']])

    def post(self, request):
        upload = request.FILES.get('file')
        if upload is None:
            return _fail('Attach a CSV file.')
        try:
            text = upload.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return _fail('That file is not UTF-8 text. Export it from your '
                         'spreadsheet as CSV and try again.')

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return _fail('That file has no header row.')
        missing = {'title'} - {(f or '').strip().lower() for f in reader.fieldnames}
        if missing:
            return _fail('The file needs at least a "title" column.')

        rows = [{(k or '').strip().lower(): (v or '') for k, v in row.items()}
                for row in reader]
        if len(rows) > 5000:
            return _fail('That is more than 5,000 rows. Split the file.')

        result = services.import_books(rows, created_by=request.user)
        return Response(result, status=201)


# ── What the collection does ──────────────────────────────────────────────────

class UsageReportView(LibrarianView):
    def get(self, request):
        since = (request.query_params.get('from') or '').strip() or None
        until = (request.query_params.get('to') or '').strip() or None
        report = services.usage_report(since=since, until=until,
                                       limit=int(request.query_params.get('limit') or 20))
        label = f'{since or "the beginning"} to {until or "today"}'

        if documents.wants(request, 'csv'):
            return documents.csv_response(
                'library-usage', ['Title', 'Author', 'Times borrowed'],
                ([b['copy__book__title'], b['copy__book__author'], b['times']]
                 for b in report['popular']))
        if documents.wants(request, 'pdf'):
            return library_documents.usage_pdf(report, label)

        return Response({
            'total_loans': report['total_loans'],
            'popular': report['popular'],
            'dead_stock': BookSerializer(report['dead_stock'], many=True).data,
            'by_class': report['by_class'],
            'by_category': report['by_category'],
        })


class CatalogueExportView(LibraryView):
    """The shelf list, as a spreadsheet or a printed catalogue."""

    def get(self, request):
        books = Book.objects.prefetch_related('copies').order_by('title')
        category = (request.query_params.get('category') or '').strip()
        shelf = (request.query_params.get('shelf') or '').strip()
        search = (request.query_params.get('q') or '').strip()
        if category:
            books = books.filter(category=category)
        if shelf:
            books = books.filter(shelf=shelf)
        if search:
            books = books.filter(Q(title__icontains=search)
                                 | Q(author__icontains=search)
                                 | Q(isbn__icontains=search))

        label = shelf or category or 'Whole collection'
        if documents.wants(request, 'pdf'):
            return library_documents.catalogue_pdf(list(books), label)

        annotated = books.annotate(
            copy_count=Count('copies'),
            available=Count('copies', filter=Q(copies__status='available')))
        return documents.csv_response(
            'catalogue',
            ['Title', 'Author', 'ISBN', 'Category', 'Shelf', 'Publisher',
             'Year', 'Copies', 'Available'],
            ([b.title, b.author, b.isbn, b.category, b.shelf, b.publisher,
              b.published_year, b.copy_count, b.available] for b in annotated))


class LoanExportView(LibrarianView):
    """Circulation history as a spreadsheet."""

    def get(self, request):
        loans = Loan.objects.select_related('copy__book', 'borrower')
        state = (request.query_params.get('state') or '').strip()
        if state == 'open':
            loans = loans.filter(returned_at__isnull=True)
        elif state == 'returned':
            loans = loans.filter(returned_at__isnull=False)
        since = (request.query_params.get('from') or '').strip()
        until = (request.query_params.get('to') or '').strip()
        if since:
            loans = loans.filter(issued_at__date__gte=since)
        if until:
            loans = loans.filter(issued_at__date__lte=until)

        return documents.csv_response(
            'loans',
            ['Borrower', 'Class', 'Title', 'Copy', 'Issued', 'Due', 'Returned',
             'Renewals'],
            ([_borrower_name(l.borrower), _borrower_class(l.borrower),
              l.copy.book.title, l.copy.copy_code, l.issued_at.date(), l.due_on,
              l.returned_at.date() if l.returned_at else '', l.renewed_count]
             for l in loans))
