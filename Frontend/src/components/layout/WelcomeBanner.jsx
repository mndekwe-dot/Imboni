/**
 * WelcomeBanner — shared across all portals.
 * Colour comes from --portal-accent set in each portal's CSS file.
 */
export function WelcomeBanner({ name, role, badge, children }) {
    return (
        <div className="welcome-banner">
            <div className="welcome-banner-text">
                <div className="welcome-banner-greeting">
                    Good morning, <strong>{name}</strong>
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
