import { Link } from 'react-router'
import { NotificationDropdown } from '../NotificationDropdown'

export function DashboardHeader({ title, subtitle, userName, userRole, userInitials, avatarClass, notifications, onNotificationRead, actions }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="dashboard-header">
      <button
        className="mobile-menu-btn"
        aria-label="Open menu"
        onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}
      >
        <span className="material-symbols-rounded" aria-hidden="true">menu</span>
      </button>

      <div className="dashboard-header-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="dashboard-header-actions">
        <span className="date-display">{today}</span>

        {/* Optional page-specific action buttons (e.g. "+ Add Exam") */}
        {actions}

        <NotificationDropdown notifications={notifications ?? []} onRead={onNotificationRead} />

        <div className="header-user">
          <div className="header-user-info">
            <span className="header-user-name">{userName}</span>
            <span className="header-user-role">{userRole}</span>
          </div>
          <Link to={`/profile?role=${avatarClass?.replace('-av', '') ?? ''}`} className={`header-user-av ${avatarClass}`} aria-label="Your profile">{userInitials}</Link>
        </div>
      </div>
    </header>
  )
}
