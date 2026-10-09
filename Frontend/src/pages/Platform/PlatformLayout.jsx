import { useState } from 'react'
import { NavLink, Navigate, useNavigate } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { platformLogout, platformUser, isPlatformAuthed } from '../../api/platform'
import logo from '../../assets/images/imboni-logo.webp'
import { formatDateWithWeekday } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'
import '../../styles/platform.css'
import '../../styles/utilities.css'

// Every page here is readable by every operator, deliberately: a support agent
// answering "when does our licence end?" should not have to escalate to read
// the answer. Roles gate the ACTIONS on these pages, not the pages themselves,
// which is why nothing is filtered out of this list. Buttons that a role cannot
// use are hidden individually with `operatorCan`.
const NAV = [
    { to: '/platform',              icon: 'dashboard',      key: 'overview', end: true },
    { to: '/platform/applications', icon: 'inbox',          key: 'applications' },
    { to: '/platform/schools',      icon: 'apartment',      key: 'schools'  },
    { to: '/platform/contracts',    icon: 'contract',       key: 'contracts' },
    { to: '/platform/revenue',      icon: 'payments',       key: 'revenue'  },
    { to: '/platform/expenses',     icon: 'receipt_long',   key: 'expenses' },
    { to: '/platform/support',      icon: 'support_agent',  key: 'support'  },
    { to: '/platform/activity',     icon: 'history',        key: 'activity' },
    { to: '/platform/health',       icon: 'monitor_heart',  key: 'health'   },
    { to: '/platform/operators',    icon: 'shield_person',  key: 'operators' },
]

const ROLES = ['support', 'commercial', 'operations']

/**
 * PlatformLayout — the operator console shell, styled with the Imboni light
 * theme (same sidebar/header classes as the school portals) but with the
 * platform's own nav, identity and sign-out. Also guards the route: no platform
 * token → bounce to /platform/login.
 */
export function PlatformLayout({ section, title, subtitle, actions, children }) {
    const { t } = useTranslation()
    // A section names its own heading; `title` and `subtitle` still override it.
    title = title ?? (section && t(`platform.layout.titles.${section}`))
    subtitle = subtitle ?? (section && t(`platform.layout.subtitles.${section}`))
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const me = platformUser()
    const authed = isPlatformAuthed()

    const today = formatDateWithWeekday()
    const initials = (me?.name || me?.email || 'OP').slice(0, 2).toUpperCase()

    function signOut() {
        platformLogout()
        navigate('/platform/login', { replace: true })
    }

    // Not signed in as an operator → straight to the platform login (no flash,
    // no section API calls). Hooks above run unconditionally first.
    if (!authed) return <Navigate to="/platform/login" replace />

    return (
        <div className="platform-portal">
            <a href="#main-content" className="skip-link">{t('platform.layout.skip')}</a>
            {mobileOpen && <div className="sidebar-overlay active" aria-hidden="true" onClick={() => setMobileOpen(false)} />}
            <div className="dashboard-layout">
                <aside className={`sidebar${mobileOpen ? ' active' : ''}`}>
                    <header className="sidebar-logo">
                        <div className="logo-wrapper">
                            <div className="sidebar-logo-icon"><img src={logo} alt={t('platform.layout.logoAlt')} /></div>
                            <div className="sidebar-logo-text">
                                <span className="sidebar-brand-name">Imboni</span>
                                <span className="sidebar-brand-tagline">{t('platform.layout.tagline')}</span>
                            </div>
                        </div>
                        <button className="toggle menu-toggle" aria-label={t('platform.layout.closeMenu')} onClick={() => setMobileOpen(false)}>
                            <span className="material-symbols-rounded" aria-hidden="true">close</span>
                        </button>
                    </header>

                    <nav className="sidebar-nav" aria-label={t('platform.layout.navLabel')}>
                        <ul className="nav-list primary-nav">
                            {NAV.map(item => (
                                <li key={item.to}>
                                    <NavLink to={item.to} end={item.end}
                                        className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')}
                                        onClick={() => setMobileOpen(false)}>
                                        <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                                        <span>{t(`platform.layout.nav.${item.key}`)}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                        <ul className="nav-list secondary-nav">
                            <li>
                                <button className="sidebar-nav-item" onClick={signOut}>
                                    <span className="material-symbols-rounded" aria-hidden="true">logout</span>
                                    <span>{t('platform.layout.signOut')}</span>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </aside>

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" aria-label={t('platform.layout.openMenu')} onClick={() => setMobileOpen(true)}>
                            <span className="material-symbols-rounded" aria-hidden="true">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">{today}</span>
                            {actions}
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">{me?.name || t('platform.layout.operator')}</span>
                                    <span className="header-user-role">
                                        {ROLES.includes(me?.role) ? t(`platform.layout.roles.${me.role}`) : (me?.email || t('platform.layout.platform'))}
                                    </span>
                                </div>
                                <span className="header-user-av admin-av" aria-hidden="true">{initials}</span>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>
                        {/* An operations account that has not enrolled holds the
                            title and none of the powers. Say so where it cannot
                            be missed, rather than letting them discover it from
                            a refused suspension. */}
                        {me?.mfa_setup_required && (
                            <div className="card u-banner u-banner--warn u-mb" role="status">
                                <div className="u-row">
                                    <span className="material-symbols-rounded u-banner-icon" aria-hidden="true">lock</span>
                                    <div>
                                        <p className="u-strong u-mb-xs">{t('platform.layout.mfaTitle')}</p>
                                        <p className="u-muted u-sm">
                                            <Trans i18nKey="platform.layout.mfaBody"
                                                components={{ ops: <NavLink to="/platform/operators" /> }} />
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {children}
                    </DashboardContent>
                </main>
            </div>
        </div>
    )
}
