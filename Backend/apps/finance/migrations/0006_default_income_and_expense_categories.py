from django.db import migrations

INCOME = [
    ('Capitation grant', 'Government grant per pupil.'),
    ('Donations and sponsors', 'Gifts, NGOs and sponsors, where not paid against a pupil.'),
    ('Canteen and shop', 'Sales at the school canteen or shop.'),
    ('Uniform sales', 'Uniforms and sports kit sold to families.'),
    ('Hall and bus hire', 'Letting school facilities and vehicles.'),
    ('Library fines', 'Late and lost books, taken at the library desk.'),
    ('Bank interest', 'Interest paid on school accounts.'),
    ('Other income', ''),
]

EXPENSES = [
    ('Salaries', 'Staff pay, tax and pension remittances.'),
    ('Food and boarding', 'Meals, kitchen supplies and dormitory needs.'),
    ('Utilities', 'Water, electricity, internet.'),
    ('Maintenance and repairs', ''),
    ('Teaching materials', 'Books, stationery, lab supplies.'),
    ('Examinations', 'Exam papers, registration and marking.'),
    ('Transport and fuel', ''),
    ('Medical and first aid', ''),
    ('Furniture and equipment', 'Desks, computers and other things the school keeps.'),
    ('ICT and software', 'Subscriptions and licences.'),
    ('Bank charges', ''),
    ('Other expenses', ''),
]


def seed(apps, schema_editor):
    """
    Give a school a starting list of where money comes from and goes.

    Only into an empty list: a school that already named its own categories
    keeps exactly those, rather than finding twelve more beside them.
    """
    for model, rows in (('IncomeCategory', INCOME), ('ExpenseCategory', EXPENSES)):
        Model = apps.get_model('finance', model)
        if Model.objects.exists():
            continue
        for name, description in rows:
            Model.objects.create(name=name, description=description)


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_flexible_fee_setup'),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
