import { Link } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'

/**
 * Imboni's own data-handling statement.
 *
 * NOT the same document as PRIVACY_POLICY.md in the repository root. That one
 * is a template each SCHOOL adopts and publishes to its own parents, because
 * the school is the data controller. This page describes what Imboni, as the
 * processor running the software, does with the data on the school's behalf.
 *
 * Every claim here maps to something implemented:
 *   schema isolation      django-tenants, one Postgres schema per school
 *   no PII in monitoring  settings.py -> sentry_sdk.init(send_default_pii=False)
 *   password hashing      Django's default hasher
 *   throttling            REST_FRAMEWORK DEFAULT_THROTTLE_RATES
 *   audit log             apps/audit
 *   backups               apps/audit/tasks.backup_database_task (nightly)
 *   erasure               manage.py erase_user_data
 * Do not add a claim here that is not true of the running system.
 */
export function Privacy() {
    return (
        <PublicLayout
            title="Privacy and data protection"
            subtitle="How Imboni handles the information schools trust us with."
        >
            <div className="pub-prose">
                <p className="pub-updated">
                    This page describes Imboni&apos;s practices as the provider of the
                    software. Each school using Imboni is the data controller for its
                    own pupils&apos; records and publishes its own privacy notice to
                    parents. If you are a parent or pupil, ask your school for theirs.
                </p>

                <h2>What the system holds</h2>
                <p>
                    Imboni stores what a school needs to operate: identity and contact
                    details for pupils, parents and staff; academic records including
                    marks, attendance and assignments; health information such as blood
                    group, allergies and medical conditions; behaviour and boarding
                    records; and fee status. Passwords are never stored, only one-way
                    hashes of them.
                </p>

                <h2>Schools are separated at the database level</h2>
                <p>
                    Every school is given its own isolated database schema. Two schools
                    do not share tables and are not separated by a filter in application
                    code that could be got wrong. A query running for one school cannot
                    return another school&apos;s rows, because those rows are not in the
                    tables it is reading.
                </p>

                <h2>Access is decided by role</h2>
                <ul>
                    <li>Teachers see their own classes.</li>
                    <li>The Director of Studies manages timetables, results and academic records.</li>
                    <li>The Matron sees health and boarding information.</li>
                    <li>The Director of Discipline sees behaviour and boarding records.</li>
                    <li>Parents see only their own children.</li>
                    <li>Pupils see only themselves.</li>
                </ul>
                <p>
                    These rules are enforced on the server, not merely hidden in the
                    interface. Sensitive administrative actions are written to an audit
                    log recording who did what and when.
                </p>

                <h2>What we deliberately do not collect</h2>
                <p>
                    Our error monitoring is configured never to capture personal data.
                    Grades, medical notes, disciplinary records, request bodies, email
                    addresses and authentication tokens are excluded from bug reports,
                    so they are not sent off-site when something breaks. This is a
                    deliberate setting, not a default.
                </p>
                <p>
                    We do not sell personal data, and we do not use it for advertising
                    or profiling.
                </p>

                <h2>How it is protected</h2>
                <ul>
                    <li>All traffic is encrypted in transit using TLS.</li>
                    <li>Passwords are stored as one-way hashes and are not recoverable.</li>
                    <li>Two-factor authentication is available on staff accounts.</li>
                    <li>Repeated failed logins are rate limited to frustrate guessing.</li>
                    <li>The database is backed up automatically each night.</li>
                </ul>

                <h2>Children&apos;s data</h2>
                <p>
                    Most of what Imboni holds is about minors, and it includes categories
                    that are sensitive in any jurisdiction: health, and disciplinary
                    history. We treat that as the constraint it is. Where a design choice
                    trades convenience against exposure of a pupil&apos;s record, we take
                    the less convenient option.
                </p>

                <h2>Retention and erasure</h2>
                <p>
                    Schools decide how long to keep records, guided by their own legal
                    obligations. Imboni provides a data erasure process so a school can
                    remove an individual&apos;s personal data when it is no longer
                    required or when a valid request is made.
                </p>

                <h2>Your rights</h2>
                <p>
                    Requests to access, correct, or erase personal data are made to the
                    school holding the record, since the school is the controller. If
                    you are unsure who to contact, or your school cannot help,{' '}
                    <Link to="/contact">contact us</Link> and we will direct the request
                    appropriately.
                </p>

                <h2>Changes</h2>
                <p>
                    If this statement changes materially, schools using Imboni are
                    notified. Continued use after a change indicates acceptance of the
                    revised statement.
                </p>

                <p className="pub-updated">
                    This statement describes technical and organisational practice. It is
                    not legal advice, and it does not replace the privacy notice your
                    school is required to publish to parents.
                </p>
            </div>
        </PublicLayout>
    )
}
