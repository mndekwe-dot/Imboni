import { Link } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'

/**
 * Terms of service.
 *
 * Written to describe how the service actually behaves (plan limits that block
 * rather than delete, suspension that still allows login and payment, schema
 * isolation, nightly backups) rather than as boilerplate. Anything asserted
 * here should be true of the running system.
 *
 * This is not a lawyer-drafted contract. It needs review before a school signs
 * anything against it -- flagged in the closing note rather than hidden.
 */
export function Terms() {
    return (
        <PublicLayout
            title="Terms of service"
            subtitle="The agreement between Imboni and the schools that use it."
        >
            <div className="pub-prose">
                <p className="pub-updated">
                    Plain-language summary: use it for running your school, keep your
                    accounts secure, pay for the plan you are on. Your data stays yours,
                    you can take it with you, and we do not sell it.
                </p>

                <h2>1. Who this is between</h2>
                <p>
                    This agreement is between Imboni Education and the school that
                    creates an account. The person signing up confirms they are
                    authorised to enter into it on the school&apos;s behalf.
                </p>

                <h2>2. Accounts</h2>
                <p>
                    Your school is responsible for its own accounts: who is invited,
                    what role they are given, and removing access when someone leaves.
                    Credentials must not be shared. Two-factor authentication is
                    available and we recommend enabling it for administrator accounts.
                </p>

                <h2>3. Acceptable use</h2>
                <p>You agree not to:</p>
                <ul>
                    <li>use the service for anything unlawful, or to harm or harass anyone;</li>
                    <li>attempt to access another school&apos;s data, or probe, scan or test the security of the system without written permission;</li>
                    <li>upload malware, or content you have no right to upload;</li>
                    <li>resell or sublicense access without agreement.</li>
                </ul>

                <h2>4. Your data belongs to you</h2>
                <p>
                    All pupil, parent and staff records your school enters remain the
                    school&apos;s property. Your school is the data controller; we
                    process that data on your instructions in order to provide the
                    service. We do not sell it, and we do not use it for advertising.
                    See our <Link to="/privacy">privacy statement</Link>.
                </p>

                <h2>5. Plans and limits</h2>
                <p>
                    Each plan carries a limit on students and staff, published on
                    the <Link to="/pricing">pricing page</Link>. Reaching a limit
                    prevents adding new students or staff; it never deletes anything or
                    restricts access to records already in the system. Parent accounts
                    are free and are not counted.
                </p>

                <h2>6. Payment and non-payment</h2>
                <p>
                    Paid plans are billed in advance for the agreed period. If an account
                    falls overdue we will flag it in the interface before taking any
                    other step. If it remains unpaid past the grace period the account is
                    suspended, which means staff can still sign in and settle the balance
                    but the rest of the system is unavailable. Suspension does not delete
                    data.
                </p>

                <h2>7. Availability</h2>
                <p>
                    We aim for continuous availability but do not guarantee uninterrupted
                    service. Maintenance is scheduled outside school hours where
                    possible. The service is provided as-is, without warranty that it
                    will be free of errors.
                </p>

                <h2>8. Backups</h2>
                <p>
                    The database is backed up automatically each night. Backups are a
                    safeguard against our own failures, not a substitute for your
                    records management: keep your own exports of anything you are legally
                    required to retain.
                </p>

                <h2>9. Ending the agreement</h2>
                <p>
                    A school may stop using Imboni at any time. On request within a
                    reasonable period after leaving, we will provide an export of your
                    school&apos;s data and then delete it. We may suspend or end an
                    account that breaches these terms, and will say why.
                </p>

                <h2>10. Liability</h2>
                <p>
                    To the extent permitted by law, our liability is limited to the fees
                    paid for the service in the twelve months before the claim. We are
                    not liable for indirect or consequential loss. Nothing here limits
                    liability that cannot lawfully be limited.
                </p>

                <h2>11. Changes to these terms</h2>
                <p>
                    We may update these terms. Material changes are notified to schools
                    in advance. Continuing to use the service after a change means
                    accepting the revised terms.
                </p>

                <h2>12. Governing law</h2>
                <p>
                    This agreement is governed by the laws of the Republic of Rwanda.
                </p>

                <h2>13. Contact</h2>
                <p>
                    Questions about these terms: <Link to="/contact">contact us</Link>.
                </p>

                <p className="pub-updated">
                    These terms are written in plain language to be understood rather
                    than to be impressive. They are not a substitute for legal advice,
                    and should be reviewed by a lawyer before being relied on in a
                    commercial agreement.
                </p>
            </div>
        </PublicLayout>
    )
}
