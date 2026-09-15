"""
The fee setup against how schools really bill.

Boarding for boarders only, an admission fee once for new pupils, transport for
the families who take the bus, instalments, sibling discounts - and all of it
safe to invoice twice.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory, UserFactory
from apps.discipline.models import BoardingStudent
from apps.finance import services
from apps.finance.models import FeeCategory, FeeDiscount, FeeStructure, StructureCharge
from apps.parents.models import ParentStudentRelationship
from apps.results.models import AcademicTerm
from apps.student.models import Fee

pytestmark = pytest.mark.django_db


@pytest.fixture
def term():
    today = timezone.localdate()
    AcademicTerm.objects.create(name='Term 1 2026', term='1', year=2026, order=1,
                                start_date=today - timedelta(days=200),
                                end_date=today - timedelta(days=120))
    return AcademicTerm.objects.create(name='Term 2 2026', term='2', year=2026, order=2,
                                       is_current=True, start_date=today - timedelta(days=30),
                                       end_date=today + timedelta(days=60))


def line(term, **kwargs):
    defaults = dict(term=term, category='tuition', amount=Decimal('100000'),
                    due_date=timezone.localdate() + timedelta(days=14))
    defaults.update(kwargs)
    students = defaults.pop('students', None)
    structure = FeeStructure.objects.create(**defaults)
    if students:
        structure.students.set(students)
    return structure


def board(student, kind='full_boarder'):
    return BoardingStudent.objects.create(student=student, dormitory='Kivu', room_number='1',
                                          boarding_type=kind, check_in_date=timezone.localdate())


class TestWhoPays:
    def test_several_years_and_one_combination(self, term):
        s4 = StudentFactory(grade='S4', section='A')
        s5_mpc = StudentFactory(grade='S5', section='MPC')
        StudentFactory(grade='S5', section='PCB')
        StudentFactory(grade='S1', section='A')

        created = services.invoice_from_structure(line(
            term, classes=[{'grade': 'S4', 'stream': ''}, {'grade': 'S5', 'stream': 'MPC'}]))

        assert {fee.student_id for fee in created} == {s4.id, s5_mpc.id}

    def test_no_classes_means_the_whole_school(self, term):
        for grade in ('S1', 'S3', 'S6'):
            StudentFactory(grade=grade)
        assert len(services.invoice_from_structure(line(term))) == 3

    def test_boarding_only_for_boarders(self, term):
        boarder, weekly, day = StudentFactory(), StudentFactory(), StudentFactory()
        board(boarder)
        board(weekly, 'weekly_boarder')
        board(day, 'day_scholar')

        created = services.invoice_from_structure(line(term, category='boarding', boarding='boarders'))

        assert {fee.student_id for fee in created} == {boarder.id, weekly.id}

    def test_new_students_only(self, term):
        year_start = AcademicTerm.objects.get(order=1).start_date
        new = StudentFactory(enrollment_date=year_start + timedelta(days=5))
        StudentFactory(enrollment_date=year_start - timedelta(days=365))

        created = services.invoice_from_structure(line(term, category='admission', intake='new'))

        assert [fee.student_id for fee in created] == [new.id]

    def test_an_optional_fee_bills_only_those_who_take_it(self, term):
        rider = StudentFactory()
        StudentFactory()

        created = services.invoice_from_structure(
            line(term, category='transport', is_mandatory=False, students=[rider]))

        assert [fee.student_id for fee in created] == [rider.id]

    def test_left_students_are_never_billed(self, term):
        StudentFactory(status='transferred')
        assert services.invoice_from_structure(line(term)) == []


class TestHowOften:
    def test_two_lines_in_one_category_are_both_billed(self, term):
        """The old guard skipped the second: same student, term and category."""
        student = StudentFactory()
        services.invoice_from_structure(line(term, category='other', name='Science trip'))
        services.invoice_from_structure(line(term, category='other', name='Graduation'))

        assert Fee.objects.filter(student=student, category='other').count() == 2

    def test_invoicing_twice_bills_once(self, term):
        StudentFactory()
        structure = line(term)
        services.invoice_from_structure(structure)

        assert services.invoice_from_structure(structure) == []
        assert Fee.objects.count() == 1

    def test_once_per_student_is_not_billed_again_next_term(self, term):
        student = StudentFactory()
        first = AcademicTerm.objects.get(order=1)
        services.invoice_from_structure(line(first, category='admission', name='Admission', frequency='once'))

        again = services.invoice_from_structure(
            line(term, category='admission', name='Admission', frequency='once'))

        assert again == []
        assert Fee.objects.filter(student=student, category='admission').count() == 1

    def test_once_a_year(self, term):
        StudentFactory()
        first = AcademicTerm.objects.get(order=1)
        services.invoice_from_structure(line(first, category='pta', name='PTA', frequency='year'))
        assert services.invoice_from_structure(line(term, category='pta', name='PTA', frequency='year')) == []

        next_year = AcademicTerm.objects.create(name='Term 1 2027', term='1', year=2027, order=1,
                                                start_date=date(2027, 1, 10), end_date=date(2027, 4, 1))
        assert len(services.invoice_from_structure(
            line(next_year, category='pta', name='PTA', frequency='year'))) == 1

    def test_instalments_split_the_bill_and_add_up(self, term):
        StudentFactory()
        today = timezone.localdate()
        structure = line(term, amount=Decimal('100001'), instalments=[
            {'percent': 60, 'due_date': (today + timedelta(days=5)).isoformat()},
            {'percent': 40, 'due_date': (today + timedelta(days=40)).isoformat()},
        ])

        created = services.invoice_from_structure(structure)

        assert [fee.amount for fee in created] == [Decimal('60001.00'), Decimal('40000.00')]
        assert sum(fee.amount for fee in created) == Decimal('100001.00')
        assert 'Instalment 2 of 2' in created[1].notes
        assert StructureCharge.objects.filter(structure=structure).count() == 2

    def test_instalments_that_do_not_add_up_are_refused(self):
        with pytest.raises(services.FinanceError, match='100%'):
            services.validate_instalments([
                {'percent': 50, 'due_date': '2026-09-01'}, {'percent': 30, 'due_date': '2026-10-01'}])


class TestDiscounts:
    def test_the_second_child_gets_the_sibling_discount(self, term):
        parent = UserFactory(role='parent')
        eldest = StudentFactory(enrollment_date=date(2024, 1, 10))
        younger = StudentFactory(enrollment_date=date(2025, 1, 10))
        for child in (eldest, younger):
            ParentStudentRelationship.objects.create(parent=parent, student=child)
        FeeDiscount.objects.create(name='Sibling', kind='percent', value=Decimal('10'),
                                   scope='siblings', categories=['tuition'])

        created = {fee.student_id: fee for fee in services.invoice_from_structure(line(term))}

        assert created[eldest.id].amount == Decimal('100000.00')
        assert created[younger.id].amount == Decimal('90000.00')
        assert 'Sibling 10%' in created[younger.id].notes

    def test_a_discount_for_other_categories_does_not_apply(self, term):
        student = StudentFactory()
        discount = FeeDiscount.objects.create(name='Staff child', kind='fixed', value=Decimal('20000'),
                                              scope='students', categories=['lunch'])
        discount.students.set([student])

        assert services.invoice_from_structure(line(term))[0].amount == Decimal('100000.00')

    def test_percent_before_fixed_and_never_below_zero(self, term):
        student = StudentFactory()
        for name, kind, value in (('Fixed', 'fixed', '95000'), ('Half', 'percent', '50')):
            discount = FeeDiscount.objects.create(name=name, kind=kind, value=Decimal(value),
                                                  scope='students')
            discount.students.set([student])

        amount, reasons = services.price_for(student, line(term))

        assert amount == Decimal('0.00')
        assert reasons[0].startswith('Half')


class TestTheOffice:
    def test_preview_then_invoice_the_whole_term(self, term, api_client):
        StudentFactory(grade='S1')
        StudentFactory(grade='S2')
        line(term, classes=[{'grade': 'S1', 'stream': ''}])
        line(term, category='lunch', amount=Decimal('20000'))
        api_client.force_authenticate(UserFactory(role='bursar'))

        preview = api_client.post('/imboni/finance/invoice-term/', {'dry_run': True}, format='json')
        assert preview.status_code == 200
        assert preview.data['total'] == '140000.00'
        assert not Fee.objects.exists()

        done = api_client.post('/imboni/finance/invoice-term/', {}, format='json')
        assert done.status_code == 201
        assert Fee.objects.count() == 3

    def test_a_line_is_created_with_its_rules(self, term, api_client):
        rider = StudentFactory()
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.post('/imboni/finance/structures/', {
            'name': 'Bus - Nyamirambo route', 'category': 'transport', 'amount': '30000',
            'due_date': timezone.localdate().isoformat(), 'is_mandatory': False,
            'students': [str(rider.id)], 'boarding': 'day', 'frequency': 'term',
        }, format='json')

        assert response.status_code == 201, response.data
        assert response.data['student_list'][0]['id'] == str(rider.id)

    def test_an_optional_line_without_students_is_refused(self, term, api_client):
        api_client.force_authenticate(UserFactory(role='bursar'))
        response = api_client.post('/imboni/finance/structures/', {
            'category': 'transport', 'amount': '30000', 'is_mandatory': False,
            'due_date': timezone.localdate().isoformat()}, format='json')
        assert response.status_code == 400

    def test_the_school_adds_its_own_category(self, api_client):
        api_client.force_authenticate(UserFactory(role='bursar'))
        response = api_client.post('/imboni/finance/fee-categories/',
                                   {'name': 'Laptop programme'}, format='json')
        assert response.status_code == 201
        assert FeeCategory.objects.get(code='laptop_programme').name == 'Laptop programme'

    def test_a_billed_line_cannot_be_deleted(self, term, api_client):
        StudentFactory()
        structure = line(term)
        services.invoice_from_structure(structure)
        api_client.force_authenticate(UserFactory(role='bursar'))

        assert api_client.delete(f'/imboni/finance/structures/{structure.id}/').status_code == 400

    def test_copying_a_term_moves_due_dates_along(self, term, api_client):
        first = AcademicTerm.objects.get(order=1)
        line(first, name='Tuition', due_date=first.start_date + timedelta(days=7))
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.post('/imboni/finance/structures/copy/',
                                   {'from_term': str(first.id)}, format='json')
        again = api_client.post('/imboni/finance/structures/copy/',
                                {'from_term': str(first.id)}, format='json')

        assert response.data['copied'] == 1 and again.data['copied'] == 0
        assert FeeStructure.objects.get(term=term).due_date == term.start_date + timedelta(days=7)

    def test_a_custom_category_prints_its_name_on_the_charges_export(self, term, api_client):
        FeeCategory.objects.create(code='laptops', name='Laptop programme')
        StudentFactory()
        services.invoice_from_structure(line(term, category='laptops'))
        api_client.force_authenticate(UserFactory(role='bursar'))

        csv = api_client.get('/imboni/finance/fees/?format=csv')

        assert csv.status_code == 200
        assert 'Laptop programme' in csv.content.decode()
        pdf = api_client.get('/imboni/finance/fees/?format=pdf')
        assert pdf['Content-Type'] == 'application/pdf'
