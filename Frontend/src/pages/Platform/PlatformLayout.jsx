import { useState } from 'react'
import { NavLink, Navigate, useNavigate } from 'react-router'
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
    { to: '/platform',              icon: 'dashboard',      label: 'Overview', end: true },
    { to: '/platform/applications', icon: 'inbox',          label: 'Applications' },
    { to: '/platform/schools',      icon: 'apartment',      label: 'Schools'  },
    { to: '/platform/contracts',    icon: 'contract',       label: 'Contracts' },
    { to: '/platform/revenue',      icon: 'payments',       label: 'Revenue'  },
    { to: '/platform/expenses',     icon: 'receipt_long',   label: 'Expenses' },
    { to: '/platform/support',      icon: 'support_agent',  label: 'Support'  },
    { to: '/platform/activity',     icon: 'history',        label: 'Activity' },
    { to: '/platform/health',       icon: 'monitor_heart',  label: 'Health'   },
    { to: '/platform/operators',    icon: 'shield_person',  label: 'Operators' },
]

// How an operator's own standing reads in the header, under their name.
const ROLE_LABELS = {
    support:    'Support',
    commercial: 'Commercial',
    operations: 'Operations',
}

/**
 * PlatformLayout — the operator console shell, styled with the Imboni light
 * theme (same sidebar/header classes as the school portals) but with the
 * platform's own nav, identity and sign-out. Also guards the route: no platform
 * token → bounce to /platform/login.
 */
export function PlatformLayout({ title, subtitle, actions, children }) {
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
            <a href="#main-content" className="skip-link">Skip to content</a>
            {mobileOpen && <div className="sidebar-overlay active" aria-hidden="true" onClick={() => setMobileOpen(false)} />}
            <div className="dashboard-layout">
                <aside className={`sidebar${mobileOpen ? ' active' : ''}`}>
                    <header className="sidebar-logo">
                        <div className="logo-wrapper">
                            <div className="sidebar-logo-icon"><img src={logo} alt="Imboni Logo" /></div>
                            <div className="sidebar-logo-text">
                                <span className="sidebar-brand-name">Imboni</span>
                                <span className="sidebar-brand-tagline">Operator Console</span>
                            </div>
                        </div>
                        <button className="toggle menu-toggle" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
                            <span className="material-symbols-rounded" aria-hidden="true">close</span>
                        </button>
                    </header>

                    <nav className="sidebar-nav" aria-label="Platform navigation">
                        <ul className="nav-list primary-nav">
                            {NAV.map(item => (
                                <li key={item.to}>
                                    <NavLink to={item.to} end={item.end}
                                        className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')}
                                        onClick={() => setMobileOpen(false)}>
                                        <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                        <ul className="nav-list secondary-nav">
                            <li>
                                <button className="sidebar-nav-item" onClick={signOut}>
                                    <span className="material-symbols-rounded" aria-hidden="true">logout</span>
                                    <span>Sign out</span>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </aside>

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
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
                                    <span className="header-user-name">{me?.name || 'Operator'}</span>
                                    <span className="header-user-role">
                                        {ROLE_LABELS[me?.role] || me?.email || 'Platform'}
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
                                        <p className="u-strong u-mb-xs">Two-factor is not set up yet</p>
                                        <p className="u-muted u-sm">
                                            Your account holds the Operations role, so provisioning,
                                            restricting and suspending schools stay closed until you
                                            enrol. Set it up under <NavLink to="/platform/operators">Operators</NavLink>.
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
