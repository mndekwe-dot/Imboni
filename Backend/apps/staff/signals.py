from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def keep_register_in_step(sender, instance, raw=False, **kwargs):
    """A new staff account is a new worker; a renamed one is the same worker."""
    if raw:
        return
    from .services import sync_member
    sync_member(instance)
