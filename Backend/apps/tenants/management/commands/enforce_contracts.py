"""
Run contract-lifecycle enforcement once: restrict schools inside their grace
window, expire past-grace contracts and suspend the schools they covered, and
stop expired demo tenants. Normally runs daily via Celery beat; this is for
manual runs.

    python manage.py enforce_contracts
"""
from django.core.management.base import BaseCommand

from apps.tenants.lifecycle import enforce_contract_lifecycle


class Command(BaseCommand):
    help = 'Restrict, expire and suspend along the contract lifecycle.'

    def handle(self, *args, **options):
        result = enforce_contract_lifecycle()
        self.stdout.write(self.style.SUCCESS(
            f"Schools restricted: {result['restricted']}, "
            f"contracts expired: {result['expired']}, "
            f"schools suspended: {result['suspended']}, "
            f"demos expired: {result['demos_expired']}"))
