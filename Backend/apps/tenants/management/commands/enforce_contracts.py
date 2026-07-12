"""
Run contract-lifecycle enforcement once (expire past-grace contracts + suspend
uncovered schools). Normally runs daily via Celery beat; this is for manual runs.

    python manage.py enforce_contracts
"""
from django.core.management.base import BaseCommand

from apps.tenants.lifecycle import enforce_contract_lifecycle


class Command(BaseCommand):
    help = 'Expire past-grace contracts and auto-suspend uncovered schools.'

    def handle(self, *args, **options):
        result = enforce_contract_lifecycle()
        self.stdout.write(self.style.SUCCESS(
            f"Contracts expired: {result['expired']}, schools suspended: {result['suspended']}"))
