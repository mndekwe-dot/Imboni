"""
The staff register against how a school is actually staffed.

Teachers with logins and cooks without, departments that people move between,
and a payroll that pays all of them and remembers where each one worked.
"""
from datetime import date
from decimal import Decimal

import pytest

from apps.authentication.factories import StudentFactory, UserFactory
from apps.finance import services
from apps.finance.models import PayrollRun, StaffSalary
from apps.staff.models import Department, StaffMember

pytestmark = pytest.mark.django_db


def a_worker(**kwargs):
    kwargs.setdefault('first_name', 'Jeanne')
    kwargs.setdefault('last_name', 'Mukamana')
    kwargs.setdefault('job_title', 'Cook')
    kwargs.setdefault('department', Department.objects.get(code='kitchen'))
    return StaffMember.objects.create(**kwargs)


class TestAccountsAndTheRegister:
    def test_a_new_staff_account_is_a_new_worker_in_its_roles_department(self):
        teacher = UserFactory(role='teacher', first_name='Claudine', last_name='Umutoni')

        member = teacher.staff_record
        assert member.full_name == 'Claudine Umutoni'
        assert member.department.code == 'academic'
        assert member.job_title == 'Teacher'

    def test_students_and_parents_are_not_staff(self):
        StudentFactory()
        UserFactory(role='parent')

        assert not StaffMember.objects.filter(user__role__in=['student', 'parent']).exists()

    def test_a_rename_follows_but_a_transfer_is_kept(self):
        teacher = UserFactory(role='teacher', first_name='Claudine')
        member = teacher.staff_record
        member.department = Department.objects.get(code='boarding')
        member.job_title = 'House mistress'
        member.save()

        teacher.first_name = 'Claudia'
        teacher.save()

        member.refresh_from_db()
        assert member.first_name == 'Claudia'
        assert member.department.code == 'boarding'
        assert member.job_title == 'House mistress'


class TestPayrollPaysEveryWorker:
    def test_a_worker_without_a_login_is_paid(self):
        cook = a_worker()
        StaffSalary.objects.create(staff=cook, gross=Decimal('120000'), tax_method='flat')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)

        assert services.build_payroll(run) == 1
        payslip = run.payslips.get()
        assert payslip.staff_name == 'Jeanne Mukamana'
        assert payslip.job_title == 'Cook'
        assert payslip.department == 'Kitchen & catering'

    def test_a_payslip_keeps_the_department_it_was_paid_under(self):
        cook = a_worker()
        StaffSalary.objects.create(staff=cook, gross=Decimal('120000'), tax_method='flat')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)
        services.build_payroll(run)

        cook.department = Department.objects.get(code='cleaning')
        cook.save()

        assert run.payslips.get().department == 'Kitchen & catering'

    def test_somebody_who_has_left_is_not_paid(self):
        guard = a_worker(first_name='Eric', job_title='Guard',
                         department=Department.objects.get(code='security'), is_active=False)
        StaffSalary.objects.create(staff=guard, gross=Decimal('90000'), tax_method='flat')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)

        assert services.build_payroll(run) == 0

    def test_the_run_costs_each_department(self, api_client):
        StaffSalary.objects.create(staff=a_worker(), gross=Decimal('120000'), tax_method='flat')
        StaffSalary.objects.create(staff=a_worker(first_name='Alice'), gross=Decimal('100000'),
                                   tax_method='flat')
        teacher = UserFactory(role='teacher')
        StaffSalary.objects.create(staff=teacher.staff_record, gross=Decimal('300000'),
                                   tax_method='flat')
        run = PayrollRun.objects.create(period_month=9, period_year=2026)
        services.build_payroll(run)
        api_client.force_authenticate(UserFactory(role='bursar'))

        data = api_client.get(f'/imboni/finance/payroll/{run.id}/').data

        costs = {row['department']: (row['staff'], row['gross']) for row in data['by_department']}
        assert costs == {'Academic': (1, '300000.00'), 'Kitchen & catering': (2, '220000.00')}
        csv = api_client.get(f'/imboni/finance/payroll/{run.id}/?format=csv').content.decode()
        assert 'Kitchen & catering' in csv
        pdf = api_client.get(f'/imboni/finance/payroll/{run.id}/?format=pdf')
        assert pdf['Content-Type'] == 'application/pdf'

    def test_the_bursar_sets_a_salary_on_a_register_entry(self, api_client):
        cook = a_worker()
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.post('/imboni/finance/salaries/', {
            'staff': str(cook.id), 'gross': '150000', 'tax_method': 'paye'}, format='json')

        assert response.status_code == 201, response.data
        assert response.data['department'] == 'Kitchen & catering'
        member = api_client.get('/imboni/staff/members/').data
        assert next(m for m in member if m['id'] == str(cook.id))['salary']['gross'] == '150000.00'

    def test_no_salary_for_somebody_who_has_left(self, api_client):
        cook = a_worker(is_active=False)
        api_client.force_authenticate(UserFactory(role='bursar'))

        response = api_client.post('/imboni/finance/salaries/', {'staff': str(cook.id), 'gross': '1'})

        assert response.status_code == 400


class TestTheRegisterApi:
    def test_the_office_adds_a_worker_without_an_account(self, api_client):
        api_client.force_authenticate(UserFactory(role='admin'))
        kitchen = Department.objects.get(code='kitchen')

        response = api_client.post('/imboni/staff/members/', {
            'first_name': 'Jeanne', 'last_name': 'Mukamana', 'job_title': 'Cook',
            'department': str(kitchen.id), 'employment_type': 'casual', 'staff_no': 'K-01',
        }, format='json')

        assert response.status_code == 201, response.data
        assert response.data['has_account'] is False
        assert response.data['department_name'] == 'Kitchen & catering'

    def test_a_staff_number_is_issued_once(self, api_client):
        a_worker(staff_no='K-01')
        api_client.force_authenticate(UserFactory(role='admin'))

        response = api_client.post('/imboni/staff/members/', {
            'first_name': 'Alice', 'staff_no': 'K-01'}, format='json')

        assert response.status_code == 400
        assert 'staff_no' in response.data

    def test_names_of_an_account_holder_are_changed_on_the_account(self, api_client):
        member = UserFactory(role='teacher', first_name='Claudine').staff_record
        api_client.force_authenticate(UserFactory(role='admin'))

        refused = api_client.patch(f'/imboni/staff/members/{member.id}/', {'first_name': 'X'},
                                   format='json')
        moved = api_client.patch(f'/imboni/staff/members/{member.id}/', {
            'department': str(Department.objects.get(code='boarding').id)}, format='json')

        assert refused.status_code == 400
        assert moved.status_code == 200
        assert moved.data['department_code'] == 'boarding'

    def test_filters_by_department_and_status(self, api_client):
        a_worker()
        a_worker(first_name='Gone', is_active=False, end_date=date(2026, 1, 31))
        api_client.force_authenticate(UserFactory(role='bursar'))
        kitchen = Department.objects.get(code='kitchen')

        active = api_client.get(f'/imboni/staff/members/?department={kitchen.id}').data
        left = api_client.get(f'/imboni/staff/members/?department={kitchen.id}&status=left').data

        assert [m['first_name'] for m in active] == ['Jeanne']
        assert [m['first_name'] for m in left] == ['Gone']
        csv = api_client.get('/imboni/staff/members/?format=csv')
        assert csv['Content-Type'].startswith('text/csv')

    def test_a_department_in_use_is_retired_not_deleted(self, api_client):
        a_worker()
        empty = Department.objects.create(code='farm', name='Farm')
        api_client.force_authenticate(UserFactory(role='admin'))
        kitchen = Department.objects.get(code='kitchen')

        retired = api_client.delete(f'/imboni/staff/departments/{kitchen.id}/')
        deleted = api_client.delete(f'/imboni/staff/departments/{empty.id}/')

        assert retired.status_code == 200 and retired.data['is_active'] is False
        assert deleted.status_code == 204

    def test_a_worker_who_was_paid_cannot_be_deleted(self, api_client):
        cook = a_worker()
        StaffSalary.objects.create(staff=cook, gross=Decimal('120000'), tax_method='flat')
        services.build_payroll(PayrollRun.objects.create(period_month=9, period_year=2026))
        api_client.force_authenticate(UserFactory(role='admin'))

        response = api_client.delete(f'/imboni/staff/members/{cook.id}/')

        assert response.status_code == 400
        assert StaffMember.objects.filter(pk=cook.pk).exists()

    def test_departments_list_counts_who_works_there(self, api_client):
        a_worker()
        a_worker(first_name='Alice')
        api_client.force_authenticate(UserFactory(role='bursar'))

        rows = api_client.get('/imboni/staff/departments/').data

        assert next(r for r in rows if r['code'] == 'kitchen')['member_count'] == 2

    @pytest.mark.parametrize('role', ['teacher', 'dos', 'student', 'parent'])
    def test_only_the_office_and_the_head_keep_it(self, api_client, role):
        api_client.force_authenticate(UserFactory(role=role))

        assert api_client.get('/imboni/staff/members/').status_code == 403
