"""
python manage.py erase_user_data <email-or-user-id> [--delete] [--dry-run] [--yes]

Honour a data-erasure ("right to be forgotten") request for one person.

Two modes:
  * anonymise (default) — scrub every piece of personal data from the account
    (name, email, phone, address, date of birth, emergency contact, avatar,
    and, for students, medical fields) and deactivate it, but KEEP the row so
    academic/attendance/financial records stay referentially intact and any
    school-level statistics remain correct. This is the recommended mode for
    pupils, whose grade/attendance history a school is usually required to
    retain even after the person leaves.
  * --delete — hard-delete the account entirely. Everything that cascades from
    the user (via on_delete=CASCADE) goes with it. Use only when there is no
    retention obligation and a full removal is genuinely required.

Always writes an entry to the audit trail (who erased whom, and how) so the
erasure itself is accountable. Run with --dry-run first to see the plan.
"""
import uuid

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.audit.services import audit
from apps.authentication.models import User


class Command(BaseCommand):
    help = 'Anonymise (default) or delete all personal data for one user (GDPR erasure).'

    def add_arguments(self, parser):
        parser.add_argument(
            'identifier',
            help='The user to erase, given as their email address or user id (UUID).',
        )
        parser.add_argument(
            '--delete', action='store_true',
            help='Hard-delete the account entirely instead of anonymising it.',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would happen without changing anything.',
        )
        parser.add_argument(
            '--yes', action='store_true',
            help='Skip the interactive confirmation prompt (for scripted/cron use).',
        )
        parser.add_argument(
            '--actor',
            help='Email of the staff member performing the erasure, recorded in the audit log.',
        )

    def handle(self, *args, **options):
        user = self._resolve_user(options['identifier'])
        hard_delete = options['delete']
        dry_run = options['dry_run']

        label = f'{user.get_full_name() or user.username} <{user.email or "no-email"}> ({user.role})'
        mode = 'DELETE' if hard_delete else 'ANONYMISE'
        self.stdout.write(f'Target: {label}')
        self.stdout.write(f'Mode:   {mode}')

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run: no changes made.'))
            self.stdout.write(self._plan(user, hard_delete))
            return

        if not options['yes']:
            confirm = input(f'\nType the user id to confirm {mode}: ').strip()
            if confirm != str(user.id):
                raise CommandError('Confirmation did not match. Aborted.')

        actor = self._resolve_actor(options.get('actor'))

        with transaction.atomic():
            # Snapshot identifying details for the audit record BEFORE we wipe them.
            detail = {
                'mode': mode.lower(),
                'user_id': str(user.id),
                'role': user.role,
                'erased_email': user.email,
                'erased_name': user.get_full_name(),
            }

            if hard_delete:
                user.delete()
            else:
                self._anonymise(user)

            audit(actor, 'user.erased', target=label, detail=detail)

        self.stdout.write(self.style.SUCCESS(
            f'{"Deleted" if hard_delete else "Anonymised"} personal data for {label}.'
        ))

    # ── helpers ────────────────────────────────────────────────────────────────

    def _resolve_user(self, identifier):
        """Find the user by UUID or (case-insensitive) email."""
        try:
            return User.objects.get(id=uuid.UUID(str(identifier)))
        except (ValueError, User.DoesNotExist):
            pass
        try:
            return User.objects.get(email__iexact=identifier)
        except User.DoesNotExist:
            raise CommandError(f'No user found matching "{identifier}".')
        except User.MultipleObjectsReturned:
            raise CommandError(
                f'Multiple users share the email "{identifier}". Pass the user id instead.'
            )

    def _resolve_actor(self, actor_email):
        if not actor_email:
            return None
        return User.objects.filter(email__iexact=actor_email).first()

    def _plan(self, user, hard_delete):
        if hard_delete:
            return ('  Would hard-delete the user row and every record that cascades '
                    'from it (student/parent profile, submissions, notifications, …).')
        lines = ['  Would clear: name, email, phone, address, date of birth, '
                 'emergency contact, avatar, pending email; deactivate the account.']
        if hasattr(user, 'student_profile'):
            lines.append('  Would clear student medical fields: blood group, allergies, '
                         'medical conditions.')
        return '\n'.join(lines)

    def _anonymise(self, user):
        """Scrub all personal data from the account, keeping the row intact."""
        short = str(user.id)[:8]

        # Avatar file, if any, is removed from storage.
        if user.avatar:
            user.avatar.delete(save=False)

        user.first_name = ''
        user.last_name = ''
        user.username = f'erased_{short}'
        user.email = ''
        user.pending_email = ''
        user.phone_number = ''
        user.address = ''
        user.emergency_contact = ''
        user.date_of_birth = None
        user.avatar = None
        user.is_active = False
        user.email_verified = False
        user.set_unusable_password()
        user.save()

        # Students carry medical data directly on their profile — scrub it too.
        profile = getattr(user, 'student_profile', None)
        if profile is not None:
            profile.blood_group = ''
            profile.allergies = ''
            profile.medical_conditions = ''
            profile.save(update_fields=['blood_group', 'allergies', 'medical_conditions'])
