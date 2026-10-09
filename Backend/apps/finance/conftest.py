"""
Fixtures shared by the finance office test modules (operations, real life).

A module that defines its own `term` still uses its own; pytest prefers the
closer definition.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.authentication.factories import StudentFactory
from apps.finance.models import CashAccount
from apps.results.models import AcademicTerm


@pytest.fixture
def term():
    return AcademicTerm.objects.create(name='Term 2 2026', term='2', year=2026,
                                       order=2, is_current=True,
                                       start_date=timezone.localdate() - timedelta(days=30),
                                       end_date=timezone.localdate() + timedelta(days=30))


@pytest.fixture
def older_term():
    return AcademicTerm.objects.create(name='Term 1 2026', term='1', year=2026,
                                       order=1, is_current=False,
                                       start_date=timezone.localdate() - timedelta(days=200),
                                       end_date=timezone.localdate() - timedelta(days=120))


@pytest.fixture
def account():
    return CashAccount.objects.create(name='Safe', kind='cash', is_default=True,
                                      opening_balance=Decimal('100000'))


@pytest.fixture
def bank():
    return CashAccount.objects.create(name='Bank of Kigali', kind='bank')


@pytest.fixture
def student():
    return StudentFactory(grade='S4', section='A',
                          user__first_name='Amina', user__last_name='Uwase')
