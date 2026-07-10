"""
Tests for the onboarding bulk-import commands: import_classes & import_timetable.
"""
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.audit.models import AuditEntry
from apps.authentication.factories import UserFactory, SubjectFactory, AcademicTermFactory
from apps.teacher.models import Class, Timetable


def write_csv(tmp_path, name, text):
    path = tmp_path / name
    path.write_text(text, encoding='utf-8')
    return str(path)


@pytest.mark.django_db
class TestImportClasses:
    def test_creates_classes_from_csv(self, tmp_path):
        csv = write_csv(tmp_path, 'classes.csv',
            'grade,section,room_number,max_students\n'
            '1,A,R101,35\n'
            '1,B,R102,\n')
        call_command('import_classes', csv)

        a = Class.objects.get(grade='1', section='A')
        assert a.room_number == 'R101'
        assert a.max_students == 35
        assert a.name == 'Grade 1A'                 # default name
        assert Class.objects.get(grade='1', section='B').max_students == 40  # default

    def test_reimport_updates_in_place_no_duplicates(self, tmp_path):
        write = lambda room: write_csv(tmp_path, 'c.csv', f'grade,section,room_number\n1,A,{room}\n')
        call_command('import_classes', write('R101'))
        call_command('import_classes', write('R999'))

        assert Class.objects.filter(grade='1', section='A').count() == 1
        assert Class.objects.get(grade='1', section='A').room_number == 'R999'

    def test_resolves_class_teacher_by_email(self, tmp_path):
        teacher = UserFactory(role='teacher', email='ct@imboni.test')
        csv = write_csv(tmp_path, 'c.csv',
            'grade,section,class_teacher_email\n2,A,ct@imboni.test\n')
        call_command('import_classes', csv)
        assert Class.objects.get(grade='2', section='A').class_teacher_id == teacher.id

    def test_unknown_teacher_email_skips_row(self, tmp_path):
        csv = write_csv(tmp_path, 'c.csv',
            'grade,section,class_teacher_email\n2,A,ghost@imboni.test\n')
        call_command('import_classes', csv)
        assert not Class.objects.filter(grade='2', section='A').exists()

    def test_dry_run_writes_nothing(self, tmp_path):
        csv = write_csv(tmp_path, 'c.csv', 'grade,section\n1,A\n')
        call_command('import_classes', csv, '--dry-run')
        assert Class.objects.count() == 0

    def test_writes_audit_entry(self, tmp_path):
        csv = write_csv(tmp_path, 'c.csv', 'grade,section\n1,A\n')
        call_command('import_classes', csv)
        assert AuditEntry.objects.filter(action='classes.imported').exists()

    def test_missing_file_raises(self):
        with pytest.raises(CommandError):
            call_command('import_classes', 'nope.csv')


@pytest.mark.django_db
class TestImportTimetable:
    def _setup(self):
        Class.objects.create(grade='1', section='A', name='1A')
        SubjectFactory(code='MATH101', name='Mathematics')
        SubjectFactory(code='ENG101', name='English')
        return AcademicTermFactory(is_current=True)

    def test_creates_slots(self, tmp_path):
        self._setup()
        csv = write_csv(tmp_path, 'tt.csv',
            'grade,section,day,start_time,end_time,subject,room_number\n'
            '1,A,monday,08:00,08:40,MATH101,R101\n'
            '1,A,monday,08:40,09:20,ENG101,R101\n')
        call_command('import_timetable', csv)

        assert Timetable.objects.count() == 2
        slot = Timetable.objects.get(day='monday', start_time='08:00')
        assert slot.subject.code == 'MATH101'
        assert slot.room_number == 'R101'

    def test_no_current_term_raises(self, tmp_path):
        Class.objects.create(grade='1', section='A')
        SubjectFactory(code='MATH101')
        csv = write_csv(tmp_path, 'tt.csv',
            'grade,section,day,start_time,end_time,subject\n1,A,monday,08:00,08:40,MATH101\n')
        with pytest.raises(CommandError, match='current AcademicTerm'):
            call_command('import_timetable', csv)

    def test_unknown_class_skips_row(self, tmp_path):
        self._setup()
        csv = write_csv(tmp_path, 'tt.csv',
            'grade,section,day,start_time,end_time,subject\n6,C,monday,08:00,08:40,MATH101\n')
        call_command('import_timetable', csv)
        assert Timetable.objects.count() == 0

    def test_bad_time_skips_row(self, tmp_path):
        self._setup()
        csv = write_csv(tmp_path, 'tt.csv',
            'grade,section,day,start_time,end_time,subject\n1,A,monday,08:40,08:00,MATH101\n')
        call_command('import_timetable', csv)   # end before start
        assert Timetable.objects.count() == 0

    def test_teacher_double_booking_is_skipped(self, tmp_path):
        self._setup()
        UserFactory(role='teacher', email='t@imboni.test')
        Class.objects.create(grade='2', section='A', name='2A')
        csv = write_csv(tmp_path, 'tt.csv',
            'grade,section,day,start_time,end_time,subject,teacher_email\n'
            '1,A,monday,08:00,08:40,MATH101,t@imboni.test\n'
            '2,A,monday,08:00,08:40,ENG101,t@imboni.test\n')   # same teacher, same time, other class
        call_command('import_timetable', csv)

        # Only the first booking survives; the clashing one is skipped.
        assert Timetable.objects.filter(teacher__email='t@imboni.test').count() == 1

    def test_reimport_updates_slot_in_place(self, tmp_path):
        self._setup()
        base = 'grade,section,day,start_time,end_time,subject\n1,A,monday,08:00,08:40,{}\n'
        call_command('import_timetable', write_csv(tmp_path, 'a.csv', base.format('MATH101')))
        call_command('import_timetable', write_csv(tmp_path, 'b.csv', base.format('ENG101')))

        assert Timetable.objects.count() == 1
        assert Timetable.objects.get().subject.code == 'ENG101'

    def test_dry_run_writes_nothing(self, tmp_path):
        self._setup()
        csv = write_csv(tmp_path, 'tt.csv',
            'grade,section,day,start_time,end_time,subject\n1,A,monday,08:00,08:40,MATH101\n')
        call_command('import_timetable', csv, '--dry-run')
        assert Timetable.objects.count() == 0
