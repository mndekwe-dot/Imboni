# Imboni — Privacy Policy

> **Template — review with the school before publishing.** Text in _[square
> brackets]_ must be filled in by the school. This describes how the Imboni
> school-management system handles personal data; the school (not the software)
> is the *data controller* and is responsible for adopting and publishing it.

**Effective date:** _[date]_
**School / data controller:** _[School legal name, address]_
**Data protection contact:** _[name / role, e.g. "The Data Protection Officer"]_, _[email]_, _[phone]_

---

## 1. Who this policy is for

This policy explains how we collect, use, store, and protect personal
information about **pupils, their parents/guardians, and staff** who use the
Imboni system. Because Imboni holds information about **children**, we treat
that data with particular care (see §7).

## 2. What information we collect

| Category | Examples | About whom |
|---|---|---|
| Identity & contact | name, email, phone number, home address, date of birth | pupils, parents, staff |
| Academic records | grades, exam results, attendance, assignments, timetables | pupils |
| Health information | blood group, allergies, medical conditions | pupils |
| Behaviour & welfare | disciplinary incidents, boarding/dormitory details | pupils |
| Financial | school fees and payment status | pupils / parents |
| Account & technical | login credentials (passwords are stored only as secure hashes), role, preferences | all users |

We collect this data when the school enrols a pupil or onboards a member of
staff, and as it is generated during normal school life (marks entered,
attendance taken, etc.).

## 3. Why we use it and our legal basis

We use personal data only to run the school and provide the service, including:
teaching and assessment, attendance and welfare monitoring, communicating with
parents, managing boarding and health needs, and fee administration.

Our lawful bases are the school's **legitimate educational interest** and the
performance of the **enrolment agreement** with parents/guardians; health data
is processed to protect the pupil's **vital interests** and safety. We do **not**
sell personal data or use it for advertising.

## 4. Who can see it

Access is controlled by role. A user only sees the data their role needs:

- **Teachers** see their own classes' academic and attendance data.
- **The Director of Studies** manages timetables, results, and academic records.
- **The Matron** sees health and boarding information.
- **The Director of Discipline** sees behaviour and boarding records.
- **Parents** see only their own children's information.
- **Pupils** see only their own information.
- **Administrators** have the broadest access for running the system.

Every sensitive administrative action (invitations, result changes,
suspensions, fee changes, data erasure) is written to an **audit log** recording
who did what and when.

## 5. How we protect it

- All traffic is encrypted in transit (HTTPS/TLS).
- Passwords are stored only as one-way secure hashes, never in plain text.
- Access is role-restricted and rate-limited; repeated failed logins are throttled.
- Error-monitoring reports are configured to **exclude** personal data — grades,
  medical notes, and authentication tokens are never sent off-site in a bug report.
- The database is backed up on an automated schedule, with backups kept off-box.

## 6. How long we keep it

We keep pupil academic and attendance records for as long as the school is
legally required to retain them, and no longer than necessary. When a person
leaves and there is no retention obligation, their data is erased or
**anonymised** — personal identifiers are removed while any records the school
must keep for statistics or legal reasons are retained in a non-identifying form.

## 7. Children's data

Pupils are children. We minimise the data we hold about them, restrict who can
see it (§4), and rely on the parent/guardian relationship for consent where
consent is the basis for processing. Parents/guardians may exercise the rights
in §8 on their child's behalf.

## 8. Your rights

Subject to applicable law, you may ask us to:

- **access** the personal data we hold about you or your child;
- **correct** data that is inaccurate or incomplete;
- **erase** data (the "right to be forgotten") where there is no overriding
  reason for us to keep it;
- **restrict or object** to certain processing.

To make a request, contact the data protection contact named at the top of this
policy. We will respond within _[e.g. 30 days]_. Erasure requests are actioned
through a controlled, audited process that either anonymises or deletes the
account.

## 9. Third parties we share data with

We share data only with service providers needed to operate the system, under
appropriate safeguards:

- **Email and SMS providers** — to deliver invitations, password resets, and
  notifications to the contact details you provide.
- **Error-monitoring provider** — to receive technical error reports, configured
  to exclude personal data.
- **Hosting/infrastructure provider** — where the application and database run.

We do not share personal data with anyone else except where required by law.

## 10. Changes to this policy

We may update this policy from time to time. Material changes will be
communicated to parents/guardians and staff, and the effective date above will
be updated.

## 11. Contact & complaints

Questions or complaints: _[data protection contact + email/phone]_. You also
have the right to complain to the relevant data protection authority
_[e.g. the National Cyber Security Authority / data protection regulator]_.
