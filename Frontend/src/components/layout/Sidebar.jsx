import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import logo from '../../assets/images/imboni-logo.png'

/* Every page mounts its own <Sidebar> — 64 of them — so component state alone
   meant collapsing it and then clicking any nav item sprang it back open. The
   choice is a preference, so it lives outside the component tree. */
const COLLAPSED_KEY = 'imboni:sidebar-collapsed'

function readCollapsed() {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

export function Sidebar({ navItems, secondaryItems }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()
  const { t } = useTranslation()

  // Remember the choice. localStorage throws in some privacy modes, and a
  // sidebar that will not remember its width is not worth failing a render over.
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

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

  /* One row of the nav. The label is always rendered — collapsed it becomes the
     hover tooltip rather than being removed, so the rail is never a set of
     unlabelled icons and screen readers keep a real accessible name. */
  const row = (item) => (
    <>
      <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
      <span className="sidebar-nav-label">{t(item.labelKey)}</span>
    </>
  )

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

          {/* Mobile: close sidebar */}
          <button
            className="toggle menu-toggle"
            aria-label={t('sidebar.closeMenu')}
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        {/* Desktop collapse/expand. A sibling of the header, not a child of it:
            inside it, the button sat on top of the brand tagline. On the panel
            edge it can never collide with anything. */}
        <button
          className="sidebar-toggle"
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(c => !c)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
        </button>

        <nav className="sidebar-nav" aria-label={t('sidebar.mainNavigation')}>
          {/* No heading on the first group: the main nav is self-evidently the
              main nav, and the eyebrow was just a line of noise at the top. */}
          <ul className="nav-list primary-nav" aria-label={t('sidebar.mainNavigation')}>
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
                  {row(item)}
                </NavLink>
              </li>
            ))}
          </ul>

          <p className="sidebar-nav-group" id="sidebar-group-account">{t('sidebar.groupAccount')}</p>
          <ul className="nav-list secondary-nav" aria-labelledby="sidebar-group-account">
            {secondaryItems.map((item) => (
              <li key={item.to}>
                {item.action === 'logout' ? (
                  <button
                    className="sidebar-nav-item"
                    onClick={() => { setMobileOpen(false); logout() }}
                  >
                    {row(item)}
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
                    {row(item)}
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
