import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import logo from '../../assets/images/imboni-logo.png'

export function Sidebar({ navItems, secondaryItems }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()
  const { t } = useTranslation()

  // Listen for the mobile-menu-btn in DashboardHeader to open us
  useEffect(() => {
    const open = () => setMobileOpen(true)
    document.addEventListener('imboni:open-sidebar', open)
    return () => document.removeEventListener('imboni:open-sidebar', open)
  }, [])

  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'active' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay active"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={sidebarClass}>
        <header className="sidebar-logo">
          <div className="logo-wrapper">
            <div className="sidebar-logo-icon">
              <img src={logo} alt={t('sidebar.logoAlt')} />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-brand-name">Imboni</span>
              <span className="sidebar-brand-tagline">{t('sidebar.tagline')}</span>
            </div>
          </div>

          {/* Desktop: collapse/expand */}
          <button
            className="toggle sidebar-toggle"
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(c => !c)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
          </button>

          {/* Mobile: close sidebar */}
          <button
            className="toggle menu-toggle"
            aria-label={t('sidebar.closeMenu')}
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        <nav className="sidebar-nav" aria-label={t('sidebar.mainNavigation')}>
          <ul className="nav-list primary-nav">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    'sidebar-nav-item' + (isActive ? ' active' : '')
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <ul className="nav-list secondary-nav">
            {secondaryItems.map((item) => (
              <li key={item.to}>
                {item.action === 'logout' ? (
                  <button
                    className="sidebar-nav-item"
                    onClick={() => { setMobileOpen(false); logout() }}
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                    <span>{t(item.labelKey)}</span>
                  </button>
                ) : (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      'sidebar-nav-item' + (isActive ? ' active' : '')
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                )}
              </li>
            ))}
          </ul>

        </nav>
      </aside>
    </>
  )
}
