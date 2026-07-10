import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import logo from '../../assets/images/imboni-logo.png'

export function Sidebar({ navItems, secondaryItems }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()

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
              <img src={logo} alt="Imboni Logo" />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-brand-name">Imboni</span>
              <span className="sidebar-brand-tagline">Education Connects</span>
            </div>
          </div>

          {/* Desktop: collapse/expand */}
          <button
            className="toggle sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(c => !c)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
          </button>

          {/* Mobile: close sidebar */}
          <button
            className="toggle menu-toggle"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        <nav className="sidebar-nav" aria-label="Main navigation">
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
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <ul className="nav-list secondary-nav">
            {secondaryItems.map((item) => (
              <li key={item.to}>
                {item.label === 'Logout' ? (
                  <button
                    className="sidebar-nav-item"
                    onClick={() => { setMobileOpen(false); logout() }}
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
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
                    <span>{item.label}</span>
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
