from django.http import HttpResponse
from django.template.loader import render_to_string
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as http_status

from authentication.permissions import IsDOSOrAdminOrDiscipline,IsDOSOrAdmin
from parents.models import Student
from results.models import Result, AcademicTerm
from behavior.models import ConductGrade

SCHOOL_NAME  = getattr(settings, 'SCHOOL_NAME',  'Imboni School')
SCHOOL_EMAIL = getattr(settings, 'SCHOOL_EMAIL', '')
SCHOOL_PHONE = getattr(settings, 'SCHOOL_PHONE', '')

def _get_rank(student, term):
    """
    Calculate this student's rank within their class for the given term.
    Returns a tuple: (rank, class_size)
    """
    from django.db.models import Sum
    from teacher.models import ClassAssignment

    class_assignment = ClassAssignment.objects.filter(
        student=student, term=term
    ).first()

    if not class_assignment:
        return None, None

    classmates = ClassAssignment.objects.filter(
        class_obj=class_assignment.class_obj, term=term
    ).values_list('student_id', flat=True)

    scores = []
    for sid in classmates:
        total = Result.objects.filter(
            student_id=sid, term=term, status='approved'
        ).aggregate(t=Sum('final_score'))['t'] or 0
        scores.append((sid, float(total)))

    scores.sort(key=lambda x: x[1], reverse=True)
    class_size = len(scores)

    student_total = Result.objects.filter(
        student=student, term=term, status='approved'
    ).aggregate(t=Sum('final_score'))['t'] or 0

    rank = None
    for i, (sid, score) in enumerate(scores, start=1):
        if str(sid) == str(student.id):
            rank = i
            break

    return rank, class_size


class StudentReportCardView(APIView):
    """
    Generate a single student's PDF report card for a given term.

    GET /imboni/dos/reports/student/<uuid:pk>/?term_id=<uuid>

    Returns a PDF file download.
    If no term_id is provided, uses the current active term.
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request, pk):
        # ── Get student ──────────────────────────────────────────────────
        try:
            student = Student.objects.select_related('user').get(pk=pk)
        except Student.DoesNotExist:
            return Response(
                {'error': 'Student not found.'},
                status=http_status.HTTP_404_NOT_FOUND
            )

        # ── Get term ─────────────────────────────────────────────────────
        term_id = request.query_params.get('term_id')
        if term_id:
            try:
                term = AcademicTerm.objects.get(pk=term_id)
            except AcademicTerm.DoesNotExist:
                return Response(
                    {'error': 'Term not found.'},
                    status=http_status.HTTP_404_NOT_FOUND
                )
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()
            if not term:
                return Response(
                    {'error': 'No active term found.'},
                    status=http_status.HTTP_400_BAD_REQUEST
                )

        # ── Get approved results for this student + term ─────────────────
        results = Result.objects.filter(
            student=student,
            term=term,
            status='approved',
        ).select_related('subject').order_by('subject__name')

        if not results.exists():
            return Response(
                {'error': 'No approved results found for this student in this term.'},
                status=http_status.HTTP_404_NOT_FOUND
            )

        # ── Split into core and elective ─────────────────────────────────
        # All subjects go to core_subjects by default.
        # If you later add subject_type field, filter here.
        core_subjects     = []
        elective_subjects = []

        for r in results:
            row = {
                'subject':            r.subject.name,
                'class_test_marks':   float(r.class_test_marks) if r.class_test_marks else 0,
                'class_test_maximum': float(r.class_test_maximum),
                'exam_score':         float(r.exam_score),
                'exam_maximum':       float(r.exam_maximum),
                'final_score':        float(r.final_score),
                'total_maximum':      float(r.total_maximum),
            }
            core_subjects.append(row)

        # ── Calculate totals ─────────────────────────────────────────────
        all_subjects = core_subjects + elective_subjects

        total_class_test_marks   = sum(r['class_test_marks']   for r in all_subjects)
        total_class_test_maximum = sum(r['class_test_maximum'] for r in all_subjects)
        total_exam_marks         = sum(r['exam_score']         for r in all_subjects)
        total_exam_maximum       = sum(r['exam_maximum']       for r in all_subjects)
        grand_total              = sum(r['final_score']        for r in all_subjects)
        grand_maximum            = sum(r['total_maximum']      for r in all_subjects)

        percentage = round((grand_total / grand_maximum) * 100, 2) if grand_maximum else 0

        # ── Get conduct grade ─────────────────────────────────────────────
        conduct = ConductGrade.objects.filter(student=student, term=term).first()
        conduct_labels = {
            'A': 'Excellent', 'B': 'Good',
            'C': 'Satisfactory', 'D': 'Needs Improvement', 'F': 'Unsatisfactory'
        }
        conduct_grade = conduct_labels.get(conduct.grade, 'N/A') if conduct else 'N/A'

        # ── Get rank ─────────────────────────────────────────────────────
        rank, class_size = _get_rank(student, term)

        # ── Get class name ────────────────────────────────────────────────
        from teacher.models import ClassAssignment
        class_assignment = ClassAssignment.objects.filter(
            student=student, term=term
        ).select_related('class_obj').first()
        student_class = class_assignment.class_obj.name if class_assignment else student.grade

        # ── Build term label (Term 1, Term 2, etc.) ───────────────────────
        term_map = {'term1': 'Term 1', 'term2': 'Term 2', 'term3': 'Term 3'}
        term_label = term_map.get(term.term, term.name)

        # ── Render HTML template ─────────────────────────────────────────
        context = {
            'school_name':  SCHOOL_NAME,
            'school_email': SCHOOL_EMAIL,
            'school_phone': SCHOOL_PHONE,
            'stamp_url':    None,

            'term_label':   term_label,
            'school_year':  f"{term.year}-{term.year + 1}",
            'section':      student_class,
            'student_class': student_class,
            'student_id':   student.student_id,
            'student_name': f"{student.user.last_name.upper()} {student.user.first_name}",

            'conduct_grade': conduct_grade,

            'core_subjects':     core_subjects,
            'elective_subjects': elective_subjects,

            'total_class_test_marks':   total_class_test_marks,
            'total_class_test_maximum': total_class_test_maximum,
            'total_exam_marks':         total_exam_marks,
            'total_exam_maximum':       total_exam_maximum,
            'grand_total':              grand_total,
            'grand_maximum':            grand_maximum,
            'percentage':               percentage,
            'rank':                     rank or 'N/A',
            'class_size':               class_size or 'N/A',
        }

        html_string = render_to_string('reports/report_card.html', context)

        # ── Convert to PDF ───────────────────────────────────────────────
        import io
        from xhtml2pdf import pisa
        pdf_buffer = io.BytesIO()
        pisa.CreatePDF(io.StringIO(html_string), dest=pdf_buffer)
        pdf_file = pdf_buffer.getvalue()

        # ── Return as downloadable file ──────────────────────────────────
        filename = f"report_{student.student_id}_{term.term}_{term.year}.pdf"
        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ClassReportCardsView(APIView):
    """
    Generate PDF report cards for ALL students in a class.
    Returns a ZIP file containing one PDF per student.

    GET /imboni/dos/reports/class/<uuid:class_id>/?term_id=<uuid>
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request, class_id):
        import zipfile
        import io
        from teacher.models import Class, ClassAssignment

        term_id = request.query_params.get('term_id')
        if term_id:
            try:
                term = AcademicTerm.objects.get(pk=term_id)
            except AcademicTerm.DoesNotExist:
                return Response({'error': 'Term not found.'}, status=404)
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()
            if not term:
                return Response({'error': 'No active term.'}, status=400)

        try:
            class_obj = Class.objects.get(pk=class_id)
        except Class.DoesNotExist:
            return Response({'error': 'Class not found.'}, status=404)

        assignments = ClassAssignment.objects.filter(
            class_obj=class_obj, term=term
        ).select_related('student__user')

        if not assignments.exists():
            return Response({'error': 'No students found in this class.'}, status=404)

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for assignment in assignments:
                student = assignment.student

                results = Result.objects.filter(
                    student=student, term=term, status='approved'
                ).select_related('subject').order_by('subject__name')

                if not results.exists():
                    continue

                core_subjects = []
                for r in results:
                    core_subjects.append({
                        'subject':            r.subject.name,
                        'class_test_marks':   float(r.class_test_marks) if r.class_test_marks else 0,
                        'class_test_maximum': float(r.class_test_maximum),
                        'exam_score':         float(r.exam_score),
                        'exam_maximum':       float(r.exam_maximum),
                        'final_score':        float(r.final_score),
                        'total_maximum':      float(r.total_maximum),
                    })

                grand_total   = sum(r['final_score']    for r in core_subjects)
                grand_maximum = sum(r['total_maximum']  for r in core_subjects)
                percentage    = round((grand_total / grand_maximum) * 100, 2) if grand_maximum else 0

                conduct = ConductGrade.objects.filter(student=student, term=term).first()
                conduct_labels = {
                    'A': 'Excellent', 'B': 'Good',
                    'C': 'Satisfactory', 'D': 'Needs Improvement', 'F': 'Unsatisfactory'
                }
                conduct_grade = conduct_labels.get(conduct.grade, 'N/A') if conduct else 'N/A'

                rank, class_size = _get_rank(student, term)
                term_map   = {'term1': 'Term 1', 'term2': 'Term 2', 'term3': 'Term 3'}
                term_label = term_map.get(term.term, term.name)

                context = {
                    'school_name':  SCHOOL_NAME,
                    'school_email': SCHOOL_EMAIL,
                    'school_phone': SCHOOL_PHONE,
                    'stamp_url':    None,
                    'term_label':   term_label,
                    'school_year':  f"{term.year}-{term.year + 1}",
                    'section':      class_obj.name,
                    'student_class': class_obj.name,
                    'student_id':   student.student_id,
                    'student_name': f"{student.user.last_name.upper()} {student.user.first_name}",
                    'conduct_grade': conduct_grade,
                    'core_subjects':     core_subjects,
                    'elective_subjects': [],
                    'total_class_test_marks':   sum(r['class_test_marks']   for r in core_subjects),
                    'total_class_test_maximum': sum(r['class_test_maximum'] for r in core_subjects),
                    'total_exam_marks':         sum(r['exam_score']         for r in core_subjects),
                    'total_exam_maximum':       sum(r['exam_maximum']       for r in core_subjects),
                    'grand_total':   grand_total,
                    'grand_maximum': grand_maximum,
                    'percentage':    percentage,
                    'rank':          rank or 'N/A',
                    'class_size':    class_size or 'N/A',
                }

                html_string = render_to_string('reports/report_card.html', context)
                import io as _io
                from xhtml2pdf import pisa as _pisa
                _buf = _io.BytesIO()
                _pisa.CreatePDF(_io.StringIO(html_string), dest=_buf)
                pdf_bytes = _buf.getvalue()
                filename    = f"{student.student_id}_{student.user.last_name}.pdf"
                zip_file.writestr(filename, pdf_bytes)

        zip_buffer.seek(0)
        zip_name = f"reports_{class_obj.name}_{term.term}_{term.year}.zip"
        response = HttpResponse(zip_buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_name}"'
        return response


class ExportResultsCSVView(APIView):
    """
    Export all approved results for a term as a CSV file.

    GET /imboni/dos/reports/export/results/?term_id=<uuid>

    CSV columns:
    student_id, student_name, grade, class, subject, class_test_marks,
    class_test_maximum, exam_score, exam_maximum, final_score,
    total_maximum, percentage, conduct_grade
    """
    permission_classes = [IsDOSOrAdminOrDiscipline]

    def get(self, request):
        import csv
        import io

        term_id = request.query_params.get('term_id')
        if term_id:
            try:
                term = AcademicTerm.objects.get(pk=term_id)
            except AcademicTerm.DoesNotExist:
                return Response({'error': 'Term not found.'}, status=404)
        else:
            term = AcademicTerm.objects.filter(is_current=True).first()
            if not term:
                return Response({'error': 'No active term.'}, status=400)

        results = Result.objects.filter(
            term=term, status='approved'
        ).select_related('student__user', 'subject').order_by(
            'student__user__last_name', 'subject__name'
        )

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'Student ID', 'Last Name', 'First Name', 'Grade',
            'Subject', 'Class Test Marks', 'Class Test Maximum',
            'Exam Score', 'Exam Maximum', 'Final Score', 'Total Maximum',
            'Percentage',
        ])

        for r in results:
            percentage = round(
                (float(r.final_score) / float(r.total_maximum)) * 100, 2
            ) if r.total_maximum else 0

            writer.writerow([
                r.student.student_id,
                r.student.user.last_name,
                r.student.user.first_name,
                r.student.grade,
                r.subject.name,
                float(r.class_test_marks) if r.class_test_marks else 0,
                float(r.class_test_maximum),
                float(r.exam_score),
                float(r.exam_maximum),
                float(r.final_score),
                float(r.total_maximum),
                percentage,
            ])

        output.seek(0)
        filename = f"results_{term.term}_{term.year}.csv"
        response = HttpResponse(output.read(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
