from rest_framework import serializers

from apps.student.models import Fee

from .models import (
    Expense, ExpenseCategory, FeePayment, FeeStructure, FinanceSettings,
    StudentAccount,
)
from . import services


def student_brief(student):
    """A student as the finance office needs them: who, which class, what id."""
    if student is None:
        return None
    return {
        'id': str(student.id),
        'name': student.full_name,
        'student_id': student.student_id,
        'class_label': f'{student.grade}{student.section}',
    }


class FeePaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()
    student          = serializers.SerializerMethodField()
    category         = serializers.CharField(source='fee.category', read_only=True)
    is_reversed      = serializers.BooleanField(read_only=True)

    class Meta:
        model = FeePayment
        fields = ['id', 'fee', 'student', 'category', 'amount', 'method',
                  'reference', 'receipt_no', 'paid_on', 'payer_name', 'notes',
                  'received_by', 'received_by_name', 'is_reversed',
                  'reversed_at', 'reversal_reason', 'created_at']
        read_only_fields = ['id', 'receipt_no', 'created_at', 'reversed_at',
                            'reversal_reason', 'received_by']

    def get_received_by_name(self, obj):
        return obj.received_by.get_full_name() if obj.received_by else ''

    def get_student(self, obj):
        return student_brief(obj.fee.student)


class FeeSerializer(serializers.ModelSerializer):
    """
    A charge, with what has been received against it.

    `paid` and `balance` are computed from the payments, never stored -- a
    balance in a column and a balance from the rows eventually disagree, and
    the column is the one people trust.
    """
    student  = serializers.SerializerMethodField()
    paid     = serializers.SerializerMethodField()
    balance  = serializers.SerializerMethodField()
    payments = FeePaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Fee
        fields = ['id', 'student', 'category', 'amount', 'paid', 'balance',
                  'due_date', 'status', 'paid_date', 'term', 'notes', 'payments']
        read_only_fields = ['id', 'status', 'paid_date']

    def get_student(self, obj):
        return student_brief(obj.student)

    def get_paid(self, obj):
        return str(services.paid_total(obj))

    def get_balance(self, obj):
        return str(services.balance_of(obj))


class FeeStructureSerializer(serializers.ModelSerializer):
    class_label = serializers.CharField(read_only=True)
    term_name   = serializers.CharField(source='term.name', read_only=True)

    class Meta:
        model = FeeStructure
        fields = ['id', 'term', 'term_name', 'grade', 'section', 'class_label',
                  'category', 'amount', 'due_date', 'is_mandatory', 'notes',
                  'created_at']
        read_only_fields = ['id', 'created_at', 'class_label', 'term_name']


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name', 'description', 'is_active']
        read_only_fields = ['id']


class ExpenseSerializer(serializers.ModelSerializer):
    category_name    = serializers.CharField(source='category.name', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = ['id', 'category', 'category_name', 'description', 'amount',
                  'spent_on', 'payee', 'method', 'reference', 'status', 'term',
                  'recorded_by', 'recorded_by_name', 'approved_by',
                  'approved_by_name', 'decided_at', 'decision_note', 'created_at']
        read_only_fields = ['id', 'created_at', 'status', 'recorded_by',
                            'approved_by', 'decided_at']

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.get_full_name() if obj.recorded_by else ''

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() if obj.approved_by else ''


class StudentAccountSerializer(serializers.ModelSerializer):
    student_detail = serializers.SerializerMethodField()

    class Meta:
        model = StudentAccount
        fields = ['id', 'student', 'student_detail', 'payer_name', 'payer_phone',
                  'bursary_percent', 'arrangement', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def get_student_detail(self, obj):
        return student_brief(obj.student)


class FinanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceSettings
        fields = ['id', 'currency', 'receipt_prefix', 'late_fee_percent',
                  'grace_days', 'bank_details', 'updated_at']
        read_only_fields = ['id', 'updated_at']
