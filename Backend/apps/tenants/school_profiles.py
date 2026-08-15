"""
Demo school identities for `manage.py seed_demo_schools`.

This module is DATA ONLY — the generator in
`management/commands/seed_demo_schools.py` holds all the logic. Splitting them
means you can add or re-tune a school here without reading a line of the
seeding code.

Each profile is a whole institution: how big it is, which years it teaches,
whether it boards students, what it emphasises academically. The point is that
six tenants should read as six genuinely different schools when you click
between their subdomains — not one seed run six times.

The seeder is deterministic (it derives its RNG from the schema name), so the
same profile always produces the same roster. Editing a profile changes that
school and no other.
"""

# ── Name pools ────────────────────────────────────────────────────────────────
# Rwandan given names and family names, so a demo roster reads plausibly rather
# than as Faker output. Split by gender because dormitory assignment, boarding
# records and single-sex schools all depend on it.

FEMALE_NAMES = [
    'Aline', 'Ange', 'Belyse', 'Chantal', 'Claudine', 'Cynthia', 'Diane',
    'Divine', 'Esperance', 'Gisele', 'Grace', 'Immaculee', 'Ineza', 'Josiane',
    'Keza', 'Liliane', 'Marie', 'Mediatrice', 'Mutesi', 'Nadia', 'Odette',
    'Peace', 'Sandrine', 'Solange', 'Teta', 'Umutoniwase', 'Vestine', 'Yvonne',
    'Alice', 'Beatrice', 'Clarisse', 'Denise', 'Epiphanie', 'Francine',
    'Honorine', 'Jeanne', 'Lydia', 'Mercy', 'Nadine', 'Pascasie',
]

MALE_NAMES = [
    'Aime', 'Alphonse', 'Bosco', 'Claude', 'Damascene', 'Elie', 'Emmanuel',
    'Eric', 'Fabrice', 'Fidele', 'Gustave', 'Innocent', 'Janvier', 'Jean',
    'Kevin', 'Moise', 'Olivier', 'Pacifique', 'Patrick', 'Placide', 'Robert',
    'Samuel', 'Shema', 'Theophile', 'Thierry', 'Valens', 'Vincent', 'Yves',
    'Amani', 'Bernard', 'Cedric', 'Didier', 'Ferdinand', 'Gilbert', 'Herve',
    'Isaac', 'Jonas', 'Landry', 'Maurice', 'Norbert',
]

SURNAMES = [
    'Bimenyimana', 'Bizimana', 'Gatete', 'Habimana', 'Habineza', 'Hakizimana',
    'Hategekimana', 'Ingabire', 'Iradukunda', 'Iyakaremye', 'Karangwa',
    'Kwizera', 'Mugisha', 'Mukamana', 'Mukandayisenga', 'Munyaneza',
    'Mutabazi', 'Ndagijimana', 'Ndayisenga', 'Ndayishimiye', 'Niyonzima',
    'Nkurunziza', 'Nsabimana', 'Nsengimana', 'Nshimiyimana', 'Ntakirutimana',
    'Nyirabeza', 'Rukundo', 'Rurangwa', 'Rwigema', 'Sebasoni', 'Shyaka',
    'Tuyishime', 'Twagirayezu', 'Uwase', 'Uwera', 'Uwimana', 'Uwineza',
    'Uwizeyimana', 'Umutoni',
]

# ── Subject catalogue ─────────────────────────────────────────────────────────
# (code, name, category, exam_weight, timetable_weight)
#
# The two weights feed the DOS auto-generators: exam_weight decides placement
# priority in the exam scheduler, timetable_weight does the same for the class
# timetable. Core academic subjects carry more weight than electives, which is
# what makes a generated schedule look like a real one.
SUBJECT_CATALOGUE = {
    'MTH': ('Mathematics',      'Sciences',        9, 9),
    'PHY': ('Physics',          'Sciences',        8, 7),
    'CHE': ('Chemistry',        'Sciences',        8, 7),
    'BIO': ('Biology',          'Sciences',        8, 7),
    'ICT': ('Computer Science', 'Sciences',        6, 6),
    'ENG': ('English',          'Languages',       9, 9),
    'FRE': ('French',           'Languages',       6, 5),
    'KIN': ('Kinyarwanda',      'Languages',       6, 5),
    'SWA': ('Kiswahili',        'Languages',       5, 4),
    'HIS': ('History',          'Humanities',      7, 6),
    'GEO': ('Geography',        'Humanities',      7, 6),
    'CRE': ('Religious Studies', 'Humanities',     4, 4),
    'ENT': ('Entrepreneurship', 'Humanities',      6, 5),
    'ECO': ('Economics',        'Social Sciences', 7, 6),
    'GS':  ('General Studies',  'Social Sciences', 3, 4),
    'ART': ('Art & Design',     'Arts',            4, 4),
    'MUS': ('Music',            'Arts',            3, 3),
    'AGR': ('Agriculture',      'Sciences',        5, 5),
    'PE':  ('Physical Education', 'Arts',          2, 3),
}

# Taught everywhere — the national core.
CORE_SUBJECTS = ['MTH', 'ENG', 'KIN', 'BIO', 'CHE', 'PHY', 'HIS', 'GEO', 'GS']

# ── School profiles ───────────────────────────────────────────────────────────
# `schema` must match an existing tenant schema (see the Domain table).
#
# Field notes:
#   years            Which forms the school teaches, as the school's own year
#                    codes. 'S1'-'S3' is O-Level, 'S4'-'S6' is A-Level. These
#                    are what land in Student.grade and Class.grade verbatim —
#                    there is no separate numeric form.
#   streams          Per-year class letters, keyed by year code. Any label of up
#                    to 10 characters works; these schools use A/B/C because
#                    that is what Rwandan secondary schools use.
#   class_size       Students generated per class. This is what makes one
#                    school feel large and another intimate.
#   gender           'mixed' | 'girls' | 'boys'. Drives name selection,
#                    dormitories and the single-sex schools' rosters.
#   boarding         Fraction of students who board (0.0 = pure day school).
#   dormitories      (name, gender) pairs. Empty for day schools.
#   extra_subjects   Added on top of CORE_SUBJECTS; the academic character.
#   plan/status      Written back to the public-schema Client row, so the
#                    platform admin screens show a realistic spread of
#                    subscription states.

SCHOOL_PROFILES = [
    {
        'schema': 'school1',
        'name': 'Green Hills Academy',
        'short': 'GHA',
        'domain': 'greenhills.rw',
        'motto': 'Knowledge, Integrity, Service',
        'years': ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
        'streams': {'S1': ['A', 'B', 'C'], 'S2': ['A', 'B', 'C'], 'S3': ['A', 'B', 'C'],
                    'S4': ['A', 'B'], 'S5': ['A', 'B'], 'S6': ['A', 'B']},
        'class_size': 16,
        'gender': 'mixed',
        'boarding': 0.7,
        'dormitories': [('Bisoke', 'boys'), ('Karisimbi', 'boys'),
                        ('Muhabura', 'girls'), ('Sabyinyo', 'girls')],
        'extra_subjects': ['ICT', 'FRE', 'ECO', 'ENT', 'ART'],
        'teachers': 14,
        'plan': 'premium',
        'status': 'active',
    },
    {
        'schema': 'school2',
        'name': 'Lycee de Kigali',
        'short': 'LDK',
        'domain': 'lyceedekigali.rw',
        'motto': 'Discipline and Excellence',
        'years': ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
        'streams': {'S1': ['A', 'B'], 'S2': ['A', 'B'], 'S3': ['A', 'B'],
                    'S4': ['A', 'B'], 'S5': ['A'], 'S6': ['A']},
        'class_size': 20,
        'gender': 'mixed',
        'boarding': 0.45,
        'dormitories': [('Kivu', 'boys'), ('Kagera', 'girls')],
        'extra_subjects': ['FRE', 'SWA', 'ECO', 'ICT'],
        'teachers': 12,
        'plan': 'premium',
        'status': 'active',
    },
    {
        'schema': 'sunrise',
        'name': 'Sunrise Preparatory School',
        'short': 'SPS',
        'domain': 'sunriseprep.rw',
        'motto': 'Every Morning a New Start',
        'years': ['S1', 'S2', 'S3'],
        'streams': {'S1': ['A', 'B'], 'S2': ['A', 'B'], 'S3': ['A']},
        'class_size': 11,
        'gender': 'mixed',
        'boarding': 0.0,          # pure day school — no dorms, no night checks
        'dormitories': [],
        'extra_subjects': ['ICT', 'ART', 'MUS', 'PE'],
        'teachers': 7,
        'plan': 'basic',
        'status': 'trial',
    },
    {
        'schema': 'greenvalley',
        'name': 'Green Valley Girls School',
        'short': 'GVG',
        'domain': 'greenvalleygirls.rw',
        'motto': 'Educate a Girl, Change a Nation',
        'years': ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
        'streams': {'S1': ['A', 'B'], 'S2': ['A', 'B'], 'S3': ['A', 'B'],
                    'S4': ['A'], 'S5': ['A'], 'S6': ['A']},
        'class_size': 14,
        'gender': 'girls',
        'boarding': 0.95,         # near-total boarding, as most girls' schools are
        'dormitories': [('Amahoro', 'girls'), ('Urumuri', 'girls'),
                        ('Ubumwe', 'girls')],
        'extra_subjects': ['ICT', 'ENT', 'ECO', 'FRE'],
        'teachers': 11,
        'plan': 'premium',
        'status': 'active',
    },
    {
        'schema': 'asyncschool',
        'name': 'Saint Joseph Secondary School',
        'short': 'SJS',
        'domain': 'stjoseph.rw',
        'motto': 'Faith, Work, Perseverance',
        'years': ['S1', 'S2', 'S3', 'S4'],
        'streams': {'S1': ['A', 'B', 'C'], 'S2': ['A', 'B'], 'S3': ['A', 'B'],
                    'S4': ['A']},
        'class_size': 18,
        'gender': 'boys',
        'boarding': 0.8,
        'dormitories': [('Saint Andre', 'boys'), ('Saint Pierre', 'boys')],
        'extra_subjects': ['CRE', 'AGR', 'ENT', 'SWA'],
        'teachers': 10,
        'plan': 'basic',
        'status': 'past_due',     # exercises the overdue-payment banner
    },
    {
        'schema': 'clitest',
        'name': 'Nyamata Technical High School',
        'short': 'NTH',
        'domain': 'nyamatatech.rw',
        'motto': 'Skills for Tomorrow',
        'years': ['S4', 'S5', 'S6'],   # upper-secondary technical school only
        'streams': {'S4': ['A', 'B'], 'S5': ['A', 'B'], 'S6': ['A']},
        'class_size': 13,
        'gender': 'mixed',
        'boarding': 0.6,
        'dormitories': [('Rugende', 'boys'), ('Nyabarongo', 'girls')],
        'extra_subjects': ['ICT', 'ENT', 'ECO', 'AGR', 'PE'],
        'teachers': 9,
        'plan': 'basic',
        'status': 'trial',
    },
]


def profile_for(schema):
    """Return the profile dict for a schema name, or None if it has no profile."""
    for profile in SCHOOL_PROFILES:
        if profile['schema'] == schema:
            return profile
    return None
