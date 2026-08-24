"""
The DOS side of exam papers: vet them, and print the ones that pass.

A teacher writes a paper and hands it up; nothing is duplicated until the DOS
has read it. That vetting step is the whole point of the feature, so the
endpoints here are deliberately narrow — see every paper, approve one, send one
back with a reason, and print.

Printing reuses the report-card pipeline (`render_to_string` -> xhtml2pdf),
because a paper that prints differently on the DOS's machine than on the
bursar's is worse than no print button. Two documents come out of the same
data: the question paper a candidate sits, and the marking scheme, which is the
same paper with the answers left in.
"""

import io

from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import audit
from apps.authentication.permissions import IsDOSOrAdmin
from apps.notifications.models import Notification
from apps.teacher.models import ExamPaper
from apps.teacher.serializers import ExamPaperSerializer


def _paper_or_none(pk):
    return (ExamPaper.objects
            .select_related('subject', 'class_obj', 'term', 'teacher', 'approved_by')
            .filter(pk=pk)
            .first())


def _tell_the_author(paper, title, message):
    Notification.objects.create(
        user=paper.teacher, title=title, message=message,
        type='exam', path='/teacher/exams',
    )


class DosExamPaperListView(APIView):
    """
    Every exam paper in the school.

    GET /imboni/dos/exam-papers/?status=&subject=&class_obj=&term=&exam_type=

    Unfiltered this is the DOS's working list, so submitted papers sort first:
    the ones waiting on them are the reason they opened the screen.
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        papers = (ExamPaper.objects
                  .select_related('subject', 'class_obj', 'term', 'teacher', 'approved_by'))

        for field in ('status', 'subject', 'class_obj', 'term', 'exam_type'):
            value = request.query_params.get(field, '').strip()
            if value:
                papers = papers.filter(**{field: value})

        search = request.query_params.get('q', '').strip()
        if search:
            papers = papers.filter(title__icontains=search)

        # Waiting first, then newest. Papers already dealt with stay reachable
        # but stop competing for attention.
        papers = sorted(
            papers,
            key=lambda p: (p.status != 'submitted', -(p.created_at.timestamp())),
        )

        data = ExamPaperSerializer(papers, many=True).data
        counts = {s: 0 for s, _ in ExamPaper.STATUS_CHOICES}
        for paper in papers:
            counts[paper.status] = counts.get(paper.status, 0) + 1
        return Response({'results': data, 'counts': counts})


class DosExamPaperDetailView(APIView):
    """GET /imboni/dos/exam-papers/<pk>/ — the paper as the DOS reads it."""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request, pk):
        paper = _paper_or_none(pk)
        if paper is None:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        return Response(ExamPaperSerializer(paper).data)


class DosExamPaperApproveView(APIView):
    """POST /imboni/dos/exam-papers/<pk>/approve/"""
    permission_classes = [IsDOSOrAdmin]

    def post(self, request, pk):
        paper = _paper_or_none(pk)
        if paper is None:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        if paper.status != 'submitted':
            # Approving a draft would approve something the author has not
            # finished, and re-approving is a no-op worth naming.
            return Response(
                {'detail': f'Only a submitted paper can be approved (this one is {paper.status}).'},
                status=http_status.HTTP_409_CONFLICT)

        paper.status = 'approved'
        paper.approved_by = request.user
        paper.approved_at = timezone.now()
        paper.rejection_reason = ''
        paper.save(update_fields=['status', 'approved_by', 'approved_at',
                                  'rejection_reason', 'updated_at'])

        audit(request.user, 'exam_paper.approved', target=paper.title,
              detail={'paper_id': str(paper.id), 'class': paper.class_obj.name})
        _tell_the_author(paper, 'Exam paper approved',
                         f'"{paper.title}" was approved and may now be printed.')
        return Response(ExamPaperSerializer(paper).data)


class DosExamPaperRejectView(APIView):
    """
    POST /imboni/dos/exam-papers/<pk>/reject/  { reason }

    Sending a paper back returns control to its author, so `is_editable` is
    true again. The reason is required: "rejected" with no explanation makes
    the teacher guess, and they will guess wrong.
    """
    permission_classes = [IsDOSOrAdmin]

    def post(self, request, pk):
        paper = _paper_or_none(pk)
        if paper is None:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)
        if paper.status != 'submitted':
            return Response(
                {'detail': f'Only a submitted paper can be sent back (this one is {paper.status}).'},
                status=http_status.HTTP_409_CONFLICT)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'reason': 'Say what needs changing.'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        paper.status = 'rejected'
        paper.rejection_reason = reason
        paper.approved_by = None
        paper.approved_at = None
        paper.save(update_fields=['status', 'rejection_reason', 'approved_by',
                                  'approved_at', 'updated_at'])

        audit(request.user, 'exam_paper.rejected', target=paper.title,
              detail={'paper_id': str(paper.id), 'reason': reason})
        _tell_the_author(paper, 'Exam paper sent back',
                         f'"{paper.title}" needs changes: {reason}')
        return Response(ExamPaperSerializer(paper).data)


class DosExamPaperPrintView(APIView):
    """
    GET /imboni/dos/exam-papers/<pk>/print/?scheme=1

    The paper as a PDF. `scheme=1` returns the marking scheme instead — the
    same questions with the answers and any explanations left in.

    A paper that is not approved still prints, because the DOS reads on paper
    as often as on screen, but it is watermarked so a draft can never be
    mistaken for the version the school agreed to set.
    """
    permission_classes = [IsDOSOrAdmin]

    def get(self, request, pk):
        paper = _paper_or_none(pk)
        if paper is None:
            return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        want_scheme = request.query_params.get('scheme') in ('1', 'true', 'yes')

        # Numbering runs across the whole paper, the way a candidate reads it,
        # rather than restarting per section.
        number = 0
        sections = []
        for section in paper.sections or []:
            questions = []
            for question in section.get('questions') or []:
                number += 1
                questions.append({**question, 'number': number})
            sections.append({
                'title':        section.get('title') or '',
                'instructions': section.get('instructions') or '',
                'choose_count': int(section.get('choose_count') or 0),
                # The passage, source or data table the questions refer to.
                'stimulus':     section.get('stimulus') or {},
                'questions':    questions,
            })

        html = render_to_string('reports/exam_paper.html', {
            'school_name': getattr(settings, 'SCHOOL_NAME', 'Imboni School'),
            'paper':       paper,
            'sections':    sections,
            'scheme':      want_scheme,
            'draft':       paper.status != 'approved',
            'total_marks': paper.total_marks,
            'printed_on':  timezone.now(),
        })

        from xhtml2pdf import pisa
        buffer = io.BytesIO()
        pisa.CreatePDF(io.StringIO(html), dest=buffer)

        kind = 'marking-scheme' if want_scheme else 'paper'
        safe_title = ''.join(c if c.isalnum() or c in '-_' else '-'
                             for c in paper.title).strip('-') or 'exam'
        filename = f'{safe_title}-{paper.class_obj.name}-{kind}.pdf'.replace(' ', '-')

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
