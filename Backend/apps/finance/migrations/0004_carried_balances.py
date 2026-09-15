import uuid
from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


def move_legacy_arrears(apps, schema_editor):
    """
    Repair arrears charges raised before balances were moved.

    Those were copies: the arrears line was raised while the earlier terms'
    charges stayed open, so the same debt was owed twice. For each such line,
    oldest term first (so an arrears line that was itself carried on is
    handled in order), the earlier open balances are closed with a 'carried'
    line and the arrears charge is set to what was carried. Anything already
    paid on the arrears line still counts against it.
    """
    Fee = apps.get_model('student', 'Fee')
    FeePayment = apps.get_model('finance', 'FeePayment')
    today = timezone.localdate()

    def paid(fee):
        total = (FeePayment.objects.filter(fee=fee, reversed_at__isnull=True)
                 .aggregate(t=models.Sum('amount'))['t'])
        return Decimal(str(total or 0))

    def restate(fee):
        settled = paid(fee)
        if settled <= 0:
            fee.status = 'overdue' if fee.due_date < today else 'due'
        elif settled >= fee.amount:
            fee.status = 'cleared'
        else:
            fee.status = 'partial'
        fee.save(update_fields=['status'])

    lines = (Fee.objects.filter(category='arrears', term__isnull=False,
                                notes__startswith='Brought forward')
             .select_related('term').order_by('term__year', 'term__order', 'created_at'))
    for arrears in lines:
        if FeePayment.objects.filter(carried_to=arrears).exists():
            continue
        term = arrears.term
        earlier = (Fee.objects.filter(student_id=arrears.student_id, term__isnull=False)
                   .exclude(pk=arrears.pk).exclude(term_id=term.id).exclude(status='cleared')
                   .filter(term__year__lte=term.year)
                   .exclude(term__year=term.year, term__order__gte=term.order))
        carried = Decimal('0')
        for fee in earlier:
            balance = fee.amount - paid(fee)
            if balance <= 0:
                continue
            FeePayment.objects.create(
                fee=fee, amount=balance, method='carried', carried_to=arrears,
                receipt_no=f'BF-{uuid.uuid4().hex[:10].upper()}', paid_on=today,
                notes=f'Carried forward to {term.name}.')
            restate(fee)
            carried += balance
        if carried > 0:
            arrears.amount = carried
            arrears.save(update_fields=['amount'])
            restate(arrears)


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0003_split_receipts_paye_refunds'),
        ('student', '0006_remove_assignmentsubmission_assignment_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='feepayment',
            name='carried_to',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='carried_in', to='student.fee'),
        ),
        migrations.AlterField(
            model_name='feepayment',
            name='method',
            field=models.CharField(choices=[('cash', 'Cash'), ('momo', 'Mobile money'), ('bank', 'Bank transfer'), ('cheque', 'Cheque'), ('waiver', 'Waiver / bursary'), ('other', 'Other'), ('carried', 'Carried to a later term')], default='cash', max_length=10),
        ),
        migrations.RunPython(move_legacy_arrears, migrations.RunPython.noop),
    ]
