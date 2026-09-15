from decimal import Decimal

from django.db import models
from rest_framework import serializers

from apps.student.models import Fee, Student

from .models import (
    Budget, BudgetLine, CashAccount, CashMovement, Expense, ExpenseCategory,
    FeeCategory, FeeDiscount, FeePayment, FeeStructure, FinanceSettings, IncomeCategory,
    OtherIncome,
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


def _label(serializer, code):
    """A category name, with the label map read once per response."""
    root = serializer.root
    if not hasattr(root, '_category_labels'):
        root._category_labels = services.category_labels()
    return services.category_label(code, root._category_labels)


class FeePaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()
    student          = serializers.SerializerMethodField()
    category_name    = serializers.SerializerMethodField()
    category         = serializers.CharField(source='fee.category', read_only=True)
    is_reversed      = serializers.BooleanField(read_only=True)

    class Meta:
        model = FeePayment
        fields = ['id', 'fee', 'student', 'category', 'category_name', 'amount', 'method',
                  'reference', 'receipt_no', 'paid_on', 'payer_name', 'notes',
                  'received_by', 'received_by_name', 'is_reversed',
                  'reversed_at', 'reversal_reason', 'created_at']
        read_only_fields = ['id', 'receipt_no', 'created_at', 'reversed_at',
                            'reversal_reason', 'received_by']

    def get_received_by_name(self, obj):
        return obj.received_by.get_full_name() if obj.received_by else ''

    def get_student(self, obj):
        return student_brief(obj.fee.student)

    def get_category_name(self, obj):
        return _label(self, obj.fee.category) if obj.fee else ''


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
    # Any FeeCategory code, not only the six the model was born with.
    category = serializers.CharField(max_length=20)
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Fee
        fields = ['id', 'student', 'category', 'category_name', 'amount', 'paid', 'balance',
                  'due_date', 'status', 'paid_date', 'term', 'notes', 'payments']
        read_only_fields = ['id', 'status', 'paid_date']

    def get_student(self, obj):
        return student_brief(obj.student)

    def get_category_name(self, obj):
        return _label(self, obj.category)

    def get_paid(self, obj):
        return str(services.paid_total(obj))

    def get_balance(self, obj):
        return str(services.balance_of(obj))


class FeeCategorySerializer(serializers.ModelSerializer):
    in_use = serializers.SerializerMethodField()

    class Meta:
        model = FeeCategory
        fields = ['id', 'code', 'name', 'description', 'is_active', 'sort_order', 'in_use']
        read_only_fields = ['id', 'in_use']
        extra_kwargs = {'code': {'required': False}}

    def get_in_use(self, obj):
        return Fee.objects.filter(category=obj.code).exists()

    def validate(self, attrs):
        from django.utils.text import slugify
        if not self.instance and not attrs.get('code'):
            attrs['code'] = slugify(attrs.get('name', ''))[:20].replace('-', '_')
        if self.instance and 'code' in attrs and attrs['code'] != self.instance.code:
            # Charges already carry the code; renaming it would orphan them.
            raise serializers.ValidationError({'code': 'A category code cannot change. Rename it instead.'})
        if not attrs.get('code', getattr(self.instance, 'code', '')):
            raise serializers.ValidationError({'name': 'Give the category a name.'})
        return attrs


def _student_rows(students):
    return [student_brief(s) for s in students]


def _clean_classes(value):
    if not isinstance(value, list):
        raise serializers.ValidationError('Classes have to be a list.')
    cleaned, seen = [], set()
    for entry in value:
        if not isinstance(entry, dict) or not str(entry.get('grade', '')).strip():
            raise serializers.ValidationError('Each class needs a year.')
        item = {'grade': str(entry['grade']).strip(), 'stream': str(entry.get('stream') or '').strip()}
        key = (item['grade'], item['stream'])
        if key not in seen:
            seen.add(key)
            cleaned.append(item)
    return cleaned


def _check_category(code):
    if not FeeCategory.objects.filter(code=code, is_active=True).exists():
        raise serializers.ValidationError('Pick one of the school\'s fee categories.')
    return code


class FeeStructureSerializer(serializers.ModelSerializer):
    class_label   = serializers.CharField(read_only=True)
    term_name     = serializers.CharField(source='term.name', read_only=True)
    category_name = serializers.SerializerMethodField()
    student_list  = serializers.SerializerMethodField()
    students      = serializers.PrimaryKeyRelatedField(many=True, required=False,
                                                       queryset=Student.objects.all())
    charged       = serializers.SerializerMethodField()

    class Meta:
        model = FeeStructure
        fields = ['id', 'term', 'term_name', 'name', 'category', 'category_name', 'amount',
                  'due_date', 'classes', 'class_label', 'boarding', 'intake', 'frequency',
                  'is_mandatory', 'students', 'student_list', 'instalments', 'notes',
                  'is_active', 'charged', 'created_at']
        read_only_fields = ['id', 'created_at', 'class_label', 'term_name']

    def get_category_name(self, obj):
        return _label(self, obj.category)

    def get_student_list(self, obj):
        return _student_rows(obj.students.select_related('user'))

    def get_charged(self, obj):
        # How many students this line has already billed.
        return obj.charges.values('student').distinct().count()

    def validate_category(self, value):
        return _check_category(value)

    def validate_classes(self, value):
        return _clean_classes(value)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('A fee has to be more than zero.')
        return value

    def validate_instalments(self, value):
        try:
            return services.validate_instalments(value)
        except services.FinanceError as exc:
            raise serializers.ValidationError(str(exc))

    def validate(self, attrs):
        mandatory = attrs.get('is_mandatory', getattr(self.instance, 'is_mandatory', True))
        students = attrs.get('students')
        if students is None and self.instance is not None:
            students = list(self.instance.students.all())
        if not mandatory and not students:
            raise serializers.ValidationError(
                {'students': 'An optional fee is only charged to the students who take it. Add them.'})
        return attrs


class FeeDiscountSerializer(serializers.ModelSerializer):
    student_list = serializers.SerializerMethodField()
    students     = serializers.PrimaryKeyRelatedField(many=True, required=False,
                                                      queryset=Student.objects.all())
    term_name    = serializers.CharField(source='term.name', read_only=True, default='')

    class Meta:
        model = FeeDiscount
        fields = ['id', 'name', 'kind', 'value', 'scope', 'students', 'student_list', 'from_child',
                  'categories', 'term', 'term_name', 'is_active', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at', 'term_name']

    def get_student_list(self, obj):
        return _student_rows(obj.students.select_related('user'))

    def validate_categories(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Categories have to be a list.')
        return [_check_category(code) for code in value]

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', 'percent'))
        value = attrs.get('value', getattr(self.instance, 'value', None))
        if value is None or value <= 0:
            raise serializers.ValidationError({'value': 'A discount has to be more than zero.'})
        if kind == 'percent' and value > 100:
            raise serializers.ValidationError({'value': 'A percentage discount cannot pass 100%.'})
        scope = attrs.get('scope', getattr(self.instance, 'scope', 'students'))
        students = attrs.get('students')
        if students is None and self.instance is not None:
            students = list(self.instance.students.all())
        if scope == 'students' and not students:
            raise serializers.ValidationError({'students': 'Choose the students this discount is for.'})
        return attrs


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
                  'grace_days', 'bank_details', 'paye_bands', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def validate_paye_bands(self, value):
        from . import services
        try:
            return services.validate_paye_bands(value)
        except services.FinanceError as exc:
            raise serializers.ValidationError(str(exc))


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
                  'account', 'account_name', 'refund_of', 'created_at']
        read_only_fields = ['id', 'refund_of', 'created_at']


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
    staff_name   = serializers.CharField(source='staff.full_name', read_only=True)
    job_title    = serializers.CharField(source='staff.job_title', read_only=True)
    department   = serializers.SerializerMethodField()
    net_estimate = serializers.SerializerMethodField()

    class Meta:
        model = StaffSalary
        fields = ['id', 'staff', 'staff_name', 'job_title', 'department', 'gross', 'allowances',
                  'pension_percent', 'tax_method', 'tax_percent', 'other_deduction',
                  'net_estimate', 'bank_account', 'is_active', 'note', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def get_department(self, obj):
        return obj.staff.department.name if obj.staff.department_id else ''

    def get_net_estimate(self, obj):
        return str(obj.net_estimate)


class PayslipSerializer(serializers.ModelSerializer):
    total_deductions = serializers.SerializerMethodField()

    class Meta:
        model = Payslip
        fields = ['id', 'staff', 'staff_name', 'role', 'job_title', 'department', 'gross',
                  'allowances', 'pension', 'tax', 'other_deduction', 'total_deductions', 'net',
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
