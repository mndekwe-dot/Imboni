from django.utils.text import slugify
from rest_framework import serializers

from .models import Department, StaffMember

# Held by the linked account; changed there, never on the register.
ACCOUNT_FIELDS = ('first_name', 'last_name', 'email', 'phone')


class DepartmentSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    head_name    = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'code', 'name', 'description', 'head', 'head_name', 'is_active',
                  'sort_order', 'member_count']
        read_only_fields = ['id', 'member_count', 'head_name']
        extra_kwargs = {'code': {'required': False}}

    def get_member_count(self, obj):
        annotated = getattr(obj, 'active_members', None)
        return annotated if annotated is not None else obj.members.filter(is_active=True).count()

    def get_head_name(self, obj):
        return obj.head.full_name if obj.head_id else ''

    def validate(self, attrs):
        if not self.instance and not attrs.get('code'):
            attrs['code'] = slugify(attrs.get('name', ''))[:30].replace('-', '_')
        if self.instance and 'code' in attrs and attrs['code'] != self.instance.code:
            raise serializers.ValidationError({'code': 'A department code cannot change. Rename it instead.'})
        if not attrs.get('code', getattr(self.instance, 'code', '')):
            raise serializers.ValidationError({'name': 'Give the department a name.'})
        return attrs


class StaffMemberSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(read_only=True)
    department_name = serializers.SerializerMethodField()
    department_code = serializers.SerializerMethodField()
    has_account     = serializers.SerializerMethodField()
    account_role    = serializers.SerializerMethodField()
    salary          = serializers.SerializerMethodField()

    class Meta:
        model = StaffMember
        fields = ['id', 'user', 'first_name', 'last_name', 'full_name', 'staff_no', 'job_title',
                  'department', 'department_name', 'department_code', 'employment_type', 'phone',
                  'email', 'national_id', 'start_date', 'end_date', 'is_active', 'note',
                  'has_account', 'account_role', 'salary', 'updated_at']
        read_only_fields = ['id', 'user', 'updated_at']

    def get_department_name(self, obj):
        return obj.department.name if obj.department_id else ''

    def get_department_code(self, obj):
        return obj.department.code if obj.department_id else ''

    def get_has_account(self, obj):
        return obj.user_id is not None

    def get_account_role(self, obj):
        return obj.user.role if obj.user_id else ''

    def get_salary(self, obj):
        salary = getattr(obj, 'salary', None)
        if salary is None:
            return None
        return {'id': str(salary.id), 'gross': str(salary.gross),
                'net_estimate': str(salary.net_estimate), 'is_active': salary.is_active}

    def validate(self, attrs):
        member = self.instance
        if member and member.user_id:
            moved = [f for f in ACCOUNT_FIELDS if f in attrs and attrs[f] != getattr(member, f)]
            if moved:
                raise serializers.ValidationError(
                    {moved[0]: 'This comes from their Imboni account. Change it on the account.'})
        first = attrs.get('first_name', getattr(member, 'first_name', ''))
        if not (first or '').strip():
            raise serializers.ValidationError({'first_name': 'A worker needs a name.'})
        staff_no = (attrs.get('staff_no') or '').strip()
        if 'staff_no' in attrs:
            attrs['staff_no'] = staff_no
        if staff_no and StaffMember.objects.filter(staff_no=staff_no).exclude(
                pk=getattr(member, 'pk', None)).exists():
            raise serializers.ValidationError({'staff_no': 'Another worker already has that staff number.'})
        start = attrs.get('start_date', getattr(member, 'start_date', None))
        end = attrs.get('end_date', getattr(member, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'They cannot leave before they started.'})
        return attrs
