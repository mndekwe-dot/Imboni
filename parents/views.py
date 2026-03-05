from rest_framework import viewsets, generics, status, permissions
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from django.utils import timezone
from authentication.models import User, UserPreferences
from authentication.permissions import IsParent
from authentication.serializers import UserSerializer
from .models import Student, ParentStudentRelationship, Fee, StudentDocument
from .serializers import (
    StudentSerializer, ParentStudentRelationshipSerializer,
    AddParentToStudentSerializer, MyChildrenSerializer,
    FeeSerializer, StudentDocumentSerializer, LinkStudentSerializer,
)


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer


class MyChildrenView(generics.ListAPIView):
    """
    GET /imboni/parents/my-children/
    Returns the list of students linked to the logged-in parent (used for child tabs).
    """
    serializer_class = MyChildrenSerializer
    permission_classes = [IsParent]

    def get_queryset(self):
        return (
            ParentStudentRelationship.objects
            .filter(parent=self.request.user)
            .select_related('student__user')
        )


class StudentDashboardView(generics.RetrieveAPIView):
    """
    GET /imboni/students/<pk>/dashboard/
    Returns the 4 summary cards shown on the parent dashboard:
      - Overall Performance
      - Attendance Rate
      - Unread Announcements
      - Behaviour Reports
    """
    permission_classes = [IsParent]

    def retrieve(self, request, *_args, **_kwargs):
        student = get_object_or_404(Student, pk=self.kwargs['pk'])

        # --- Overall Performance ---
        from results.models import Result, AcademicTerm
        current_term = AcademicTerm.objects.filter(is_current=True).first()
        if current_term:
            avg = (
                Result.objects
                .filter(student=student, term=current_term)
                .aggregate(avg=Avg('final_score'))['avg']
            )
            performance_pct = round(float(avg or 0), 1)
        else:
            performance_pct = round(float(student.current_gpa or 0), 1)

        # --- Attendance ---
        from attendance.models import AttendanceSummary
        now = timezone.now()
        try:
            summary = AttendanceSummary.objects.get(
                student=student, month=now.month, year=now.year
            )
            attendance_pct = round(float(summary.attendance_percentage), 1)
            present_days = summary.present_days
            absent_days = summary.absent_days
        except AttendanceSummary.DoesNotExist:
            attendance_pct = round(float(student.attendance_percentage), 1)
            present_days = 0
            absent_days = 0

        # --- Unread Announcements ---
        from announcements.models import Announcement, AnnouncementRead
        published = Announcement.objects.filter(status='published')
        read_ids = AnnouncementRead.objects.filter(
            user=request.user
        ).values_list('announcement_id', flat=True)
        unread = published.exclude(id__in=read_ids)
        unread_count = unread.count()
        urgent_count = unread.filter(category='urgent').count()

        # --- Behaviour Reports ---
        from behavior.models import BehaviorReport
        positive_count = BehaviorReport.objects.filter(
            student=student, report_type='positive'
        ).count()

        return Response({
            'student_id': student.id,
            'overall_performance': {
                'percentage': performance_pct,
            },
            'attendance': {
                'percentage': attendance_pct,
                'present_days': present_days,
                'absent_days': absent_days,
            },
            'announcements': {
                'unread_count': unread_count,
                'urgent_count': urgent_count,
            },
            'behaviour': {
                'positive_count': positive_count,
            },
        })


class StudentCardView(generics.RetrieveAPIView):
    """
    GET /imboni/students/<pk>/card/
    Returns all data needed for the My Children card:
      - student header (name, grade, student_id)
      - is_in_school  (today's attendance)
      - academic_focus (subjects this term)
      - class_teacher  (for the Message button)
    """
    permission_classes = [IsParent]

    def retrieve(self, _request, *_args, **_kwargs):
        from results.models import AcademicTerm
        from attendance.models import AttendanceRecord
        from teacher.models import ClassAssignment, SubjectTeacherAssignment

        student = get_object_or_404(Student, pk=self.kwargs['pk'])
        today = timezone.now().date()
        current_term = AcademicTerm.objects.filter(is_current=True).first()

        # --- In School status ---
        is_in_school = AttendanceRecord.objects.filter(
            student=student,
            date=today,
            status__in=['present', 'late']
        ).exists()

        # --- Academic Focus & Class Teacher ---
        academic_focus = []
        class_teacher = None
        if current_term:
            assignment = (
                ClassAssignment.objects
                .filter(student=student, term=current_term)
                .select_related('class_obj__class_teacher')
                .first()
            )
            if assignment:
                class_obj = assignment.class_obj
                # Subjects taught in this class this term
                academic_focus = list(
                    SubjectTeacherAssignment.objects
                    .filter(class_obj=class_obj, term=current_term)
                    .select_related('subject')
                    .values_list('subject__name', flat=True)
                    .distinct()
                )
                # Class teacher for the Message button
                if class_obj.class_teacher:
                    t = class_obj.class_teacher
                    class_teacher = {
                        'id': str(t.id),
                        'name': t.get_full_name(),
                        'email': t.email,
                    }

        return Response({
            'id': str(student.id),
            'name': student.user.get_full_name(),
            'initials': ''.join(p[0].upper() for p in student.user.get_full_name().split()[:2]),
            'grade': student.grade,
            'section': student.section,
            'student_code': student.student_id,
            'status': student.status,
            'is_in_school': is_in_school,
            'academic_focus': academic_focus,
            'class_teacher': class_teacher,
        })


class AddParentToStudentView(generics.CreateAPIView):
    """
    POST /imboni/students/<student_pk>/add_parent/
    Creates a parent user and links them to the student in one atomic operation.
    """
    serializer_class = AddParentToStudentSerializer

    def create(self, request, *_args, **_kwargs):
        try:
            student = Student.objects.get(pk=self.kwargs['student_pk'])
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            user = User.objects.create_user(
                username=data['username'],
                email=data['email'],
                password=data['password'],
                first_name=data['first_name'],
                last_name=data['last_name'],
                phone_number=data.get('phone_number', ''),
                date_of_birth=data.get('date_of_birth'),
                address=data.get('address', ''),
                emergency_contact=data.get('emergency_contact', ''),
                role='parent',
            )
            UserPreferences.objects.get_or_create(user=user)
            relationship = ParentStudentRelationship.objects.create(
                parent=user,
                student=student,
                relationship_type=data['relationship_type'],
                is_primary_contact=data['is_primary_contact'],
                can_pickup=data['can_pickup'],
            )

        return Response({
            'parent': UserSerializer(user).data,
            'relationship': ParentStudentRelationshipSerializer(relationship).data,
            'message': 'Parent created and linked to student successfully'
        }, status=status.HTTP_201_CREATED)


class StudentFeeListView(generics.ListAPIView):
    """
    GET /imboni/students/<pk>/fees/
    Returns all fee records for a student (Tuition, Transport, Lunch, etc.)
    """
    serializer_class = FeeSerializer
    permission_classes = [IsParent]

    def get_queryset(self):
        return Fee.objects.filter(student_id=self.kwargs['pk'])


class StudentDocumentListView(generics.ListAPIView):
    """
    GET /imboni/students/<pk>/documents/
    Returns all documents attached to a student (PDFs, consent forms, etc.)
    """
    serializer_class = StudentDocumentSerializer
    permission_classes = [IsParent]

    def get_queryset(self):
        return StudentDocument.objects.filter(student_id=self.kwargs['pk'])


class StudentTodayScheduleView(generics.ListAPIView):
    """
    GET /imboni/students/<pk>/schedule/today/
    Returns today's timetable periods for a student's class, ordered by start time.
    """
    permission_classes = [IsParent]

    def get_serializer_class(self):
        from teacher.serializers import TimetableSerializer
        return TimetableSerializer

    def get_queryset(self):
        from teacher.models import ClassAssignment, Timetable
        from results.models import AcademicTerm

        today = timezone.now().date()
        day_name = today.strftime('%A').lower()  # e.g. 'monday'
        current_term = AcademicTerm.objects.filter(is_current=True).first()

        if not current_term:
            return Timetable.objects.none()

        assignment = ClassAssignment.objects.filter(
            student_id=self.kwargs['pk'], term=current_term
        ).first()

        if not assignment:
            return Timetable.objects.none()

        return (
            Timetable.objects
            .filter(class_obj=assignment.class_obj, term=current_term, day=day_name)
            .select_related('subject', 'teacher')
            .order_by('start_time')
        )


class ParentStudentRelationshipViewSet(viewsets.ModelViewSet):
    serializer_class = ParentStudentRelationshipSerializer

    def get_queryset(self):
        student_id = self.kwargs.get('student_pk')
        return ParentStudentRelationship.objects.filter(student__id=student_id)


class LinkStudentView(generics.CreateAPIView):
    """
    "Link New Student" button on the Family Connections section.
    The logged-in parent provides a student code and relationship type.

    POST /imboni/account/family/link/
    Body: { "student_code": "STD2024001", "relationship_type": "mother" }
    """
    serializer_class = LinkStudentSerializer
    permission_classes = [IsParent]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)

        student = serializer.context['student']
        parent = request.user if request.user.is_authenticated else (
            User.objects.filter(role='parent').first()
        )

        # Prevent duplicate links
        if ParentStudentRelationship.objects.filter(parent=parent, student=student).exists():
            return Response(
                {'detail': 'You are already linked to this student.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rel = ParentStudentRelationship.objects.create(
            parent=parent,
            student=student,
            relationship_type=serializer.validated_data['relationship_type'],
            is_primary_contact=serializer.validated_data['is_primary_contact'],
            can_pickup=serializer.validated_data['can_pickup'],
        )

        from .serializers import MyChildrenSerializer
        return Response(
            MyChildrenSerializer(rel).data,
            status=status.HTTP_201_CREATED,
        )

