"""
Tests for the `erase_user_data` management command (GDPR erasure).
"""
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.audit.models import AuditEntry
from apps.authentication.models import User
from apps.authentication.factories import UserFactory, StudentFactory


@pytest.mark.django_db
class TestEraseUserData:
    def _make_user(self):
        return UserFactory(
            role='teacher',
            first_name='Grace',
            last_name='Ingabire',
            email='grace@imboni.test',
            phone_number='+250788000111',
            address='KG 11 Ave, Kigali',
            emergency_contact='+250788999000',
            date_of_birth='1990-05-01',
        )

    def test_anonymise_clears_pii_and_keeps_row(self):
        user = self._make_user()
        call_command('erase_user_data', 'grace@imboni.test', '--yes')

        user.refresh_from_db()
        assert User.objects.filter(id=user.id).exists()      # row kept
        assert user.first_name == ''
        assert user.last_name == ''
        assert user.email == ''
        assert user.phone_number == ''
        assert user.address == ''
        assert user.emergency_contact == ''
        assert user.date_of_birth is None
        assert user.pending_email == ''
        assert user.is_active is False
        assert user.email_verified is False
        assert not user.has_usable_password()
        assert user.username.startswith('erased_')

    def test_anonymise_clears_student_medical_fields(self):
        student = StudentFactory(
            blood_group='O+',
            allergies='Penicillin',
            medical_conditions='Asthma',
        )
        call_command('erase_user_data', str(student.user.id), '--yes')

        student.refresh_from_db()
        assert student.blood_group == ''
        assert student.allergies == ''
        assert student.medical_conditions == ''
        # Non-personal academic identifiers are retained for record integrity.
        assert student.student_id
        assert student.grade == '4'

    def test_delete_removes_the_row(self):
        user = self._make_user()
        uid = user.id
        call_command('erase_user_data', 'grace@imboni.test', '--delete', '--yes')
        assert not User.objects.filter(id=uid).exists()

    def test_writes_an_audit_entry(self):
        user = self._make_user()
        call_command('erase_user_data', 'grace@imboni.test', '--yes')

        entry = AuditEntry.objects.filter(action='user.erased').first()
        assert entry is not None
        assert entry.detail['mode'] == 'anonymise'
        assert entry.detail['user_id'] == str(user.id)
        # The audit snapshot preserves who was erased even though the row is now scrubbed.
        assert entry.detail['erased_email'] == 'grace@imboni.test'

    def test_dry_run_changes_nothing(self):
        user = self._make_user()
        call_command('erase_user_data', 'grace@imboni.test', '--dry-run')

        user.refresh_from_db()
        assert user.first_name == 'Grace'          # untouched
        assert user.is_active is True
        assert not AuditEntry.objects.filter(action='user.erased').exists()

    def test_resolves_by_email_case_insensitively(self):
        self._make_user()
        call_command('erase_user_data', 'GRACE@IMBONI.TEST', '--yes')
        assert not User.objects.filter(email='grace@imboni.test').exists()

    def test_unknown_identifier_raises(self):
        with pytest.raises(CommandError):
            call_command('erase_user_data', 'nobody@nowhere.test', '--yes')

    def test_records_actor_when_given(self):
        self._make_user()
        admin = UserFactory(role='admin', email='dpo@imboni.test')
        call_command('erase_user_data', 'grace@imboni.test', '--yes', '--actor', 'dpo@imboni.test')

        entry = AuditEntry.objects.filter(action='user.erased').first()
        assert entry.actor_id == admin.id
