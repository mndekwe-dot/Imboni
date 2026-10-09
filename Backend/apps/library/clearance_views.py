"""Library work at the two ends of the term: handing out class sets, and clearing leavers."""
from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from apps.student.models import Student

from . import services
from .models import Book
from .views import LibrarianView


def _pupils(request, data):
    """The active pupils of the year and stream the librarian picked (stream optional)."""
    grade = (data.get('grade') or '').strip()
    stream = (data.get('stream') or '').strip()
    if not grade:
        return None
    students = Student.objects.filter(status='active', grade=grade).select_related('user')
    if stream:
        students = students.filter(section=stream)
    return students.order_by('user__last_name', 'user__first_name')


class IssueClassSetView(LibrarianView):
    """
    POST /imboni/library/loans/issue-class/  {book, grade, stream?}

    One copy of the title to every pupil in the class. Pupils the rules stop,
    and pupils there is no copy left for, come back in the reply so the
    librarian can see exactly who still needs a book.
    """

    def post(self, request):
        book = get_object_or_404(Book, pk=request.data.get('book'))
        students = _pupils(request, request.data)
        if students is None:
            return Response({'detail': 'Choose a year to issue to.'}, status=400)
        pupils = list(students)
        if not pupils:
            return Response({'detail': 'There are no pupils in that class.'}, status=400)

        result = services.issue_class_set(book, pupils, issued_by=request.user)
        name = lambda s: s.full_name
        return Response({
            'book': book.title,
            'class_size': len(pupils),
            'issued': len(result['issued']),
            'skipped': [{'student': name(s), 'reason': why} for s, why in result['skipped']],
            'short': [name(s) for s in result['short']],
        }, status=201 if result['issued'] else 200)


class ClearanceView(LibrarianView):
    """
    GET /imboni/library/clearance/?student=<id>          one pupil
    GET /imboni/library/clearance/?grade=S6&stream=A     who in a class is not yet cleared
    """

    def get(self, request):
        student_id = request.query_params.get('student')
        if student_id:
            student = get_object_or_404(Student.objects.select_related('user'), pk=student_id)
            return Response({'student': student.full_name, **_row(services.clearance(student.user))})

        students = _pupils(request, request.query_params)
        if students is None:
            return Response({'detail': 'Choose a pupil, or a year.'}, status=400)
        outstanding = []
        for s in students:
            c = services.clearance(s.user)
            if not c['cleared']:
                outstanding.append({'student': s.full_name, 'student_id': s.student_id, **_row(c)})
        return Response({'class_size': students.count(), 'not_cleared': outstanding})


def _row(c):
    return {'cleared': c['cleared'], 'owed': str(c['owed']), 'books_out': c['books_out']}
