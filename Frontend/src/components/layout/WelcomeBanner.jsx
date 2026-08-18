import { useTranslation } from 'react-i18next'

/**
 * WelcomeBanner — shared across all portals.
 * Colour comes from --portal-accent set in each portal's CSS file.
 */

/* The banner said "Good morning" at every hour of the day. Boarding staff read
   it at lights-out as often as at assembly. */
function greetingKey(hour) {
    if (hour < 12) return 'welcome.morning'
    if (hour < 18) return 'welcome.afternoon'
    return 'welcome.evening'
}

/* "Director of Studies · Kigali Secondary". The school half is dropped rather
   than left dangling when settings have not loaded or the name is unset. */
export function bannerRole(t, role, school) {
    return school ? t('common.roleAtSchool', { role, school }) : role
}

export function WelcomeBanner({ name, role, badge, children }) {
    const { t } = useTranslation()
    return (
        <div className="welcome-banner">
            <div className="welcome-banner-text">
                <div className="welcome-banner-greeting">
                    {t(greetingKey(new Date().getHours()))} <strong>{name}</strong>
                </div>
                <div className="welcome-banner-role">{role}</div>
                {children && <div className="welcome-banner-extra">{children}</div>}
            </div>
            <div className="welcome-banner-right">
                {badge && <span className="welcome-banner-badge">{badge}</span>}
                <span className="material-symbols-rounded welcome-banner-icon">waving_hand</span>
            </div>
        </div>
    )
}
