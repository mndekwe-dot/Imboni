from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from . import structure
from .models import SchoolSection, SchoolSetting, Room
from apps.results.models import Subject


class DOSDashboardStatsSerializer(serializers.Serializer):
    """4 stat cards at the top of the DOS dashboard."""
    total_students       = serializers.IntegerField()
    new_students         = serializers.IntegerField()   # enrolled this month
    teaching_staff       = serializers.IntegerField()
    avg_performance      = serializers.FloatField()     # school-wide avg final_score %
    avg_performance_change = serializers.FloatField()   # vs previous term
    pending_approvals    = serializers.IntegerField()   # Results with status='submitted'


class DOSActivitySerializer(serializers.Serializer):
    """One item in the Recent Activity feed."""
    activity_type = serializers.CharField()   # 'approval' | 'staff' | 'pending'
    description   = serializers.CharField()
    timestamp     = serializers.DateTimeField(allow_null=True)
    time_ago      = serializers.CharField()   # human-readable e.g. "2 hours ago"


class PerformanceOverviewSerializer(serializers.Serializer):
    """School Average + Attendance Rate progress bars."""
    school_average  = serializers.FloatField()
    attendance_rate = serializers.FloatField()


class GradePerformanceSerializer(serializers.Serializer):
    """One bar in the Performance by Grade chart."""
    grade       = serializers.CharField()   # the school's own code, e.g. "S1"
    avg_score   = serializers.FloatField()


# ---------------------------------------------------------------------------
# Teacher Management page
# ---------------------------------------------------------------------------

class TeacherManagementStatsSerializer(serializers.Serializer):
    """4 stat cards on the Teacher Management page."""
    total_teachers        = serializers.IntegerField()
    new_this_term         = serializers.IntegerField()   # joined this term
    full_time_count       = serializers.IntegerField()
    full_time_pct         = serializers.FloatField()     # % of staff
    part_time_count       = serializers.IntegerField()
    part_time_pct         = serializers.FloatField()
    student_teacher_ratio = serializers.CharField()      # e.g. "1:15"
    ratio_label           = serializers.CharField()      # "Optimal" | "High" | "Low"


class TeacherListSerializer(serializers.Serializer):
    """One row in the teacher list table."""
    teacher_id      = serializers.UUIDField()
    full_name       = serializers.CharField()
    email           = serializers.CharField()
    phone_number    = serializers.CharField()
    avatar          = serializers.CharField(allow_null=True)
    employment_type = serializers.CharField()   # full_time | part_time
    subjects        = serializers.ListField(child=serializers.CharField())
    class_count     = serializers.IntegerField()
    joined_at       = serializers.DateTimeField()


class AddTeacherSerializer(serializers.Serializer):
    """Payload for POST /imboni/dos/teachers/ (Add Teacher button)."""
    first_name      = serializers.CharField()
    last_name       = serializers.CharField()
    email           = serializers.EmailField()
    phone_number    = serializers.CharField(required=False, allow_blank=True, default='')
    employment_type = serializers.ChoiceField(choices=['full_time', 'part_time'], default='full_time')
    password        = serializers.CharField(write_only=True, min_length=8)


class TeachersBySubjectSerializer(serializers.Serializer):
    """One progress bar row in Teachers by Subject section."""
    subject_id    = serializers.UUIDField()
    subject_name  = serializers.CharField()
    teacher_count = serializers.IntegerField()
    percentage    = serializers.FloatField()   # share of total teachers


class WorkloadBucketSerializer(serializers.Serializer):
    """One bucket in the Workload Distribution chart."""
    label         = serializers.CharField()    # e.g. "1-2 classes"
    teacher_count = serializers.IntegerField()


class PerformanceRatingSerializer(serializers.Serializer):
    """One bucket in the Performance Ratings chart."""
    label         = serializers.CharField()    # Excellent | Good | Average | Needs Improvement
    teacher_count = serializers.IntegerField()
    percentage    = serializers.FloatField()


# ---------------------------------------------------------------------------
# Student Management page
# ---------------------------------------------------------------------------

class StudentManagementStatsSerializer(serializers.Serializer):
    """4 stat cards on the Student Management page."""
    total_students        = serializers.IntegerField()
    new_this_term         = serializers.IntegerField()   # +15 this term badge
    active_students       = serializers.IntegerField()
    enrollment_pct        = serializers.FloatField()     # active / total * 100
    new_admissions        = serializers.IntegerField()   # enrolled this term
    avg_performance       = serializers.FloatField()     # school-wide avg final_score %
    avg_performance_change = serializers.FloatField()    # vs previous term


class DOSStudentSerializer(serializers.Serializer):
    """One row in the student list table."""
    student_id      = serializers.UUIDField()
    student_code    = serializers.CharField()   # e.g. STU-001
    full_name       = serializers.CharField()
    initials        = serializers.CharField()
    grade           = serializers.CharField()   # e.g. "6"
    grade_label     = serializers.CharField()   # the school's own code, e.g. "S6"
    section         = serializers.CharField()
    avg_performance = serializers.FloatField(allow_null=True)
    attendance_rate = serializers.FloatField(allow_null=True)
    status          = serializers.CharField()
    enrollment_date = serializers.DateField()


class YearAndStreamMixin:
    """
    Validate `grade` and `section` against the school's own configuration.

    These were `ChoiceField(choices=['1'..'6'])` and `['A','B','C']` — Imboni's
    own structure written into every payload, which is exactly what stopped a
    primary school or a four-stream school from enrolling anyone. The school's
    configured years and streams are the authority instead.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)
        grade = attrs.get('grade')
        section = attrs.get('section')
        try:
            if grade is not None:
                structure.validate_grade(grade)
            if section is not None:
                structure.validate_section(section, grade)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return attrs


class AddStudentSerializer(YearAndStreamMixin, serializers.Serializer):
    """Payload for POST /imboni/dos/students/ (Add Student button)."""
    first_name      = serializers.CharField()
    last_name       = serializers.CharField()
    email           = serializers.EmailField()
    grade           = serializers.CharField(max_length=10)
    section         = serializers.CharField(max_length=10)
    enrollment_date = serializers.DateField()
    password        = serializers.CharField(write_only=True, min_length=8)


class EnrollmentByGradeSerializer(serializers.Serializer):
    """One progress bar row in the Student Enrollment by Grade section."""
    grade         = serializers.CharField()    # the school's own code, e.g. "S6"
    student_count = serializers.IntegerField()
    percentage    = serializers.FloatField()   # share of total active students


class StudentPerfDistributionSerializer(serializers.Serializer):
    """One slice in the Performance Distribution donut chart."""
    label         = serializers.CharField()    # Excellent | Good | Average | Below
    range_label   = serializers.CharField()    # e.g. ">80%"
    student_count = serializers.IntegerField()
    percentage    = serializers.FloatField()


class EnrollmentTrendSerializer(serializers.Serializer):
    """One data point in the Enrollment Trends line chart."""
    year          = serializers.IntegerField()
    student_count = serializers.IntegerField()


# ---------------------------------------------------------------------------
# Bulk Student Enrollment
# ---------------------------------------------------------------------------

class BulkAddStudentRowSerializer(YearAndStreamMixin, serializers.Serializer):
    """One student row in the bulk-create payload."""
    first_name      = serializers.CharField()
    last_name       = serializers.CharField()
    email           = serializers.EmailField()
    grade           = serializers.CharField(max_length=10)
    section         = serializers.CharField(max_length=10)
    enrollment_date = serializers.DateField()
    password        = serializers.CharField(write_only=True, min_length=8, required=False, default='')


class BulkAddStudentsSerializer(serializers.Serializer):
    """
    Payload for POST /imboni/dos/students/bulk-create/

    {
        "default_password": "Imboni@2025",   // optional, applied when row has no password
        "students": [
            {"first_name": "...", "last_name": "...", "email": "...",
             "grade": "6", "section": "A", "enrollment_date": "2025-01-10"},
            ...
        ]
    }
    """
    default_password = serializers.CharField(required=False, default='Imboni@2025', min_length=8)
    students         = BulkAddStudentRowSerializer(many=True)


class BulkCreateResultSerializer(serializers.Serializer):
    """Summary returned after a bulk-create or CSV import."""
    created = serializers.IntegerField()
    skipped = serializers.IntegerField()   # duplicates
    failed  = serializers.IntegerField()   # validation / DB errors
    errors  = serializers.ListField(child=serializers.DictField())  # [{row, email, error}]


class CSVImportSerializer(serializers.Serializer):
    """
    Payload for POST /imboni/dos/students/import-csv/ (multipart/form-data)

    Required field : file            — CSV file
    Optional fields: default_password, enrollment_date (used when not in CSV)

    Expected CSV columns (case-insensitive headers):
        first_name, last_name, email, grade, section, enrollment_date (optional)
    """
    file             = serializers.FileField()
    default_password = serializers.CharField(required=False, default='Imboni@2025', min_length=8)
    enrollment_date  = serializers.DateField(required=False, allow_null=True)


# ---------------------------------------------------------------------------
# Results Approval
# ---------------------------------------------------------------------------

class DOSResultSerializer(serializers.Serializer):
    id               = serializers.UUIDField()
    student          = serializers.CharField()
    student_id_code  = serializers.CharField()
    grade            = serializers.CharField()
    section          = serializers.CharField()
    subject          = serializers.CharField()
    term             = serializers.CharField()
    class_test_marks = serializers.FloatField(allow_null=True)
    exam_score       = serializers.FloatField()
    final_score      = serializers.FloatField()
    grade_letter     = serializers.CharField()
    teacher_comment  = serializers.CharField()
    dos_comment      = serializers.CharField()
    status           = serializers.CharField()
    submitted_at     = serializers.CharField(allow_null=True)
    teacher          = serializers.CharField()


# ---------------------------------------------------------------------------
# Exam Schedule
# ---------------------------------------------------------------------------

class ExamScheduleSerializer(serializers.Serializer):
    id             = serializers.UUIDField()
    title          = serializers.CharField()
    subject        = serializers.CharField()
    subject_id     = serializers.UUIDField()
    class_name     = serializers.CharField(allow_null=True)
    class_id       = serializers.UUIDField(allow_null=True)
    term           = serializers.CharField()
    exam_date      = serializers.DateField()
    start_time     = serializers.TimeField()
    end_time       = serializers.TimeField()
    venue          = serializers.CharField()
    exam_type      = serializers.CharField()
    invigilator    = serializers.CharField(allow_null=True)
    invigilator_id = serializers.UUIDField(allow_null=True)
    notes          = serializers.CharField()

class SchoolSectionSerializer(serializers.ModelSerializer):
    """
    Converts SchoolSection model to JSON.
    Used by GET /imboni/dos/school-config/ and PUT /imboni/dos/school-config/

    This is the school's own definition of the years it teaches, and everything
    else now validates against it — so it has to validate itself first. It used
    to accept any JSON at all, which meant a malformed save became the school's
    structure.
    """
    class Meta:
        model = SchoolSection
        fields = ['id', 'name', 'years', 'streams', 'is_active', 'academic_term']

    def validate(self, attrs):
        # Reuse the whole-payload validator on a single section so one section
        # posted alone is held to the same rules as a full replace.
        section = {
            'name': attrs.get('name', getattr(self.instance, 'name', '')),
            'years': attrs.get('years', getattr(self.instance, 'years', [])),
            'streams': attrs.get('streams', getattr(self.instance, 'streams', [])),
        }
        try:
            structure.validate_structure([section])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return attrs

class SubjectSerializer(serializers.ModelSerializer):
    """Add / rename / list subjects from DosSettings."""
    exam_weight = serializers.IntegerField(min_value=1, max_value=10, required=False)
    timetable_weight = serializers.IntegerField(min_value=1, max_value=10, required=False)

    class Meta:
        model  = Subject
        fields = ['id', 'name', 'code', 'category', 'exam_weight', 'timetable_weight']

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Room
        fields = ['id', 'name', 'is_active']

class SchoolSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolSetting
        fields = ['timezone', 'school_name', 'terms', 'currency']

    def validate_currency(self, value):
        # ISO 4217 is three uppercase letters. Stored uppercase so the UI can
        # print it directly without normalising at every call site.
        code = (value or '').strip().upper()
        if not (len(code) == 3 and code.isalpha()):
            raise serializers.ValidationError(
                "Currency must be a 3-letter ISO 4217 code, e.g. RWF, KES, USD."
            )
        return code

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError,KeyError):
            raise serializers.ValidationError(f"'{value}' is not a valid timezone.")
        return value

    def validate_terms(self, value):
        """
        How this school divides its academic year: [{code, label, order}].

        Three terms was hard-coded; a semester system has two and a quarter
        system four. `code` is what lands in AcademicTerm.term, so it has to fit
        that column and be unique; `order` is what everything sorts by, so it
        has to be a number and must not repeat.
        """
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError('Expected at least one term.')

        codes, orders = set(), set()
        for entry in value:
            if not isinstance(entry, dict):
                raise serializers.ValidationError('Each term must be an object.')

            code = str(entry.get('code') or '').strip()
            if not code:
                raise serializers.ValidationError('Every term needs a code.')
            if len(code) > 20:
                raise serializers.ValidationError(
                    f"Term code '{code}' is too long (20 characters maximum)."
                )
            if code in codes:
                raise serializers.ValidationError(f"Term code '{code}' is repeated.")
            codes.add(code)

            if not str(entry.get('label') or '').strip():
                raise serializers.ValidationError(f"Term '{code}' needs a label.")

            try:
                order = int(entry.get('order'))
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    f"Term '{code}' needs a numeric order."
                )
            if order < 1:
                raise serializers.ValidationError(
                    f"Term '{code}' must have an order of 1 or more."
                )
            if order in orders:
                raise serializers.ValidationError(
                    f'Two terms share the order {order}; each position must be distinct.'
                )
            orders.add(order)

        return value