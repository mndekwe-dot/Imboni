"""
Every operator that already existed was, in effect, an operations operator:
before roles, one permission class let anybody signed in provision a tenant and
suspend a school. Leaving them on the new `support` default would strip that at
deploy time and lock the vendor out of its own control plane.

So existing accounts are moved to `operations`, keeping exactly what they had.
The new gate still bites: operations requires a second factor, and none of them
have enrolled yet, so they can sign in and read from the first request but must
set up MFA before they can suspend anything again. That is the intended
migration path — not a demotion, and not a free pass either.

`support` remains the default for accounts created from here on.
"""
from django.db import migrations


def grandfather_operators(apps, schema_editor):
    PlatformUser = apps.get_model('tenants', 'PlatformUser')
    PlatformUser.objects.update(role='operations')


def back_to_default(apps, schema_editor):
    PlatformUser = apps.get_model('tenants', 'PlatformUser')
    PlatformUser.objects.update(role='support')


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0007_client_demo_expires_on_client_is_demo_and_more'),
    ]

    operations = [
        migrations.RunPython(grandfather_operators, back_to_default),
    ]
