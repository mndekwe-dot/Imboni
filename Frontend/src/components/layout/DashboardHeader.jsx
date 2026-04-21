import { NotificationDropdown } from '../NotificationDropdown'

export function DashboardHeader({ title, subtitle, userName, userRole, userInitials, avatarClass, notifications }) {
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
        <span className="material-symbols-rounded">menu</span>
      </button>

      <div className="dashboard-header-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="dashboard-header-actions">
        <span className="date-display">{today}</span>

        <NotificationDropdown notifications={notifications ?? []} />

        <div className="header-user">
          <div className="header-user-info">
            <span className="header-user-name">{userName}</span>
            <span className="header-user-role">{userRole}</span>
          </div>
          <div className={`header-user-av ${avatarClass}`}>{userInitials}</div>
        </div>
      </div>
    </header>
  )
}
