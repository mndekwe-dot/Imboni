import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
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
    { key: 'free', students: '50', staff: '10', features: 4, to: '/signup' },
    { key: 'basic', students: '500', staff: '50', features: 5, to: '/signup', featured: true, badge: true },
    { key: 'premium', students: null, staff: null, features: 4, to: '/contact' },
]

export function Pricing() {
    const { t } = useTranslation()
    const p = key => t(`publicPages.pricing.${key}`)
    return (
        <PublicLayout title={p('title')} subtitle={p('subtitle')}>
            <div className="pub-plans">
                {PLANS.map(plan => (
                    <div
                        key={plan.key}
                        className={`pub-plan${plan.featured ? ' pub-plan--featured' : ''}`}
                    >
                        {plan.badge && <span className="pub-plan-badge">{p(`${plan.key}.badge`)}</span>}
                        <h2 className="pub-plan-name">{p(`${plan.key}.name`)}</h2>
                        <p className="pub-plan-for">{p(`${plan.key}.for`)}</p>

                        <div className="pub-plan-limits">
                            <div>
                                <span className="pub-plan-limit-value">{plan.students ?? p('unlimited')}</span>
                                <span className="pub-plan-limit-label">{p('students')}</span>
                            </div>
                            <div>
                                <span className="pub-plan-limit-value">{plan.staff ?? p('unlimited')}</span>
                                <span className="pub-plan-limit-label">{p('staff')}</span>
                            </div>
                        </div>

                        <ul className="pub-plan-features">
                            {Array.from({ length: plan.features }, (_, i) => (
                                <li key={i}>
                                    <span className="material-symbols-rounded" aria-hidden="true">
                                        check
                                    </span>
                                    {p(`${plan.key}.f${i + 1}`)}
                                </li>
                            ))}
                        </ul>

                        <Link
                            to={plan.to}
                            className={`pub-plan-cta${plan.featured ? ' pub-plan-cta--solid' : ''}`}
                        >
                            {p(`${plan.key}.cta`)}
                        </Link>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>{p('faqTitle')}</h2>
                {[1, 2, 3, 4].map(n => (
                    <div key={n}>
                        <h3>{p(`q${n}`)}</h3>
                        <p>{p(`a${n}`)}</p>
                    </div>
                ))}
                <h3>{p('q5')}</h3>
                <p><Trans i18nKey="publicPages.pricing.a5" components={{ privacy: <Link to="/privacy" /> }} /></p>
            </div>
        </PublicLayout>
    )
}
