export const adminNavItems = [
    { to: '/admin',                 icon: 'dashboard',      labelKey: 'nav.dashboard',      end: true },
    { to: '/admin/staff',           icon: 'badge',          labelKey: 'nav.staff'                     },
    { to: '/admin/students',        icon: 'people',         labelKey: 'nav.students'                  },
    { to: '/admin/approvals',       icon: 'pending_actions',labelKey: 'nav.approvals'                 },
    { to: '/admin/reports',         icon: 'bar_chart',      labelKey: 'nav.reports'                   },
    { to: '/admin/announcements',   icon: 'announcement',   labelKey: 'nav.announcements'             },
    { to: '/admin/messages',        icon: 'chat',           labelKey: 'nav.messages'                  },
    { to: '/admin/audit',           icon: 'history',        labelKey: 'nav.auditLog'                 },
    { to: '/admin/billing',         icon: 'credit_card',    labelKey: 'nav.billing'                   },
    { to: '/admin/support',         icon: 'support_agent',  labelKey: 'nav.support'                   },
    { to: '/admin/settings',        icon: 'settings',       labelKey: 'nav.settings'                  },
]

export const adminSecondaryItems = [
    { to: '/profile?role=admin', icon: 'account_circle', labelKey: 'nav.profile' },
    { to: '/login',              icon: 'logout',         labelKey: 'nav.logout', action: 'logout'  },
]

import { notifications } from '../../data/notifications'

function _buildAdminUser() {
    try {
        const u      = JSON.parse(localStorage.getItem('imboni_user') || '{}')
        const first  = u.first_name || ''
        const last   = u.last_name  || ''
        const full   = `${first} ${last}`.trim() || 'Admin'
        const inits  = [first[0], last[0]].filter(Boolean).join('').toUpperCase() || 'A'
        return { userName: full, userRole: 'School Principal', userInitials: inits, avatarClass: 'admin-av', notifications: notifications.admin }
    } catch {
        return { userName: 'Admin', userRole: 'School Principal', userInitials: 'A', avatarClass: 'admin-av', notifications: [] }
    }
}

export const adminUser = _buildAdminUser()
