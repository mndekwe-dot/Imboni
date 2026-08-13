import { Link } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'

/**
 * Public pricing page.
 *
 * The student and staff caps below are the real ones enforced by the backend
 * (apps/tenants/plans.py PLAN_LIMITS). If those change, change them here too --
 * a plan page that disagrees with the limit that actually blocks an invitation
 * is worse than no plan page.
 *
 * Deliberately no currency amounts: billing runs through Stripe price IDs
 * supplied per environment, so there is no figure in the codebase to quote.
 * Fill these in once the commercial decision is made.
 */

const PLANS = [
    {
        key: 'free',
        name: 'Free',
        for: 'Small schools starting out, or anyone who wants to try the whole system with real data.',
        students: '50',
        staff: '10',
        features: [
            'All seven portals',
            'Results, attendance and conduct',
            'Timetable and exam generators',
            'Parent accounts, unlimited',
        ],
        cta: 'Start free',
        to: '/signup',
    },
    {
        key: 'basic',
        name: 'Basic',
        for: 'Established secondary schools running a full O-Level or A-Level roster.',
        students: '500',
        staff: '50',
        featured: true,
        badge: 'Most schools',
        features: [
            'Everything in Free',
            'Boarding, dining and duty rosters',
            'Bulk import of classes and timetables',
            'Automated backups',
            'Email and SMS invitations',
        ],
        cta: 'Sign up your school',
        to: '/signup',
    },
    {
        key: 'premium',
        name: 'Premium',
        for: 'Large schools and groups running several campuses or streams.',
        students: 'Unlimited',
        staff: 'Unlimited',
        features: [
            'Everything in Basic',
            'Unlimited students and staff',
            'Priority support',
            'Onboarding assistance',
        ],
        cta: 'Talk to us',
        to: '/contact',
    },
]

export function Pricing() {
    return (
        <PublicLayout
            title="Plans that fit your school"
            subtitle="Start free and move up when your roster grows. Parent accounts are free on every plan and never count towards your limit."
        >
            <div className="pub-plans">
                {PLANS.map(plan => (
                    <div
                        key={plan.key}
                        className={`pub-plan${plan.featured ? ' pub-plan--featured' : ''}`}
                    >
                        {plan.badge && <span className="pub-plan-badge">{plan.badge}</span>}
                        <h2 className="pub-plan-name">{plan.name}</h2>
                        <p className="pub-plan-for">{plan.for}</p>

                        <div className="pub-plan-limits">
                            <div>
                                <span className="pub-plan-limit-value">{plan.students}</span>
                                <span className="pub-plan-limit-label">students</span>
                            </div>
                            <div>
                                <span className="pub-plan-limit-value">{plan.staff}</span>
                                <span className="pub-plan-limit-label">staff</span>
                            </div>
                        </div>

                        <ul className="pub-plan-features">
                            {plan.features.map(feature => (
                                <li key={feature}>
                                    <span className="material-symbols-rounded" aria-hidden="true">
                                        check
                                    </span>
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Link
                            to={plan.to}
                            className={`pub-plan-cta${plan.featured ? ' pub-plan-cta--solid' : ''}`}
                        >
                            {plan.cta}
                        </Link>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>Common questions</h2>

                <h3>Do parents pay?</h3>
                <p>
                    No. Parent accounts are free on every plan and are not counted
                    towards your staff or student limit. Only students and staff
                    consume places.
                </p>

                <h3>What counts as a staff place?</h3>
                <p>
                    Teachers, the Director of Studies, the matron, discipline staff
                    and administrators. Parents and students are counted separately.
                </p>

                <h3>What happens if we outgrow a plan?</h3>
                <p>
                    Nothing is deleted. You are prevented from adding new students or
                    staff beyond the limit until you move up a plan, and everything
                    already in the system keeps working.
                </p>

                <h3>Can we try it with our real data first?</h3>
                <p>
                    Yes. The Free plan is the full system, not a demo. Import a couple
                    of classes, run a term of marks through it, and decide afterwards.
                </p>

                <h3>Where is our data stored?</h3>
                <p>
                    Each school has its own isolated database schema, never a shared
                    table. See our <Link to="/privacy">privacy policy</Link> for how
                    student records are handled.
                </p>
            </div>
        </PublicLayout>
    )
}
