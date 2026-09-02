from rest_framework import serializers

from .models import (
    AcquisitionRequest, Book, BookCopy, Fine, LibrarySettings, Loan,
    Reservation, Supplier,
    CopyEvent, Stocktake, StocktakeScan,
)


def person(user):
    """A borrower as the portal needs them: who, which class, how to reach them."""
    if user is None:
        return None
    student = getattr(user, 'student_profile', None)
    return {
        'id': str(user.id),
        'name': user.get_full_name() or user.username,
        'role': user.role,
        'email': user.email,
        'student_id': getattr(student, 'student_id', '') or '',
        'class_label': f'{student.grade}{student.section}' if student else '',
    }


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'contact_name', 'email', 'phone', 'notes',
                  'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class BookCopySerializer(serializers.ModelSerializer):
    book_title    = serializers.CharField(source='book.title', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')

    class Meta:
        model = BookCopy
        fields = ['id', 'book', 'book_title', 'copy_code', 'condition', 'status',
                  'acquired_on', 'price', 'supplier', 'supplier_name', 'notes']
        read_only_fields = ['id', 'book_title', 'supplier_name']


class BookSerializer(serializers.ModelSerializer):
    total_copies     = serializers.IntegerField(read_only=True)
    available_copies = serializers.IntegerField(read_only=True)
    # Who is waiting, so the catalogue can say "3 ahead of you" rather than
    # only "none on the shelf".
    reservations_waiting = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'isbn', 'publisher', 'published_year',
                  'category', 'language', 'subject', 'description', 'shelf',
                  'cover_url', 'total_copies', 'available_copies',
                  'reservations_waiting', 'created_at']
        read_only_fields = ['id', 'created_at', 'total_copies', 'available_copies',
                            'reservations_waiting']

    def get_reservations_waiting(self, obj):
        return obj.reservations.filter(status__in=['waiting', 'ready']).count()


class BookDetailSerializer(BookSerializer):
    copies = BookCopySerializer(many=True, read_only=True)

    class Meta(BookSerializer.Meta):
        fields = BookSerializer.Meta.fields + ['copies']


class LoanSerializer(serializers.ModelSerializer):
    borrower_detail = serializers.SerializerMethodField()
    issued_by_name  = serializers.SerializerMethodField()
    book_title      = serializers.CharField(source='copy.book.title', read_only=True)
    book_author     = serializers.CharField(source='copy.book.author', read_only=True)
    copy_code       = serializers.CharField(source='copy.copy_code', read_only=True)
    # Derived on the model, never stored: see Loan.days_late.
    status          = serializers.CharField(read_only=True)
    days_late       = serializers.IntegerField(read_only=True)
    fine_amount     = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = ['id', 'copy', 'copy_code', 'book_title', 'book_author',
                  'borrower', 'borrower_detail', 'issued_by', 'issued_by_name',
                  'issued_at', 'due_on', 'returned_at', 'renewed_count',
                  'status', 'days_late', 'fine_amount', 'notes']
        read_only_fields = ['id', 'issued_at', 'returned_at', 'renewed_count']

    def get_borrower_detail(self, obj):
        return person(obj.borrower)

    def get_issued_by_name(self, obj):
        return obj.issued_by.get_full_name() if obj.issued_by else ''

    def get_fine_amount(self, obj):
        fine = getattr(obj, 'fine', None)
        return str(fine.amount) if fine else None


class FineSerializer(serializers.ModelSerializer):
    borrower_detail = serializers.SerializerMethodField()
    book_title      = serializers.CharField(source='loan.copy.book.title', read_only=True)
    outstanding     = serializers.BooleanField(read_only=True)

    class Meta:
        model = Fine
        fields = ['id', 'loan', 'book_title', 'borrower_detail', 'days_late',
                  'rate', 'amount', 'paid', 'paid_at', 'waived', 'waived_reason',
                  'outstanding', 'created_at']
        read_only_fields = ['id', 'created_at', 'days_late', 'rate', 'amount']

    def get_borrower_detail(self, obj):
        return person(obj.loan.borrower)


class ReservationSerializer(serializers.ModelSerializer):
    member_detail = serializers.SerializerMethodField()
    book_title    = serializers.CharField(source='book.title', read_only=True)
    book_author   = serializers.CharField(source='book.author', read_only=True)
    position      = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ['id', 'book', 'book_title', 'book_author', 'member',
                  'member_detail', 'status', 'position', 'created_at',
                  'ready_at', 'expires_on', 'copy']
        read_only_fields = ['id', 'created_at', 'ready_at', 'expires_on', 'copy']

    def get_member_detail(self, obj):
        return person(obj.member)

    def get_position(self, obj):
        """
        Place in the queue, counted at read time from created_at.

        A stored position has to be rewritten for everyone behind whoever
        cancels, and one missed rewrite leaves two people at number three.
        """
        if obj.status != 'waiting':
            return None
        ahead = Reservation.objects.filter(
            book=obj.book, status='waiting', created_at__lt=obj.created_at,
        ).count()
        return ahead + 1


class AcquisitionRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    decided_by_name   = serializers.SerializerMethodField()
    supplier_name     = serializers.CharField(source='supplier.name', read_only=True, default='')
    estimated_cost    = serializers.SerializerMethodField()

    class Meta:
        model = AcquisitionRequest
        fields = ['id', 'title', 'author', 'isbn', 'quantity', 'unit_price',
                  'supplier', 'supplier_name', 'reason', 'status',
                  'requested_by', 'requested_by_name', 'decided_by',
                  'decided_by_name', 'decision_note', 'decided_at',
                  'received_at', 'book', 'estimated_cost', 'created_at']
        read_only_fields = ['id', 'created_at', 'status', 'requested_by',
                            'decided_by', 'decided_at', 'received_at', 'book']

    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() if obj.requested_by else ''

    def get_decided_by_name(self, obj):
        return obj.decided_by.get_full_name() if obj.decided_by else ''

    def get_estimated_cost(self, obj):
        return str(obj.estimated_cost)


class LibrarySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibrarySettings
        fields = ['id', 'loan_period_days', 'max_books_student', 'max_books_staff',
                  'renewals_allowed', 'fine_per_day', 'currency',
                  'reservation_hold_days', 'updated_at']
        read_only_fields = ['id', 'updated_at']


# ── Counting, and what happens to a copy ──────────────────────────────────────

class CopyEventSerializer(serializers.ModelSerializer):
    kind_label       = serializers.CharField(source='get_kind_display', read_only=True)
    copy_code        = serializers.CharField(source='copy.copy_code', read_only=True)
    title            = serializers.CharField(source='copy.book.title', read_only=True)
    borrower_name    = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CopyEvent
        fields = ['id', 'copy', 'copy_code', 'title', 'kind', 'kind_label',
                  'reason', 'borrower', 'borrower_name', 'charged',
                  'recorded_by_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def _name(self, user):
        if user is None:
            return ''
        return f'{user.first_name} {user.last_name}'.strip() or user.username

    def get_borrower_name(self, obj):
        return self._name(obj.borrower)

    def get_recorded_by_name(self, obj):
        return self._name(obj.recorded_by)


class StocktakeSerializer(serializers.ModelSerializer):
    status_label    = serializers.CharField(source='get_status_display', read_only=True)
    started_by_name = serializers.SerializerMethodField()
    scanned         = serializers.SerializerMethodField()

    class Meta:
        model = Stocktake
        fields = ['id', 'name', 'scope_shelf', 'scope_category', 'status',
                  'status_label', 'started_at', 'closed_at', 'started_by_name',
                  'scanned', 'note']
        read_only_fields = ['id', 'status', 'started_at', 'closed_at']

    def get_started_by_name(self, obj):
        user = obj.started_by
        return f'{user.first_name} {user.last_name}'.strip() if user else ''

    def get_scanned(self, obj):
        return obj.scans.count()


class StocktakeScanSerializer(serializers.ModelSerializer):
    copy_code  = serializers.CharField(source='copy.copy_code', read_only=True)
    title      = serializers.CharField(source='copy.book.title', read_only=True)
    found_label = serializers.CharField(source='get_found_as_display', read_only=True)

    class Meta:
        model = StocktakeScan
        fields = ['id', 'copy', 'copy_code', 'title', 'found_as', 'found_label',
                  'note', 'scanned_at']
        read_only_fields = fields
