# Onboarding a new school — sample CSVs

Setting up a pilot school at scale, without hand-entering hundreds of rows.
Do these in order — each step depends on the one before it.

Fill in the sample CSVs in this folder (or export from a spreadsheet as
**CSV UTF-8**) and run the matching step. Every step has a `--dry-run` that
previews the result and changes nothing — always dry-run first.

## Order of operations

### 1. Staff & students → `people.csv`
Invites everyone in one upload (staff get an account immediately on accepting;
students/parents register via their invite link). Uses the existing bulk-invite
endpoint — upload `people.csv` from the **Admin/DOS → Invitations → Import CSV**
screen.

Columns: `first_name, last_name, role, email, phone_number, class_id`
(each row needs an email **or** a phone number; `class_id` is optional and only
used for students — but the class must already exist, so if you want students
placed on invite, do step 2 first).

### 2. Classes → `classes.csv`
```bash
python manage.py import_classes onboarding_samples/classes.csv --dry-run
python manage.py import_classes onboarding_samples/classes.csv
```
Matched on `(grade, section)`, so re-running a corrected file updates in place
instead of duplicating. `class_teacher_email` (optional) must be an existing user.

### 3. Subjects
Subjects are referenced by **code** in the timetable. Create them first via the
DOS portal (or your subject seed) so `MATH101`, `ENG101`, … exist before step 4.

### 4. Timetable → `timetable.csv`
```bash
python manage.py import_timetable onboarding_samples/timetable.csv --dry-run
python manage.py import_timetable onboarding_samples/timetable.csv
```
Needs a **current** `AcademicTerm` (or pass `--term-id`). A slot is matched on
`(class, day, start_time, term)`; a teacher double-booked for another class at
the same time is reported and skipped, never silently clashed.

## Notes
- All imports are safe to re-run (upsert on natural keys).
- Times are 24-hour `HH:MM`. Days are `monday`..`friday`.
- Bulk actions (class/timetable imports) are recorded in the audit log.
- These sample files use example data — replace with the real school's before go-live.
