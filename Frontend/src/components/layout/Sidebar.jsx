import { NavLink } from 'react-router'
import logo from '../../assets/images/imboni-logo.png'

// navItems and secondaryItems are passed as props so this sidebar
// can be reused for Student, Teacher, Parent, etc. with different links.
export function Sidebar({ navItems, secondaryItems }) {
  return (
    <aside className="sidebar">
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

        {/* These buttons are handled by dashboard.js logic —
            you can wire them up later with React state */}
        <button className="toggle sidebar-toggle" aria-label="Toggle sidebar">
          <span className="material-symbols-rounded">chevron_left</span>
        </button>
        <button className="toggle menu-toggle" aria-label="Open menu">
          <span className="material-symbols-rounded">menu</span>
        </button>
      </header>

      <nav className="sidebar-nav">
        {/* Primary nav links */}
        <ul className="nav-list primary-nav">
          {navItems.map((item) => (
            <li key={item.to}>
              {/* NavLink automatically adds the "active" class when the
                  current URL matches — replaces manually adding class="active" */}
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  'sidebar-nav-item' + (isActive ? ' active' : '')
                }
              >
                <span className="material-symbols-rounded">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Secondary nav (Profile, Logout) */}
        <ul className="nav-list secondary-nav">
          {secondaryItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  'sidebar-nav-item' + (isActive ? ' active' : '')
                }
              >
                <span className="material-symbols-rounded">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
