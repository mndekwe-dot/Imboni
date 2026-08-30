import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubscriptionStatus, onSubscriptionStatus } from '../../api/subscriptionState'
import '../../styles/utilities.css'

// What each standing looks like. `read_only` is the one this component exists
// for: a school in its grace window can still read and export everything but
// cannot save anything new, and a teacher needs to know that BEFORE typing a
// lesson's worth of marks -- not from a refusal afterwards.
const BANNERS = {
    read_only: { mod: 'danger', icon: 'lock',    key: 'readOnly' },
    past_due:  { mod: 'warn',   icon: 'warning', key: 'pastDue'  },
}

/**
 * The school's billing standing, shown above every portal's content.
 *
 * Driven by the `X-Subscription-Status` response header rather than a request
 * of its own, so it costs nothing and cannot be out of date: the last thing the
 * server said is what it shows, and it clears itself the moment a reactivated
 * school's responses stop carrying the header.
 */
export function SubscriptionBanner() {
    const { t } = useTranslation()
    const [status, setStatus] = useState(getSubscriptionStatus)

    useEffect(() => onSubscriptionStatus(setStatus), [])

    const banner = BANNERS[status]
    if (!banner) return null

    return (
        <div className={`card u-banner u-banner--${banner.mod} u-mb`} role="status">
            <div className="u-row">
                <span className="material-symbols-rounded u-banner-icon" aria-hidden="true">
                    {banner.icon}
                </span>
                <div>
                    <p className="u-strong u-mb-xs">{t(`subscription.${banner.key}.title`)}</p>
                    <p className="u-muted u-sm">{t(`subscription.${banner.key}.body`)}</p>
                </div>
            </div>
        </div>
    )
}
