from django.apps import AppConfig


class StaffConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.staff'

    def ready(self):
        from . import signals  # noqa: F401  -- keeps accounts and the register in step
