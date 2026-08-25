import { Link } from 'react-router'
import { NotificationDropdown } from '../NotificationDropdown'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { formatDateWithWeekday } from '../../utils/date'

export function DashboardHeader({ title, subtitle, userName, userRole, userInitials, avatarClass, notifications, onNotificationRead, actions }) {
  // The date helpers return '' for a missing value on purpose, so calling
  // this with no argument rendered an empty pill in every portal header.
  const today = formatDateWithWeekday(new Date())

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

        <LanguageSwitcher compact />

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
