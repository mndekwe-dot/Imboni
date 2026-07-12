export const adminNavItems = [
    { to: '/admin',                 icon: 'dashboard',      label: 'Dashboard',      end: true },
    { to: '/admin/staff',           icon: 'badge',          label: 'Staff'                     },
    { to: '/admin/students',        icon: 'people',         label: 'Students'                  },
    { to: '/admin/approvals',       icon: 'pending_actions',label: 'Approvals'                 },
    { to: '/admin/reports',         icon: 'bar_chart',      label: 'Reports'                   },
    { to: '/admin/announcements',   icon: 'announcement',   label: 'Announcements'             },
    { to: '/admin/messages',        icon: 'chat',           label: 'Messages'                  },
    { to: '/admin/audit',           icon: 'history',        label: 'Audit Log'                 },
    { to: '/admin/billing',         icon: 'credit_card',    label: 'Billing'                   },
    { to: '/admin/settings',        icon: 'settings',       label: 'Settings'                  },
]

export const adminSecondaryItems = [
    { to: '/profile?role=admin', icon: 'account_circle', label: 'Profile' },
    { to: '/login',              icon: 'logout',         label: 'Logout'  },
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
