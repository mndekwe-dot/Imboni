import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { platformLogout, platformUser, isPlatformAuthed } from '../../api/platform'
import logo from '../../assets/images/imboni-logo.png'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'
import '../../styles/platform.css'

const NAV = [
    { to: '/platform',              icon: 'dashboard',      label: 'Overview', end: true },
    { to: '/platform/applications', icon: 'inbox',          label: 'Applications' },
    { to: '/platform/schools',      icon: 'apartment',      label: 'Schools'  },
    { to: '/platform/revenue',      icon: 'payments',       label: 'Revenue'  },
    { to: '/platform/expenses',     icon: 'receipt_long',   label: 'Expenses' },
    { to: '/platform/support',      icon: 'support_agent',  label: 'Support'  },
]

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

    useEffect(() => { if (!isPlatformAuthed()) navigate('/platform/login', { replace: true }) }, [navigate])

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const initials = (me?.name || me?.email || 'OP').slice(0, 2).toUpperCase()

    function signOut() {
        platformLogout()
        navigate('/platform/login', { replace: true })
    }

    return (
        <div className="platform-portal">
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
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </header>

                    <nav className="sidebar-nav" aria-label="Platform navigation">
                        <ul className="nav-list primary-nav">
                            {NAV.map(item => (
                                <li key={item.to}>
                                    <NavLink to={item.to} end={item.end}
                                        className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')}
                                        onClick={() => setMobileOpen(false)}>
                                        <span className="material-symbols-rounded">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                        <ul className="nav-list secondary-nav">
                            <li>
                                <button className="sidebar-nav-item" onClick={signOut}>
                                    <span className="material-symbols-rounded">logout</span>
                                    <span>Sign out</span>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </aside>

                <main className="dashboard-main">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                            <span className="material-symbols-rounded">menu</span>
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
                                    <span className="header-user-role">{me?.email || 'Platform'}</span>
                                </div>
                                <span className="header-user-av admin-av" aria-hidden="true">{initials}</span>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>{children}</DashboardContent>
                </main>
            </div>
        </div>
    )
}
