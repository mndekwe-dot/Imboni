# Administrator Guide

Running the school on Imboni — people, approvals, reports, and settings. New
here? See [Getting started](README.md) first.

## Your sections

| Section | What it's for |
|---|---|
| **Dashboard** | Whole-school overview. |
| **Staff** | Manage staff accounts and roles. |
| **Students** | Manage the student roll. |
| **Approvals** | Review and approve pending items (e.g. registrations). |
| **Reports** | School reports and exports. |
| **Announcements / Messages** | School-wide communication. |
| **Settings** | School identity and system configuration. |
| **Audit Log** | A record of sensitive actions — who did what, and when. |

## Common tasks

### Inviting people (staff, students, parents)
People join Imboni by **invitation**:
1. Open the invitations area and choose **Send invitation** (one person) or
   **Import CSV** (many at once).
2. For a CSV, fill in the template columns — first name, last name, role, and an
   email **or** phone number per row. Upload it, and Imboni sends each person a
   link to register.
3. Track who has/hasn't registered in the invitations list; **resend** or
   **cancel** as needed.

### Setting up a new school at scale
For a fresh setup (many staff, classes, and a full timetable), use the bulk
tools rather than entering rows by hand. Sample files and the exact order of
steps are in **`Backend/onboarding_samples/`** (staff & students → classes →
subjects → timetable). Class and timetable imports are run by whoever manages
the server.

### Approving registrations
Open **Approvals** to review anything waiting — approve or reject.

### Reports and exports
Open **Reports** for school-level reports and data exports.

### Checking the audit log
Open **Audit Log** to see sensitive actions (invitations, result approvals,
suspensions, fee changes, data erasure, 2FA changes). Useful for accountability
and investigating issues.

### School settings
Open **Settings** for school identity (name, contact) and system configuration.

## Security & data protection (important)
- Encourage **all staff to enable 2FA** (profile → Security).
- Imboni holds sensitive data about children. Access is role-restricted and
  logged; the school should adopt a privacy policy (`PRIVACY_POLICY.md`) and set
  a data-retention approach.
- **Data-erasure requests** ("right to be forgotten") and **backups** are handled
  by whoever runs the server — see `Guides/Backend/DEPLOYMENT_GUIDE.md` (§7.5).

## Tips
- Prefer **CSV import** over one-by-one for anything more than a handful of people.
- Review the **Approvals** queue and **Audit Log** regularly.
