from decimal import Decimal

from django.db import models
from rest_framework import serializers

from apps.student.models import Fee

from .models import (
    Budget, BudgetLine, CashAccount, CashMovement, Expense, ExpenseCategory,
    FeePayment, FeeStructure, FinanceSettings, IncomeCategory, OtherIncome,
    PayrollRun, Payslip, Reconciliation, StaffSalary, StudentAccount,
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


# ── Cash and bank ─────────────────────────────────────────────────────────────

class CashAccountSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = CashAccount
        fields = ['id', 'name', 'kind', 'kind_label', 'reference', 'opening_balance',
                  'is_default', 'is_active', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']


class CashMovementSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    kind_label   = serializers.CharField(source='get_kind_display', read_only=True)
    receipt_no   = serializers.CharField(source='payment.receipt_no', read_only=True,
                                         default='')

    class Meta:
        model = CashMovement
        fields = ['id', 'account', 'account_name', 'kind', 'kind_label', 'amount',
                  'occurred_on', 'description', 'receipt_no', 'transfer_group',
                  'created_at']
        read_only_fields = fields


class ReconciliationSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    counted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Reconciliation
        fields = ['id', 'account', 'account_name', 'counted_on', 'book_balance',
                  'counted_balance', 'difference', 'note', 'counted_by_name',
                  'created_at']
        read_only_fields = ['id', 'book_balance', 'difference', 'created_at']

    def get_counted_by_name(self, obj):
        user = obj.counted_by
        return f'{user.first_name} {user.last_name}'.strip() if user else ''


# ── Income that is not school fees ────────────────────────────────────────────

class IncomeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomeCategory
        fields = ['id', 'name', 'description', 'is_active']
        read_only_fields = ['id']


class OtherIncomeSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name  = serializers.CharField(source='account.name', read_only=True,
                                          default='')
    method_label  = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = OtherIncome
        fields = ['id', 'category', 'category_name', 'description', 'amount',
                  'method', 'method_label', 'reference', 'received_on',
                  'account', 'account_name', 'created_at']
        read_only_fields = ['id', 'created_at']


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetLineSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = BudgetLine
        fields = ['id', 'category', 'category_name', 'planned', 'note']
        read_only_fields = ['id']


class BudgetSerializer(serializers.ModelSerializer):
    lines      = BudgetLineSerializer(many=True, read_only=True)
    term_label = serializers.SerializerMethodField()
    planned_total = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = ['id', 'name', 'term', 'term_label', 'status', 'note', 'lines',
                  'planned_total', 'approved_at', 'created_at']
        read_only_fields = ['id', 'term', 'approved_at', 'created_at']

    def get_term_label(self, obj):
        return f'Term {obj.term.term} {obj.term.year}' if obj.term else ''

    def get_planned_total(self, obj):
        return str(sum((line.planned for line in obj.lines.all()), Decimal('0.00')))


# ── Payroll ───────────────────────────────────────────────────────────────────

class StaffSalarySerializer(serializers.ModelSerializer):
    staff_name   = serializers.SerializerMethodField()
    role         = serializers.CharField(source='staff.role', read_only=True)
    net_estimate = serializers.SerializerMethodField()

    class Meta:
        model = StaffSalary
        fields = ['id', 'staff', 'staff_name', 'role', 'gross', 'allowances',
                  'pension_percent', 'tax_percent', 'other_deduction',
                  'net_estimate', 'bank_account', 'is_active', 'note', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def get_staff_name(self, obj):
        user = obj.staff
        return f'{user.first_name} {user.last_name}'.strip() or user.username

    def get_net_estimate(self, obj):
        return str(obj.net_estimate)


class PayslipSerializer(serializers.ModelSerializer):
    total_deductions = serializers.SerializerMethodField()

    class Meta:
        model = Payslip
        fields = ['id', 'staff', 'staff_name', 'role', 'gross', 'allowances',
                  'pension', 'tax', 'other_deduction', 'total_deductions', 'net',
                  'bank_account', 'note']
        read_only_fields = fields

    def get_total_deductions(self, obj):
        return str(obj.total_deductions)


class PayrollRunSerializer(serializers.ModelSerializer):
    period_label  = serializers.CharField(read_only=True)
    status_label  = serializers.CharField(source='get_status_display', read_only=True)
    staff_count   = serializers.SerializerMethodField()
    net_total     = serializers.SerializerMethodField()
    prepared_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = ['id', 'period_month', 'period_year', 'period_label', 'status',
                  'status_label', 'note', 'staff_count', 'net_total', 'paid_on',
                  'account', 'prepared_by_name', 'approved_by_name', 'approved_at',
                  'created_at']
        read_only_fields = ['id', 'status', 'paid_on', 'approved_at', 'created_at']

    def get_staff_count(self, obj):
        return obj.payslips.count()

    def get_net_total(self, obj):
        return str(obj.payslips.aggregate(t=models.Sum('net'))['t'] or Decimal('0.00'))

    def _name(self, user):
        return f'{user.first_name} {user.last_name}'.strip() if user else ''

    def get_prepared_by_name(self, obj):
        return self._name(obj.prepared_by)

    def get_approved_by_name(self, obj):
        return self._name(obj.approved_by)
