from rest_framework import viewsets, generics, status, permissions
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.utils import timezone
from apps.authentication.models import User, UserPreferences
from apps.authentication.permissions import IsParent
from apps.authentication.serializers import UserSerializer
from apps.student.models import Student, Fee, StudentDocument
from .models import ParentStudentRelationship
from .serializers import (
    StudentSerializer, ParentStudentRelationshipSerializer,
    AddParentToStudentSerializer, MyChildrenSerializer,
    FeeSerializer, StudentDocumentSerializer, LinkStudentSerializer,
)


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer


def _verify_parent_owns_student(request, student_pk):
    """
    Every view below takes a student pk straight from the URL/query param —
    without this check, any logged-in parent could view any other family's
    child by guessing/incrementing a UUID. Returns the Student if the
    requesting parent actually has a ParentStudentRelationship to it, else None.
    """
    if not ParentStudentRelationship.objects.filter(parent=request.user, student_id=student_pk).exists():
        return None
    return get_object_or_404(Student, pk=student_pk)


class MyChildrenView(generics.ListAPIView):
    """
    GET /imboni/parents/my-children/
    Returns the list of students linked to the logged-in parent (used for child tabs).
    """
    serializer_class = MyChildrenSerializer
    permission_classes = [IsParent]
    pagination_class = None

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
        student = _verify_parent_owns_student(request, self.kwargs['pk'])
        if student is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # --- Overall Performance ---
        from apps.results.models import Result, AcademicTerm
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
        from apps.attendance.models import AttendanceSummary
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
        from apps.announcements.models import Announcement, AnnouncementRead
        published = Announcement.objects.filter(status='published')
        read_ids = AnnouncementRead.objects.filter(
            user=request.user
        ).values_list('announcement_id', flat=True)
        unread = published.exclude(id__in=read_ids)
        unread_count = unread.count()
        urgent_count = unread.filter(category='urgent').count()

        # --- Behaviour Reports ---
        from apps.behavior.models import BehaviorReport
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

    def retrieve(self, request, *_args, **_kwargs):
        from apps.results.models import AcademicTerm
        from apps.attendance.models import AttendanceRecord
        from apps.teacher.models import ClassAssignment, SubjectTeacherAssignment

        student = _verify_parent_owns_student(request, self.kwargs['pk'])
        if student is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
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
        if _verify_parent_owns_student(self.request, self.kwargs['pk']) is None:
            raise Http404
        return Fee.objects.filter(student_id=self.kwargs['pk'])


class StudentDocumentListView(generics.ListAPIView):
    """
    GET /imboni/students/<pk>/documents/
    Returns all documents attached to a student (PDFs, consent forms, etc.)
    """
    serializer_class = StudentDocumentSerializer
    permission_classes = [IsParent]

    def get_queryset(self):
        if _verify_parent_owns_student(self.request, self.kwargs['pk']) is None:
            raise Http404
        return StudentDocument.objects.filter(student_id=self.kwargs['pk'])


class StudentTodayScheduleView(generics.ListAPIView):
    """
    GET /imboni/students/<pk>/schedule/today/
    Returns today's timetable periods for a student's class, ordered by start time.
    """
    permission_classes = [IsParent]

    def get_serializer_class(self):
        from apps.teacher.serializers import TimetableSerializer
        return TimetableSerializer

    def get_queryset(self):
        from apps.teacher.models import ClassAssignment, Timetable
        from apps.results.models import AcademicTerm

        if _verify_parent_owns_student(self.request, self.kwargs['pk']) is None:
            raise Http404

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



# ---------------------------------------------------------------------------
# Parent Dashboard Stats
# ---------------------------------------------------------------------------

from rest_framework.views import APIView as _APIView


class ParentDashboardStatsView(_APIView):
    """GET /imboni/parents/dashboard/stats/?student_id=<uuid>"""
    permission_classes = [IsParent]

    def get(self, request):
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'detail': 'student_id query param required.'}, status=400)

        student = _verify_parent_owns_student(request, student_id)
        if student is None:
            return Response({'detail': 'Student not found.'}, status=404)

        from apps.results.models import Result, AcademicTerm
        from apps.attendance.models import AttendanceRecord
        from django.db.models import Avg

        term = AcademicTerm.objects.filter(is_current=True).first()

        # Average performance this term
        avg_perf = Result.objects.filter(
            student=student, term=term, status='approved'
        ).aggregate(a=Avg('final_score'))['a'] if term else None

        # Attendance rate this term — AttendanceRecord has no `term` FK, so scope by date range instead
        if term:
            att_qs = AttendanceRecord.objects.filter(student=student, date__gte=term.start_date, date__lte=term.end_date)
        else:
            att_qs = AttendanceRecord.objects.none()
        att_total = att_qs.count()
        att_pres  = att_qs.filter(status='present').count()
        att_rate  = round(att_pres / att_total * 100, 1) if att_total else None

        # Pending fee balance — Fee lives in apps.student.models (already imported at top
        # of this file). Fee has no `is_paid` field; 'cleared' is the paid status.
        fee_qs      = Fee.objects.filter(student=student).exclude(status='cleared')
        fee_balance = sum(f.amount for f in fee_qs)

        # Unread announcements — related_name on AnnouncementRead is 'read_receipts', not 'reads'
        from apps.announcements.models import Announcement
        unread = Announcement.objects.filter(status='published').exclude(
            read_receipts__user=request.user
        ).count()

        return Response({
            'student_id':        str(student.id),
            'full_name':         '%s %s' % (student.user.first_name, student.user.last_name),
            'grade':             student.grade,
            'section':           student.section,
            'avg_performance':   round(avg_perf, 1) if avg_perf is not None else None,
            'attendance_rate':   att_rate,
            'fee_balance':       float(fee_balance),
            'unread_announcements': unread,
        })


# ── Consent Requests ───────────────────────────────────────────────────────────

def _consent_dict(req, response_map=None, children=None):
    """Serialize a request; when children given, include per-child status."""
    d = {
        'id':                str(req.id),
        'title':             req.title,
        'description':       req.description,
        'event_date':        str(req.event_date),
        'response_deadline': str(req.response_deadline) if req.response_deadline else None,
        'grade':             req.grade,
        'created_by':        req.created_by.get_full_name() if req.created_by else '',
        'created_at':        req.created_at.isoformat(),
    }
    if children is not None:
        d['children'] = [
            {
                'student_id':   str(c.id),
                'student_name': c.full_name,
                'grade':        c.grade,
                'status':       (response_map or {}).get((req.id, c.id)),
            }
            for c in children
            if not req.grade or c.grade == req.grade
        ]
    return d


class StaffConsentRequestListView(generics.GenericAPIView):
    """
    Staff side (discipline/dos/admin):
    GET  /imboni/consent-requests/  — active requests with response tallies
    POST /imboni/consent-requests/  — create + notify targeted parents
    """
    def get_permissions(self):
        from apps.authentication.permissions import IsDOSOrAdminOrDiscipline
        return [IsDOSOrAdminOrDiscipline()]

    def get(self, request):
        from django.db.models import Count, Q as DQ
        from .models import ConsentRequest
        qs = (
            ConsentRequest.objects.filter(is_active=True)
            .annotate(
                approved=Count('responses', filter=DQ(responses__status='approved')),
                declined=Count('responses', filter=DQ(responses__status='declined')),
            )
        )
        data = []
        for r in qs:
            d = _consent_dict(r)
            d['approved'] = r.approved
            d['declined'] = r.declined
            data.append(d)
        return Response(data)

    def post(self, request):
        from .models import ConsentRequest
        from .tasks import notify_consent_parents_task
        from apps.notifications.tasks import safe_delay

        for field in ('title', 'description', 'event_date'):
            if not request.data.get(field):
                return Response({'error': f'{field} is required.'}, status=400)

        req = ConsentRequest.objects.create(
            title=request.data['title'],
            description=request.data['description'],
            event_date=request.data['event_date'],
            response_deadline=request.data.get('response_deadline') or None,
            grade=request.data.get('grade', '').strip(),
            created_by=request.user,
        )

        # Fan-out to parents happens in a Celery task so a whole-school
        # request doesn't block this response (falls back to inline when no
        # broker is running). The count is precomputed for the response.
        rels = ParentStudentRelationship.objects.all()
        if req.grade:
            rels = rels.filter(student__grade=req.grade)
        parent_count = rels.values('parent_id').distinct().count()

        safe_delay(notify_consent_parents_task, str(req.id))

        d = _consent_dict(req)
        d['parents_notified'] = parent_count
        return Response(d, status=201)


class ParentConsentRequestListView(generics.GenericAPIView):
    """
    Parent side:
    GET /imboni/parents/consent-requests/ — active requests targeting the
    parent's children, with each child's current response status.
    """
    permission_classes = [IsParent]

    def get(self, request):
        from .models import ConsentRequest, ConsentResponse

        children = [
            rel.student for rel in
            ParentStudentRelationship.objects.filter(parent=request.user).select_related('student__user')
        ]
        if not children:
            return Response([])

        grades = {c.grade for c in children}
        from django.db.models import Q as DQ
        qs = ConsentRequest.objects.filter(is_active=True).filter(
            DQ(grade='') | DQ(grade__in=grades)
        )

        response_map = {
            (resp.request_id, resp.student_id): resp.status
            for resp in ConsentResponse.objects.filter(parent=request.user)
        }
        return Response([_consent_dict(r, response_map, children) for r in qs])


class ParentConsentRespondView(generics.GenericAPIView):
    """
    POST /imboni/parents/consent-requests/<pk>/respond/
    Body: { student_id, status: 'approved'|'declined', note? }
    """
    permission_classes = [IsParent]

    def post(self, request, pk):
        from .models import ConsentRequest, ConsentResponse

        try:
            req = ConsentRequest.objects.get(pk=pk, is_active=True)
        except ConsentRequest.DoesNotExist:
            return Response({'error': 'Request not found.'}, status=404)

        status_val = request.data.get('status')
        if status_val not in ('approved', 'declined'):
            return Response({'error': "status must be 'approved' or 'declined'."}, status=400)

        rel = ParentStudentRelationship.objects.filter(
            parent=request.user, student_id=request.data.get('student_id')
        ).select_related('student').first()
        if not rel:
            return Response({'error': 'That student is not linked to your account.'}, status=403)

        if req.grade and rel.student.grade != req.grade:
            return Response({'error': 'This request does not apply to that student.'}, status=400)

        resp, _created = ConsentResponse.objects.update_or_create(
            request=req, student=rel.student,
            defaults={'parent': request.user, 'status': status_val,
                      'note': request.data.get('note', '')},
        )
        return Response({
            'request_id': str(req.id),
            'student_id': str(rel.student.id),
            'status':     resp.status,
        })
