"""Matching a statement to families: the rules, then the two endpoints."""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory, UserFactory
from apps.finance import services, statement_match as sm
from apps.finance.models import FeePayment, StudentAccount
from apps.student.models import Fee

D = Decimal


def family(id_, code, outstanding, phone=''):
    return {'id': id_, 'student_id': code, 'name': id_, 'phone': phone, 'outstanding': D(outstanding)}


FAMILIES = [family('a', 'ADM001', '50000', '0788111111'), family('b', 'ADM002', '75000', '+250 788 222 222'),
            family('c', 'ADM010', '75000', '')]


class TestRules:
    def test_an_admission_number_in_the_narration_is_enough(self):
        r = sm.match_row({'amount': '10000', 'description': 'FEES FOR ADM002 TERM 1'}, FAMILIES, set())
        assert r == {'status': 'suggested', 'candidates': ['b'], 'reason': 'Admission number in the narration.'}

    def test_adm001_does_not_match_inside_adm0010(self):
        r = sm.match_row({'amount': '10000', 'description': 'ADM0010 school fees'}, FAMILIES, set())
        assert r['status'] != 'suggested' or r['candidates'] != ['a']

    def test_the_payer_phone_matches_however_it_is_written(self):
        for written in ('0788222222', '+250788222222', '788222222', '250 788 222 222'):
            r = sm.match_row({'amount': '5000', 'phone': written}, FAMILIES, set())
            assert r['candidates'] == ['b'], written

    def test_the_only_family_owing_exactly_that_amount(self):
        assert sm.match_row({'amount': '50000'}, FAMILIES, set())['candidates'] == ['a']

    def test_two_families_owing_the_same_amount_is_ambiguous_not_guessed(self):
        r = sm.match_row({'amount': '75000'}, FAMILIES, set())
        assert r['status'] == 'ambiguous' and set(r['candidates']) == {'b', 'c'}

    def test_a_reference_already_on_a_receipt_is_recorded_not_matched_again(self):
        r = sm.match_row({'amount': '50000', 'reference': 'MP123'}, FAMILIES, {'mp123'})
        assert r['status'] == 'recorded' and r['candidates'] == []

    def test_a_line_with_no_money_or_no_clue_is_unmatched(self):
        assert sm.match_row({'amount': ''}, FAMILIES, set())['status'] == 'unmatched'
        assert sm.match_row({'amount': '-500'}, FAMILIES, set())['status'] == 'unmatched'
        assert sm.match_row({'amount': '123'}, FAMILIES, set())['status'] == 'unmatched'

    def test_amounts_are_read_the_way_banks_write_them(self):
        assert sm.parse_amount('1,250,000.00') == D('1250000.00')
        assert sm.parse_amount('RWF 50000') == D('50000')
        assert sm.parse_amount('abc') is None

    def test_the_same_reference_twice_in_one_file_is_only_taken_once(self):
        rows = [{'amount': '50000', 'reference': 'X1'}, {'amount': '50000', 'reference': 'X1'}]
        out = sm.match_statement(rows, FAMILIES, set())
        assert [r['status'] for r in out] == ['suggested', 'recorded']




@pytest.fixture
def bursar(api_client):
    api_client.force_authenticate(UserFactory(role='bursar'))
    return api_client


def owing(term, amount='80000', code=None):
    student = StudentFactory()
    if code:
        student.student_id = code
        student.save()
    Fee.objects.create(student=student, term=term, category='tuition', amount=D(amount),
                       due_date=timezone.localdate())
    return student


@pytest.mark.django_db
class TestEndpoints:
    def test_matching_reads_the_books_and_writes_nothing(self, bursar, term):
        student = owing(term, code='ZZ900')
        before = FeePayment.objects.count()

        out = bursar.post('/imboni/finance/reconcile/statement/',
                          {'rows': [{'amount': '30000', 'description': 'ZZ900 fees', 'reference': 'R1'},
                                    {'amount': '999', 'description': 'who knows'}]}, format='json').data

        assert [r['status'] for r in out['results']] == ['suggested', 'unmatched']
        assert out['results'][0]['candidates'][0]['name'] == student.full_name
        assert out['counts'] == {'suggested': 1, 'unmatched': 1}
        assert FeePayment.objects.count() == before

    def test_the_payer_phone_on_the_account_is_used(self, bursar, term):
        student = owing(term)
        StudentAccount.objects.create(student=student, payer_phone='0788555666')
        out = bursar.post('/imboni/finance/reconcile/statement/',
                          {'rows': [{'amount': '1000', 'phone': '+250788555666'}]}, format='json').data
        assert out['results'][0]['candidates'][0]['id'] == str(student.id)

    def test_applying_takes_the_money_once_even_if_clicked_twice(self, bursar, term):
        student = owing(term)
        body = {'method': 'momo', 'rows': [{'student': str(student.id), 'amount': '30000', 'reference': 'MP9'}]}

        first = bursar.post('/imboni/finance/reconcile/statement/apply/', body, format='json')
        second = bursar.post('/imboni/finance/reconcile/statement/apply/', body, format='json')

        assert first.status_code == 201 and len(first.data['taken']) == 1
        assert second.data['taken'] == [] and second.data['skipped'][0]['reason'] == 'Already recorded.'
        assert FeePayment.objects.filter(reference='MP9').count() == 1
        assert FeePayment.objects.get(reference='MP9').method == 'momo'

    def test_a_line_without_a_family_is_skipped_and_reported(self, bursar, term):
        out = bursar.post('/imboni/finance/reconcile/statement/apply/',
                          {'rows': [{'amount': '500', 'reference': 'Q'}]}, format='json').data
        assert out['taken'] == [] and out['skipped'][0]['reason'] == 'No family or amount.'

    def test_cash_is_not_a_statement_method(self, bursar):
        assert bursar.post('/imboni/finance/reconcile/statement/apply/',
                           {'method': 'cash', 'rows': [{}]}, format='json').status_code == 400

    def test_empty_and_oversized_files_are_refused(self, bursar):
        assert bursar.post('/imboni/finance/reconcile/statement/', {'rows': []}, format='json').status_code == 400
        assert bursar.post('/imboni/finance/reconcile/statement/', {'rows': [{}] * 2001}, format='json').status_code == 400

    def test_only_the_bursar_can_do_it(self, api_client):
        api_client.force_authenticate(UserFactory(role='teacher'))
        assert api_client.post('/imboni/finance/reconcile/statement/', {'rows': [{}]}, format='json').status_code == 403
