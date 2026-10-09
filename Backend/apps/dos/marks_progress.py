"""
Who has handed in their marks, and who has not.

Report cards wait for every subject of every class. When one teacher is late the
whole class stalls, and the only way to find out WHICH teacher was to open each
class and each subject in turn. This lays the term out as one grid: a row per
class, a column per subject, each cell saying whether that teacher's marks are
in, and a button that reminds the ones who are not.

Three queries however big the school (assignments, class sizes, and one grouped
count of results), never one per cell.

    GET  /imboni/dos/results/progress/      the grid
    POST /imboni/dos/results/remind/        remind the teachers whose cells are open
"""
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsDOSOrAdmin
from apps.notifications.services import notify_user
from apps.results.models import AcademicTerm, Result
from apps.teacher.models import ClassAssignment, SubjectTeacherAssignment

# A teacher is reminded at most once in this window, however many times the DOS
# presses the button. A reminder that arrives six times is ignored the sixth.
REMIND_COOLDOWN_SECONDS = 6 * 60 * 60

OPEN_STATES = ('missing', 'partial')       # states where the teacher still has work to do


def _state(total, counts):
    """One cell's state, from the class size and its marks counted by status."""
    entered = sum(counts.values())
    approved = counts.get('approved', 0)
    handed_in = approved + counts.get('submitted', 0)
    if total == 0:
        return 'empty'                      # nobody in the class to mark
    if entered == 0:
        return 'missing'
    if approved >= total:
        return 'approved'
    if handed_in >= total:
        return 'submitted'                  # all in; waiting on the DOS to approve
    return 'partial'                        # some entered, some still draft / rejected / absent


def build_progress(term):
    """The grid for `term`, as plain data."""
    assignments = list(
        SubjectTeacherAssignment.objects.filter(term=term)
        .select_related('teacher', 'subject', 'class_obj')
    )

    sizes = {
        row['class_obj_id']: row['n']
        for row in ClassAssignment.objects.filter(term=term)
        .order_by().values('class_obj_id').annotate(n=Count('id'))
    }

    counted = defaultdict(lambda: defaultdict(int))        # (class, subject) -> status -> n
    for row in (Result.objects
                .filter(term=term, student__class_assignments__term=term)
                .order_by()
                .values('student__class_assignments__class_obj_id', 'subject_id', 'status')
                .annotate(n=Count('id'))):
        counted[(row['student__class_assignments__class_obj_id'], row['subject_id'])][row['status']] += row['n']

    classes, subjects, cells = {}, {}, []
    summary = defaultdict(int)
    for a in assignments:
        classes[a.class_obj_id] = a.class_obj
        subjects[a.subject_id] = a.subject
        counts = counted.get((a.class_obj_id, a.subject_id), {})
        total = sizes.get(a.class_obj_id, 0)
        state = _state(total, counts)
        summary[state] += 1
        cells.append({
            'class_id': str(a.class_obj_id),
            'subject_id': str(a.subject_id),
            'teacher_id': str(a.teacher_id),
            'teacher_name': a.teacher.get_full_name() or a.teacher.username,
            'total': total,
            'entered': sum(counts.values()),
            'submitted': counts.get('submitted', 0),
            'approved': counts.get('approved', 0),
            'state': state,
        })

    return {
        'term': {'id': str(term.id), 'name': term.name},
        'classes': [
            {'id': str(c.id), 'name': c.name}
            for c in sorted(classes.values(), key=lambda c: (str(c.grade), str(c.section)))
        ],
        'subjects': [
            {'id': str(s.id), 'name': s.name}
            for s in sorted(subjects.values(), key=lambda s: s.name)
        ],
        'cells': cells,
        'summary': {k: summary.get(k, 0) for k in
                    ('approved', 'submitted', 'partial', 'missing', 'empty')},
    }


class MarksProgressView(APIView):
    """GET /imboni/dos/results/progress/?term_id=<uuid>   (current term by default)"""
    permission_classes = [IsDOSOrAdmin]

    def get(self, request):
        term_id = request.query_params.get('term_id')
        term = (AcademicTerm.objects.filter(pk=term_id).first() if term_id
                else AcademicTerm.objects.filter(is_current=True).first())
        if not term:
            return Response({'detail': 'There is no current term.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_progress(term))


class RemindTeachersView(APIView):
    """
    POST /imboni/dos/results/remind/   {"class_id": "...", "subject_id": "..."}   (both optional)

    Reminds every teacher with an open cell, once, listing what is open. Narrow
    it with class_id and/or subject_id. Answers how many were reminded and how
    many were skipped because they were reminded recently.
    """
    permission_classes = [IsDOSOrAdmin]

    def post(self, request):
        term = AcademicTerm.objects.filter(is_current=True).first()
        if not term:
            return Response({'detail': 'There is no current term.'}, status=status.HTTP_404_NOT_FOUND)

        class_id = str(request.data.get('class_id') or '')
        subject_id = str(request.data.get('subject_id') or '')

        progress = build_progress(term)
        names_c = {c['id']: c['name'] for c in progress['classes']}
        names_s = {s['id']: s['name'] for s in progress['subjects']}

        open_by_teacher = defaultdict(list)
        for cell in progress['cells']:
            if cell['state'] not in OPEN_STATES:
                continue
            if class_id and cell['class_id'] != class_id:
                continue
            if subject_id and cell['subject_id'] != subject_id:
                continue
            open_by_teacher[cell['teacher_id']].append(
                f"{names_c[cell['class_id']]} {names_s[cell['subject_id']]}")

        if not open_by_teacher:
            return Response({'notified': 0, 'skipped_recent': 0, 'open': 0})

        from apps.authentication.models import User
        notified = skipped = 0
        for teacher in User.objects.filter(pk__in=open_by_teacher.keys()):
            key = f'marks-remind:{teacher.pk}'
            if cache.get(key):
                skipped += 1
                continue
            items = sorted(open_by_teacher[str(teacher.pk)])
            shown = ', '.join(items[:6]) + (f' and {len(items) - 6} more' if len(items) > 6 else '')
            notify_user(
                teacher,
                'Marks still to be handed in',
                f'{progress["term"]["name"]}: {shown}.',
                type='results',
                path='/teacher/results',
            )
            cache.set(key, True, REMIND_COOLDOWN_SECONDS)
            notified += 1

        return Response({
            'notified': notified,
            'skipped_recent': skipped,
            'open': sum(len(v) for v in open_by_teacher.values()),
        })
