from rest_framework import serializers


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
    grade       = serializers.CharField()   # e.g. "Grade 1"
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
    grade_label     = serializers.CharField()   # e.g. "Grade 6"
    section         = serializers.CharField()
    avg_performance = serializers.FloatField(allow_null=True)
    attendance_rate = serializers.FloatField(allow_null=True)
    status          = serializers.CharField()
    enrollment_date = serializers.DateField()


class AddStudentSerializer(serializers.Serializer):
    """Payload for POST /imboni/dos/students/ (Add Student button)."""
    first_name      = serializers.CharField()
    last_name       = serializers.CharField()
    email           = serializers.EmailField()
    grade           = serializers.ChoiceField(choices=['1', '2', '3', '4', '5', '6'])
    section         = serializers.ChoiceField(choices=['A', 'B', 'C'])
    enrollment_date = serializers.DateField()
    password        = serializers.CharField(write_only=True, min_length=8)


class EnrollmentByGradeSerializer(serializers.Serializer):
    """One progress bar row in the Student Enrollment by Grade section."""
    grade         = serializers.CharField()    # e.g. "Grade 6"
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

class BulkAddStudentRowSerializer(serializers.Serializer):
    """One student row in the bulk-create payload."""
    first_name      = serializers.CharField()
    last_name       = serializers.CharField()
    email           = serializers.EmailField()
    grade           = serializers.ChoiceField(choices=['1', '2', '3', '4', '5', '6'])
    section         = serializers.ChoiceField(choices=['A', 'B', 'C'])
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
