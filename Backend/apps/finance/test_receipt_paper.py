"""Receipts for a till-roll printer as well as for A4."""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory, UserFactory
from apps.finance import services
from apps.student.models import Fee

pytestmark = pytest.mark.django_db


@pytest.fixture
def payment(api_client):
    api_client.force_authenticate(UserFactory(role='bursar'))
    fee = Fee.objects.create(student=StudentFactory(), category='tuition', amount=Decimal('100000'),
                             due_date=timezone.localdate())
    return services.record_payment(fee, '40000', method='cash')


@pytest.mark.parametrize('paper', ['a4', '80mm', '58mm'])
def test_every_paper_size_renders_a_pdf(api_client, payment, paper):
    response = api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/', {'paper': paper})
    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf' and response.content.startswith(b'%PDF')


def test_the_default_is_still_the_a4_letterhead(api_client, payment):
    plain = api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/')
    a4 = api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/', {'paper': 'a4'})
    assert plain.status_code == 200 and plain['Content-Disposition'] == a4['Content-Disposition']


def test_the_thermal_receipt_is_a_different_and_narrower_document(api_client, payment):
    a4 = api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/')
    roll = api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/', {'paper': '58mm'})
    assert roll.content != a4.content and '58mm' in roll['Content-Disposition']


def test_an_unknown_paper_is_refused_not_guessed(api_client, payment):
    assert api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/', {'paper': 'a3'}).status_code == 400


@pytest.mark.parametrize('paper,mm', [('80mm', 80), ('58mm', 58)])
def test_the_page_really_is_as_wide_as_the_roll(api_client, payment, paper, mm):
    import io

    from pypdf import PdfReader
    response = api_client.get(f'/imboni/finance/payments/{payment.id}/receipt/', {'paper': paper})
    width_pt = float(PdfReader(io.BytesIO(response.content)).pages[0].mediabox.width)
    assert abs(width_pt - mm / 25.4 * 72) < 1.5
