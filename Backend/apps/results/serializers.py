from rest_framework import serializers
from .models import Assessment, Result, Subject, AcademicTerm
from apps.student.models import Student


class AssessmentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer — used by parents viewing a child's assessments.
    Powers the Recent Results table: Subject, Type, Score, Grade, Date.
    """
    subject_name = serializers.ReadOnlyField(source='subject.name')
    score_display = serializers.SerializerMethodField()
    grade = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            'id', 'title', 'assessment_type', 'date',
            'score_obtained', 'max_score', 'percentage',
            'subject_name', 'score_display', 'grade', 'teacher_notes',
        ]

    def get_score_display(self, obj):
        """Returns score in '18/20' format as shown in the frontend."""
        return f"{int(obj.score_obtained)}/{int(obj.max_score)}"

    def get_grade(self, obj):
        """Compute letter grade from percentage."""
        p = float(obj.percentage)
        if p >= 90:
            return 'A'
        if p >= 80:
            return 'B'
        if p >= 70:
            return 'C'
        if p >= 60:
            return 'D'
        return 'F'


class ResultSerializer(serializers.ModelSerializer):
    """
    Powers the Summative Performance table:
    Subject | Class Test | Exam | Final | Grade
    """
    subject_name = serializers.ReadOnlyField(source='subject.name')

    class Meta:
        model = Result
        fields = [
            'id', 'subject_name',
            'class_test_marks', 'class_test_maximum',
            'exam_score', 'exam_maximum',
            'final_score', 'total_maximum', 'grade',
            'teacher_comment', 'status',
        ]
        read_only_fields = ['id']


class TeacherReviewSerializer(serializers.ModelSerializer):
    """
    Powers the Teacher Reviews panel:
    Teacher avatar/name | subject role | comment | date.
    Only results that have a non-empty teacher_comment are returned.
    """
    teacher_name = serializers.ReadOnlyField(source='teacher.get_full_name')
    teacher_avatar = serializers.ImageField(source='teacher.avatar', read_only=True)
    subject_name = serializers.ReadOnlyField(source='subject.name')
    teacher_role = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = [
            'id', 'teacher_name', 'teacher_avatar',
            'subject_name', 'teacher_role',
            'teacher_comment', 'updated_at',
        ]

    def get_teacher_role(self, obj):
        if obj.subject:
            return f"{obj.subject.name} Teacher"
        return "Teacher"


class AssessmentCreateSerializer(serializers.ModelSerializer):
    """
    Used by teachers to create and update assessment grades.
    Includes writable student/subject/term FK fields.
    Returns student_name and subject_name on read for display.
    """
    student_name = serializers.ReadOnlyField(source='student.user.get_full_name')
    subject_name = serializers.ReadOnlyField(source='subject.name')
    score_display = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            'id', 'student', 'subject', 'term',
            'title', 'assessment_type', 'date',
            'max_score', 'score_obtained', 'percentage',
            'teacher_notes', 'created_at',
            # Computed read-only fields
            'student_name', 'subject_name', 'score_display',
        ]
        read_only_fields = ['id', 'percentage', 'created_at']

    def get_score_display(self, obj):
        return f"{int(obj.score_obtained)}/{int(obj.max_score)}"


class ResultCreateUpdateSerializer(serializers.Serializer):
    """
    Used by teachers to create or update a result entry.
    """
    student         = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    subject         = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    term            = serializers.PrimaryKeyRelatedField(queryset=AcademicTerm.objects.all())
    class_test_marks = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    exam_score      = serializers.DecimalField(max_digits=5, decimal_places=2)
    teacher_comment = serializers.CharField(required=False, allow_blank=True, default='')
