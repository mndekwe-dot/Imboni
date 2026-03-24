from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Avg, Count, Sum, Q
from apps.authentication.permissions import IsDOSOrAdmin

#Academic Performance
class PerformanceOverviewView(APIView):
    """
    School-wide academic performance summary for the current term.

    Returns:
    - overall school average score
    - percentage of students passing (final_score >= 50)
    - percentage of students failing
    - total approved results count

    GET /imboni/analytics/performance/overview/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self,request):
        from apps.results.models import Result,AcademicTerm

        term_id=request.query_params.get('term_id')
        if term_id:
            term=AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term=AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response(
                {
                    'error':'No active term found'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        results = Result.objects.filter(term=term,status='approved')
        total = results.count()

        if total == 0:
            return Response({
                'term': term.name,
                'school_average':0,
                'pass_rate':0,
                'fail_rate':0,
                'total_results':0,
            })           
        avg=results.aggregate(a=AVG('final_score'))['a'] or 0
        passing=results.filter(final_score__gte=50).count()

        return self.response({
            'term': term.name,
            'school_average':round(float(avg),1),
            'pass_rate':round((passing/total) * 100,1),
            'fail_rate':round(((total-passing)/total)*100 ,1),
            'total_results':total,
        })

class PerformanceByGradeView(APIView):
    """
    Average performance per grade for the current term.
    Used for bar charts on the dashboard.

    Returns list of: { grade, average_score, student_count }

    GET /imboni/analytics/performance/by-grade/?term_id=<uuid>
    """
    permission_classes =[IsDOSOrAdmin]
    
    def get(self,request):
        from apps.results.models import Result,AcademicTerm
        from apps.student.models import Student

        term_id= request.query_params.get('term_id')
        if term_id:
            term =AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term=AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response (
                {'error':'No active term found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        grades=Student.objects.values_list('grade',flat=True).distinct().order_by('grade')
        data=[]

        for grade in grades:
            students_in_grade = Student.objects.filter(grade=grade,status='active')
            results =Result.objects.filter(
                student__in=students_in_grade,
                term=term,
                status='approved'
            )
            avg= results.aggregate(a=Avg('final_score'))['a']
            data.append({
                'grade':grade,
                'average_score':round(float(avg),1) if avg else 0,
                'student_count': students_in_grade.count(),
            })
        return Response(data)

class PerformanceBysubjectView(APIView):
    """
    Average performance per subject for the current term.
    Shows which subjects students struggle with most.

    Returns list of: { subject, average_score, pass_rate, total_students }

    GET /imboni/analytics/performance/by-subject/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self,request):
        from apps.results.models import Result,AcademicTerm,Subject

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term=AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response(
                {'error':'No active term found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        subject = subject.objects.filter(is_active=True)
        data=[]

        for subject in subjects:
            results = Result.objects.filter(subject=subject,term=term , status='approved')
            total = results.count()
            if total ==0:
                continue
            avg= results.aggregate(a=AVG('final_score'))['a'] or 0
            passing = results.filter(final_score__gte=50).count()
            data.append({
                'subject':subject.name,
                'average_score':round(float(avg), 1),
                'pass_rate':round((passing / total) * 100, 1),
                'total_students':total,
            })
        data.sort(key=lambda x:x['average_score'])
        return Response(data)

class TopStudentsView(APIView):
    """
    Top 10 students by total score for the current term.

    Returns list of: { student_name, student_id, grade, total_score, average }

    GET /imboni/analytics/performance/top-students/?term_id=<uuid>&limit=10
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self,request):
        from apps.results.models import Result ,AcademicTerm

        term_id =request.query_params.get('term_id')
        limit = int(request.query_params.get('limit', 10))

        if term_id:
            term=AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current =True).first()
        if not term:
            return Response(
                {'error':'No active term found.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        students =(
            Result.objects
            .filter(term=term , status='approved')
            .values('student__id','student__student__id',
                    'student_user__firstname',
                    'student_user_last_name',
                    'student__grade')
            .annotate(total=Sum('final_score'),avg=Avg('final_score'))
            .order_by('-total')[:limit]
        )

        data = [
            {
                'student_name': f"{s['student__user__first_name']} {s['student__user__last_name']}",
                'student_code': s['student__student_id'],
                'grade':        s['student__grade'],
                'total_score':  round(float(s['total']), 1),
                'average':      round(float(s['avg']), 1),
            }
            for s in students
        ]
        return Response(data)
    
class AtRiskStudentsView(APIView):
    """
    Students with average score below 50 in the current term.
    These students need academic support.

    Returns list of: { student_name, student_id, grade, average_score, subjects_failing }

    GET /imboni/analytics/performance/at-risk/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self,request):
        from apps.results.models import Result ,AcademicTerm

        term_id= request.query_params.get('term_id')
        if term_id:
            term =AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response(
                {'error': 'No active term found.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        at_risk = (
            Result.objects
            .filter(term=term, status='approved')
            .values('student__id', 'student__student_id',
                    'student__user__first_name', 'student__user__last_name',
                    'student__grade')
            .annotate(avg=Avg('final_score'), failing=Count('id', filter=Q(final_score__lt=50)))
            .filter(avg__lt=50)
            .order_by('avg')
        )
        data = [
            {
                'student_name':    f"{s['student__user__first_name']} {s['student__user__last_name']}",
                'student_code':    s['student__student_id'],
                'grade':           s['student__grade'],
                'average_score':   round(float(s['avg']), 1),
                'subjects_failing': s['failing'],
            }
            for s in at_risk
        ]

        return Response(data)

# ATTENDANCE
class AttendanceOverviewView(APIView):
    """
    School-wide attendance summary.

    Returns:
    - overall attendance rate
    - total present, absent, late, excused days recorded

    GET /imboni/analytics/attendance/overview/?month=3&year=2026
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.attendance.models import AttendanceSummary
        from datetime import date

        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year  = int(request.query_params.get('year',  today.year))

        summaries = AttendanceSummary.objects.filter(month=month, year=year)
        totals    = summaries.aggregate(
            total=Sum('total_days'),
            present=Sum('present_days'),
            absent=Sum('absent_days'),
            late=Sum('late_days'),
            excused=Sum('excused_days'),
        )

        total   = totals['total']   or 0
        present = totals['present'] or 0

        return Response({
            'month':           month,
            'year':            year,
            'attendance_rate': round((present / total) * 100, 1) if total else 0,
            'total_days':      total,
            'present_days':    present,
            'absent_days':     totals['absent']  or 0,
            'late_days':       totals['late']    or 0,
            'excused_days':    totals['excused'] or 0,
        })


class AttendanceByGradeView(APIView):
    """
    Attendance rate per grade for a given month.
    Shows which grades have the most absenteeism.

    GET /imboni/analytics/attendance/by-grade/?month=3&year=2026
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.attendance.models import AttendanceSummary
        from apps.student.models import Student
        from datetime import date

        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year  = int(request.query_params.get('year',  today.year))

        grades = Student.objects.values_list('grade', flat=True).distinct().order_by('grade')
        data   = []

        for grade in grades:
            students = Student.objects.filter(grade=grade, status='active')
            summaries = AttendanceSummary.objects.filter(
                student__in=students, month=month, year=year
            )
            totals = summaries.aggregate(
                total=Sum('total_days'), present=Sum('present_days')
            )
            total   = totals['total']   or 0
            present = totals['present'] or 0

            data.append({
                'grade':           grade,
                'attendance_rate': round((present / total) * 100, 1) if total else 0,
                'student_count':   students.count(),
            })

        return Response(data)


class ChronicAbsenceView(APIView):
    """
    Students with attendance rate below 80% — chronic absenteeism.
    These students are at risk of falling behind.

    GET /imboni/analytics/attendance/chronic-absence/?month=3&year=2026
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.attendance.models import AttendanceSummary
        from datetime import date

        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year  = int(request.query_params.get('year',  today.year))

        summaries = AttendanceSummary.objects.filter(
            month=month, year=year, attendance_percentage__lt=80
        ).select_related('student__user').order_by('attendance_percentage')

        data = [
            {
                'student_name':       f"{s.student.user.first_name} {s.student.user.last_name}",
                'student_code':       s.student.student_id,
                'grade':              s.student.grade,
                'attendance_rate':    float(s.attendance_percentage),
                'days_absent':        s.absent_days,
            }
            for s in summaries
        ]

        return Response(data)

# BEHAVIOR

class BehaviorOverviewView(APIView):
    """
    School-wide behavior summary for the current term.

    Returns total incidents, warnings, achievements, and positive reports.

    GET /imboni/analytics/behavior/overview/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.behavior.models import BehaviorReport
        from apps.results.models import AcademicTerm

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()

        if not term:
            return Response({'error': 'No active term found.'}, status=404)

        reports = BehaviorReport.objects.filter(
            date__gte=term.start_date, date__lte=term.end_date
        )

        return Response({
            'term':         term.name,
            'total':        reports.count(),
            'incidents':    reports.filter(report_type='incident').count(),
            'warnings':     reports.filter(report_type='warning').count(),
            'positive':     reports.filter(report_type='positive').count(),
            'achievements': reports.filter(report_type='achievement').count(),
            'critical':     reports.filter(severity='critical').count(),
            'serious':      reports.filter(severity='serious').count(),
        })


class BehaviorByTypeView(APIView):
    """
    Behavior reports grouped by type and severity.
    Used for charts.

    GET /imboni/analytics/behavior/by-type/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.behavior.models import BehaviorReport
        from apps.results.models import AcademicTerm

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()

        if not term:
            return Response({'error': 'No active term found.'}, status=404)

        reports = BehaviorReport.objects.filter(
            date__gte=term.start_date, date__lte=term.end_date
        )

        by_type = (
            reports.values('report_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        by_severity = (
            reports.values('severity')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        return Response({
            'by_type':     list(by_type),
            'by_severity': list(by_severity),
        })


class RepeatedOffendersView(APIView):
    """
    Students with 3 or more incident or warning reports in the current term.

    GET /imboni/analytics/behavior/repeated-offenders/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.behavior.models import BehaviorReport
        from apps.results.models import AcademicTerm

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()

        if not term:
            return Response({'error': 'No active term found.'}, status=404)

        offenders = (
            BehaviorReport.objects
            .filter(
                date__gte=term.start_date,
                date__lte=term.end_date,
                report_type__in=['incident', 'warning'],
            )
            .values(
                'student__id',
                'student__student_id',
                'student__user__first_name',
                'student__user__last_name',
                'student__grade',
            )
            .annotate(report_count=Count('id'))
            .filter(report_count__gte=3)
            .order_by('-report_count')
        )

        data = [
            {
                'student_name': f"{o['student__user__first_name']} {o['student__user__last_name']}",
                'student_code': o['student__student_id'],
                'grade':        o['student__grade'],
                'report_count': o['report_count'],
            }
            for o in offenders
        ]

        return Response(data)

# ENROLLMENT

class EnrollmentOverviewView(APIView):
    """
    Overall enrollment numbers.

    Returns: total, active, inactive, graduated, transferred students.

    GET /imboni/analytics/enrollment/overview/
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.student.models import Student

        students = Student.objects.all()
        return Response({
            'total':       students.count(),
            'active':      students.filter(status='active').count(),
            'inactive':    students.filter(status='inactive').count(),
            'graduated':   students.filter(status='graduated').count(),
            'transferred': students.filter(status='transferred').count(),
        })


class EnrollmentByGradeView(APIView):
    """
    Number of active students per grade.

    GET /imboni/analytics/enrollment/by-grade/
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.student.models import Student

        grades = (
            Student.objects
            .filter(status='active')
            .values('grade')
            .annotate(count=Count('id'))
            .order_by('grade')
        )

        return Response(list(grades))


# FEES

class FeesOverviewView(APIView):
    """
    School-wide fee collection summary for the current term.

    Returns: total billed, total collected, total outstanding, collection rate.

    GET /imboni/analytics/fees/overview/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.parents.models import Fee
        from apps.results.models import AcademicTerm

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()

        if not term:
            return Response({'error': 'No active term found.'}, status=404)

        fees = Fee.objects.filter(term=term)
        totals = fees.aggregate(total=Sum('amount'))
        total_billed = float(totals['total'] or 0)

        cleared = fees.filter(status='cleared').aggregate(t=Sum('amount'))['t'] or 0
        cleared = float(cleared)

        return Response({
            'term':             term.name,
            'total_billed':     total_billed,
            'total_collected':  cleared,
            'total_outstanding': total_billed - cleared,
            'collection_rate':  round((cleared / total_billed) * 100, 1) if total_billed else 0,
            'overdue_count':    fees.filter(status='overdue').count(),
        })


class OutstandingFeesView(APIView):
    """
    Students with overdue or unpaid fees.

    GET /imboni/analytics/fees/outstanding/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.parents.models import Fee
        from apps.results.models import AcademicTerm

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()

        if not term:
            return Response({'error': 'No active term found.'}, status=404)

        unpaid = (
            Fee.objects
            .filter(term=term, status__in=['due', 'overdue', 'partial'])
            .select_related('student__user')
            .order_by('student__user__last_name')
        )

        data = [
            {
                'student_name': f"{f.student.user.first_name} {f.student.user.last_name}",
                'student_code': f.student.student_id,
                'grade':        f.student.grade,
                'category':     f.category,
                'amount':       float(f.amount),
                'status':       f.status,
                'due_date':     str(f.due_date),
            }
            for f in unpaid
        ]

        return Response(data)

# TEACHERS

class TeacherOverviewView(APIView):
    """
    Teacher count summary.

    Returns: total teachers, full-time, part-time, student-teacher ratio.

    GET /imboni/analytics/teachers/overview/
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.authentication.models import User
        from apps.student.models import Student

        teachers = User.objects.filter(role='teacher', is_active=True)
        students = Student.objects.filter(status='active').count()
        total    = teachers.count()

        return Response({
            'total_teachers':       total,
            'total_students':       students,
            'student_teacher_ratio': round(students / total, 1) if total else 0,
        })


class TeacherResultsSubmissionView(APIView):
    """
    How many results each teacher has submitted vs approved vs pending.
    Shows which teachers have not submitted results yet.

    GET /imboni/analytics/teachers/results-submission/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        from apps.results.models import Result, AcademicTerm

        term_id = request.query_params.get('term_id')
        if term_id:
            term = AcademicTerm.objects.filter(pk=term_id).first()
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()

        if not term:
            return Response({'error': 'No active term found.'}, status=404)

        teachers = (
            Result.objects
            .filter(term=term)
            .values(
                'teacher__id',
                'teacher__first_name',
                'teacher__last_name',
            )
            .annotate(
                submitted=Count('id', filter=Q(status='submitted')),
                approved=Count('id',  filter=Q(status='approved')),
                draft=Count('id',     filter=Q(status='draft')),
                total=Count('id'),
            )
            .order_by('teacher__last_name')
        )

        data = [
            {
                'teacher_name': f"{t['teacher__first_name']} {t['teacher__last_name']}",
                'submitted':    t['submitted'],
                'approved':     t['approved'],
                'draft':        t['draft'],
                'total':        t['total'],
            }
            for t in teachers
            if t['teacher__id'] is not None
        ]

        return Response(data)
