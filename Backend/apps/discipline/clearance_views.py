"""
The clearance card: can this student leave?

    GET /imboni/discipline/clearance/               a class (or the school) at a glance
        ?grade=S4&section=A  ?search=amina  ?status=active   ?page=1&page_size=25
    GET /imboni/discipline/clearance/<student>/     one student, with the reasons

See clearance.py for what is checked and why.
"""
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdminOrDiscipline
from apps.dos import structure
from apps.student.models import Student

from .clearance import clearance_for


def _money(value):
    return float(value)


def _row(student, verdict):
    return {
        'student_id': student.id,
        'student_code': student.student_id,
        'full_name': student.full_name,
        'grade': student.grade,
        'grade_label': structure.year_label(student.grade),
        'section': student.section,
        'status': student.status,
        'cleared': verdict['cleared'],
        'away': verdict['away'],
        'finance': {'cleared': verdict['finance']['cleared'], 'owed': _money(verdict['finance']['owed'])},
        'library': {
            'cleared': verdict['library']['cleared'],
            'books_out': verdict['library']['books_out'],
            'owed': _money(verdict['library']['owed']),
        },
        'medical': dict(verdict['medical']),
    }


# Above this many students in one filter, skip the whole-set headline.
SUMMARY_LIMIT = 2000


class ClearancePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 200


class ClearanceListView(APIView):
    permission_classes = [IsDOSOrAdminOrDiscipline]

    def get(self, request):
        q = request.query_params
        students = Student.objects.select_related('user').order_by(
            'grade', 'section', 'user__last_name', 'user__first_name', 'id')

        # Departing students are the usual question, so the default is active
        # students; ?status= widens or narrows it.
        students = students.filter(status=(q.get('status', '').strip() or 'active'))
        if q.get('grade', '').strip():
            students = students.filter(grade=q['grade'].strip())
        if q.get('section', '').strip():
            students = students.filter(section__iexact=q['section'].strip())
        search = q.get('search', '').strip()
        if search:
            students = students.filter(
                Q(user__first_name__icontains=search) | Q(user__last_name__icontains=search)
                | Q(student_id__icontains=search))

        # One pass over the whole filtered set: the verdicts for the page AND the
        # headline ("how many can leave?") come from the same few queries, and the
        # headline does not change as you turn the page. Past this size only the
        # page is worked out, and there is no headline.
        paginator = ClearancePagination()
        if students.count() <= SUMMARY_LIMIT:
            everyone = list(students)
            verdicts = clearance_for(everyone)
            page = paginator.paginate_queryset(everyone, request, view=self)
            cleared = sum(1 for v in verdicts.values() if v['cleared'])
            summary = {'cleared': cleared, 'blocked': len(verdicts) - cleared}
        else:
            page = paginator.paginate_queryset(students, request, view=self)
            verdicts = clearance_for(page)
            summary = None

        body = paginator.get_paginated_response([_row(s, verdicts[s.id]) for s in page]).data
        if summary is not None:
            body['summary'] = summary
        return Response(body)


class ClearanceDetailView(APIView):
    permission_classes = [IsDOSOrAdminOrDiscipline]

    def get(self, request, pk):
        student = Student.objects.select_related('user').filter(pk=pk).first()
        if student is None:
            return Response({'detail': 'Student not found.'}, status=404)

        row = _row(student, clearance_for([student])[student.id])

        # The reasons, so the family is told what to bring back or pay.
        books = []
        if student.user_id:
            from apps.library.services import clearance as library_clearance
            books = [
                {'title': b['title'], 'copy_code': b['copy_code'],
                 'due_on': b['due_on'], 'overdue': b['overdue']}
                for b in library_clearance(student.user)['books_out']
            ]
        row['library']['books'] = books
        return Response(row)
