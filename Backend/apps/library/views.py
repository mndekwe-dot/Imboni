"""
The library API.

Every endpoint here is gated twice: by ROLE (who is asking) and by PLAN (whether
this school bought the library at all). The plan check is `enforce_feature`,
which raises 402 -- the request is not forbidden, it is unpaid for, and the
frontend already reads 402 as "show the upgrade path".
"""
from decimal import Decimal, InvalidOperation

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import User
from apps.authentication.permissions import (
    IsLibrarian, IsLibrarianOrAdmin, IsStudent,
)
from apps.tenants.limits import enforce_feature, tenant_has_feature

from .models import (
    AcquisitionRequest, Book, BookCopy, Fine, LibrarySettings, Loan,
    Reservation, Supplier,
)
from .serializers import (
    AcquisitionRequestSerializer, BookDetailSerializer, BookSerializer,
    BookCopySerializer, FineSerializer, LibrarySettingsSerializer,
    LoanSerializer, ReservationSerializer, SupplierSerializer, person,
)
from . import services

LIBRARY = 'library'
LIBRARY_LABEL = 'The library'


class LibraryView(APIView):
    """
    Base class: authenticated, on a plan that includes the library.

    Subclasses add their own role permission. The feature check sits in
    `initial` so it runs for every method without each view remembering.
    """
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        enforce_feature(LIBRARY, LIBRARY_LABEL)


class LibrarianView(LibraryView):
    permission_classes = [IsLibrarian]


# ── Whether the library is switched on at all ─────────────────────────────────

class LibraryAvailabilityView(APIView):
    """
    Is the library part of this school's plan?

    Deliberately NOT gated by the feature it reports on: the frontend asks this
    to decide whether to show the portal, and an endpoint that 402s would leave
    it unable to tell "not on your plan" from "the server is down".
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'enabled': tenant_has_feature(LIBRARY)})


# ── Catalogue ─────────────────────────────────────────────────────────────────

def _search(qs, term):
    if not term:
        return qs
    return qs.filter(
        Q(title__icontains=term) | Q(author__icontains=term)
        | Q(isbn__icontains=term) | Q(subject__icontains=term)
    )


class BookListView(LibrarianView):
    def get(self, request):
        qs = Book.objects.all().prefetch_related('copies')
        qs = _search(qs, request.query_params.get('q', '').strip())
        category = request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)
        if request.query_params.get('available') == 'true':
            qs = qs.filter(copies__status='available').distinct()
        return Response(BookSerializer(qs, many=True).data)

    def post(self, request):
        serializer = BookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = serializer.save()
        return Response(BookSerializer(book).data, status=201)


class BookDetailView(LibrarianView):
    def get(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        return Response(BookDetailSerializer(book).data)

    def patch(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        serializer = BookSerializer(book, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(BookSerializer(book).data)

    def delete(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        # A title with a copy still out is history, not stock: deleting it would
        # orphan the loan that proves who has it.
        if Loan.objects.filter(copy__book=book, returned_at__isnull=True).exists():
            return Response({'detail': 'A copy of this title is still on loan.'}, status=400)
        book.delete()
        return Response(status=204)


class BookCopyListView(LibrarianView):
    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        data = {**request.data, 'book': str(book.id)}
        serializer = BookCopySerializer(data=data)
        serializer.is_valid(raise_exception=True)
        copy = serializer.save()
        return Response(BookCopySerializer(copy).data, status=201)


class BookCopyDetailView(LibrarianView):
    def patch(self, request, pk):
        copy = get_object_or_404(BookCopy, pk=pk)
        serializer = BookCopySerializer(copy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(BookCopySerializer(copy).data)

    def delete(self, request, pk):
        copy = get_object_or_404(BookCopy, pk=pk)
        if copy.loans.filter(returned_at__isnull=True).exists():
            return Response({'detail': 'That copy is on loan.'}, status=400)
        # Withdrawn rather than deleted when it has a history: the loans that
        # reference it are the record of who had it.
        if copy.loans.exists():
            copy.status = 'withdrawn'
            copy.save(update_fields=['status'])
            return Response(BookCopySerializer(copy).data)
        copy.delete()
        return Response(status=204)


# ── Circulation ───────────────────────────────────────────────────────────────

class LoanListView(LibrarianView):
    def get(self, request):
        # Opening the desk is when lapsed holds are released; this app has no
        # scheduler, and a hold that expired overnight must not still be held.
        services.expire_stale_holds()

        qs = Loan.objects.select_related('copy__book', 'borrower', 'issued_by')
        status_filter = request.query_params.get('status', 'open')
        if status_filter == 'open':
            qs = qs.filter(returned_at__isnull=True)
        elif status_filter == 'overdue':
            qs = qs.filter(returned_at__isnull=True, due_on__lt=timezone.localdate())
        elif status_filter == 'returned':
            qs = qs.filter(returned_at__isnull=False)
        borrower = request.query_params.get('borrower')
        if borrower:
            qs = qs.filter(borrower_id=borrower)
        return Response(LoanSerializer(qs[:300], many=True).data)


class IssueLoanView(LibrarianView):
    def post(self, request):
        code = (request.data.get('copy_code') or '').strip()
        copy_id = request.data.get('copy')
        borrower_id = request.data.get('borrower')

        if not borrower_id:
            return Response({'detail': 'Choose who is borrowing.'}, status=400)
        if code:
            copy = BookCopy.objects.filter(copy_code__iexact=code).first()
            if copy is None:
                return Response({'detail': f'No copy with the code "{code}".'}, status=404)
        elif copy_id:
            copy = get_object_or_404(BookCopy, pk=copy_id)
        else:
            return Response({'detail': 'Scan or choose a copy.'}, status=400)

        borrower = get_object_or_404(User, pk=borrower_id)
        try:
            loan = services.issue(copy, borrower, issued_by=request.user)
        except services.LibraryError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(LoanSerializer(loan).data, status=201)


class ReturnLoanView(LibrarianView):
    def post(self, request, pk):
        loan = get_object_or_404(Loan, pk=pk)
        try:
            loan, fine, reservation = services.return_loan(loan, received_by=request.user)
        except services.LibraryError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({
            'loan': LoanSerializer(loan).data,
            'fine': FineSerializer(fine).data if fine else None,
            # So the desk can be told "put it aside for X" instead of shelving it.
            'held_for': person(reservation.member) if reservation else None,
        })


class RenewLoanView(LibrarianView):
    def post(self, request, pk):
        loan = get_object_or_404(Loan, pk=pk)
        try:
            loan = services.renew(loan)
        except services.LibraryError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(LoanSerializer(loan).data)


# ── Borrowers ─────────────────────────────────────────────────────────────────

class MemberListView(LibrarianView):
    """
    Everyone who may borrow, with what they have out.

    There is no member table -- see the note at the top of models.py -- so this
    is the user roster with the library's own numbers attached.
    """
    def get(self, request):
        term = (request.query_params.get('q') or '').strip()
        qs = (User.objects
              .filter(is_active=True)
              .exclude(role='parent')
              .select_related('student_profile'))
        if term:
            qs = qs.filter(
                Q(first_name__icontains=term) | Q(last_name__icontains=term)
                | Q(email__icontains=term)
                | Q(student_profile__student_id__icontains=term)
            )
        qs = qs.annotate(
            on_loan=Count('library_loans', filter=Q(library_loans__returned_at__isnull=True)),
            overdue=Count('library_loans', filter=Q(
                library_loans__returned_at__isnull=True,
                library_loans__due_on__lt=timezone.localdate())),
        )
        settings_row = LibrarySettings.load()
        out = []
        for user in qs[:200]:
            row = person(user)
            row.update({
                'on_loan': user.on_loan,
                'overdue': user.overdue,
                'limit': settings_row.max_books_for(user),
            })
            out.append(row)
        return Response(out)


class MemberDetailView(LibrarianView):
    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        loans = (Loan.objects.filter(borrower=user)
                 .select_related('copy__book')[:50])
        fines = services.outstanding_fines_for(user)
        return Response({
            'member': person(user),
            'limit': LibrarySettings.load().max_books_for(user),
            'blocked_reason': services.borrowing_block(user),
            'loans': LoanSerializer(loans, many=True).data,
            'outstanding_fines': FineSerializer(fines, many=True).data,
        })


# ── Fines ─────────────────────────────────────────────────────────────────────

class FineListView(LibrarianView):
    def get(self, request):
        qs = Fine.objects.select_related('loan__copy__book', 'loan__borrower')
        if request.query_params.get('status', 'outstanding') == 'outstanding':
            qs = qs.filter(paid=False, waived=False)
        return Response(FineSerializer(qs[:300], many=True).data)


class FineActionView(LibrarianView):
    def post(self, request, pk):
        fine = get_object_or_404(Fine, pk=pk)
        action = request.data.get('action')
        if action == 'pay':
            fine.paid, fine.paid_at = True, timezone.now()
            fine.save(update_fields=['paid', 'paid_at'])
        elif action == 'waive':
            fine.waived = True
            fine.waived_reason = (request.data.get('reason') or '')[:255]
            fine.save(update_fields=['waived', 'waived_reason'])
        else:
            return Response({'detail': 'action must be "pay" or "waive".'}, status=400)
        return Response(FineSerializer(fine).data)


# ── Reservations ──────────────────────────────────────────────────────────────

class ReservationListView(LibrarianView):
    def get(self, request):
        services.expire_stale_holds()
        qs = Reservation.objects.select_related('book', 'member', 'copy')
        if request.query_params.get('status', 'open') == 'open':
            qs = qs.filter(status__in=['waiting', 'ready'])
        return Response(ReservationSerializer(qs[:300], many=True).data)

    def post(self, request):
        book = get_object_or_404(Book, pk=request.data.get('book'))
        member = get_object_or_404(User, pk=request.data.get('member'))
        try:
            res = services.reserve(book, member)
        except services.LibraryError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(ReservationSerializer(res).data, status=201)


class ReservationCancelView(LibraryView):
    """
    Cancelling is done by the librarian, or by the person who is waiting.

    Hence the wider role gate and the ownership check below rather than
    IsLibrarian: a student must be able to leave a queue they joined.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        res = get_object_or_404(Reservation, pk=pk)
        if request.user.role != 'librarian' and res.member_id != request.user.id:
            return Response({'detail': 'That is not your reservation.'}, status=403)
        try:
            res = services.cancel_reservation(res)
        except services.LibraryError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(ReservationSerializer(res).data)


# ── Acquisitions ──────────────────────────────────────────────────────────────

class AcquisitionListView(LibraryView):
    permission_classes = [IsLibrarianOrAdmin]

    def get(self, request):
        qs = AcquisitionRequest.objects.select_related('supplier', 'requested_by', 'decided_by')
        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)
        return Response(AcquisitionRequestSerializer(qs[:300], many=True).data)

    def post(self, request):
        if request.user.role != 'librarian':
            return Response({'detail': 'Only the librarian raises requests.'}, status=403)
        serializer = AcquisitionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = serializer.save(requested_by=request.user, status='pending')
        return Response(AcquisitionRequestSerializer(req).data, status=201)


class AcquisitionDecisionView(LibraryView):
    """Approve or decline. The office decides, not the person who asked."""
    permission_classes = [IsLibrarianOrAdmin]

    def post(self, request, pk):
        req = get_object_or_404(AcquisitionRequest, pk=pk)
        decision = request.data.get('decision')
        if decision not in ('approved', 'declined'):
            return Response({'detail': 'decision must be "approved" or "declined".'}, status=400)
        if request.user.role != 'admin':
            return Response({'detail': 'Only a school administrator decides on a request.'},
                            status=403)
        if req.status != 'pending':
            return Response({'detail': f'That request is already {req.status}.'}, status=400)
        req.status = decision
        req.decided_by = request.user
        req.decided_at = timezone.now()
        req.decision_note = (request.data.get('note') or '')[:255]
        req.save(update_fields=['status', 'decided_by', 'decided_at', 'decision_note'])
        return Response(AcquisitionRequestSerializer(req).data)


class AcquisitionReceiveView(LibrarianView):
    """
    The stock arrived: catalogue the title if it is new, and add the copies.

    Approval and receipt are separate events -- a request approved in March and
    delivered in June is the ordinary case, and until it arrives there is
    nothing to lend.
    """
    def post(self, request, pk):
        req = get_object_or_404(AcquisitionRequest, pk=pk)
        if req.status != 'approved':
            return Response({'detail': 'Only an approved request can be received.'}, status=400)

        book = req.book
        if book is None:
            book = Book.objects.filter(isbn=req.isbn).first() if req.isbn else None
        if book is None:
            book = Book.objects.create(
                title=req.title, author=req.author, isbn=req.isbn,
                category=request.data.get('category', 'other'),
            )

        prefix = (request.data.get('copy_prefix') or 'LIB').upper()
        existing = BookCopy.objects.count()
        created = []
        for index in range(req.quantity):
            created.append(BookCopy.objects.create(
                book=book,
                copy_code=f'{prefix}-{existing + index + 1:05d}',
                acquired_on=timezone.localdate(),
                price=req.unit_price,
                supplier=req.supplier,
            ))

        req.status = 'received'
        req.received_at = timezone.now()
        req.book = book
        req.save(update_fields=['status', 'received_at', 'book'])
        return Response({
            'request': AcquisitionRequestSerializer(req).data,
            'book': BookSerializer(book).data,
            'copies': BookCopySerializer(created, many=True).data,
        }, status=201)


class SupplierListView(LibrarianView):
    def get(self, request):
        return Response(SupplierSerializer(Supplier.objects.all(), many=True).data)

    def post(self, request):
        serializer = SupplierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(SupplierSerializer(serializer.save()).data, status=201)


# ── Settings and dashboard ────────────────────────────────────────────────────

class LibrarySettingsView(LibrarianView):
    def get(self, request):
        return Response(LibrarySettingsSerializer(LibrarySettings.load()).data)

    def put(self, request):
        row = LibrarySettings.load()
        serializer = LibrarySettingsSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(LibrarySettingsSerializer(row).data)


class LibraryDashboardView(LibrarianView):
    def get(self, request):
        services.expire_stale_holds()
        today = timezone.localdate()
        open_loans = Loan.objects.filter(returned_at__isnull=True)
        outstanding = Fine.objects.filter(paid=False, waived=False)

        popular = (Book.objects
                   .annotate(times_borrowed=Count('copies__loans'))
                   .filter(times_borrowed__gt=0)
                   .order_by('-times_borrowed')[:5])

        due_soon = (open_loans
                    .filter(due_on__gte=today)
                    .select_related('copy__book', 'borrower')
                    .order_by('due_on')[:8])

        return Response({
            'titles': Book.objects.count(),
            'copies': BookCopy.objects.exclude(status='withdrawn').count(),
            'on_loan': open_loans.count(),
            'overdue': open_loans.filter(due_on__lt=today).count(),
            'reservations': Reservation.objects.filter(status__in=['waiting', 'ready']).count(),
            'fines_outstanding': str(sum((f.amount for f in outstanding), Decimal('0'))),
            'pending_acquisitions': AcquisitionRequest.objects.filter(status='pending').count(),
            'popular': [
                {'id': str(b.id), 'title': b.title, 'author': b.author,
                 'times_borrowed': b.times_borrowed}
                for b in popular
            ],
            'due_soon': LoanSerializer(due_soon, many=True).data,
        })


# ── The student's side ────────────────────────────────────────────────────────

class CatalogueView(LibraryView):
    """Read-only catalogue for a student: search, and what is on the shelf."""
    permission_classes = [IsStudent]

    def get(self, request):
        qs = Book.objects.all().prefetch_related('copies')
        qs = _search(qs, request.query_params.get('q', '').strip())
        category = request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)
        return Response(BookSerializer(qs[:200], many=True).data)


class MyLibraryView(LibraryView):
    """What this student has out, what is late, and what they are waiting for."""
    permission_classes = [IsStudent]

    def get(self, request):
        loans = (Loan.objects.filter(borrower=request.user)
                 .select_related('copy__book').order_by('-issued_at')[:50])
        reservations = (Reservation.objects
                        .filter(member=request.user, status__in=['waiting', 'ready'])
                        .select_related('book'))
        fines = services.outstanding_fines_for(request.user)
        return Response({
            'loans': LoanSerializer(loans, many=True).data,
            'reservations': ReservationSerializer(reservations, many=True).data,
            'fines': FineSerializer(fines, many=True).data,
            'limit': LibrarySettings.load().max_books_for(request.user),
        })


class MyReserveView(LibraryView):
    permission_classes = [IsStudent]

    def post(self, request):
        book = get_object_or_404(Book, pk=request.data.get('book'))
        try:
            res = services.reserve(book, request.user)
        except services.LibraryError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(ReservationSerializer(res).data, status=201)
