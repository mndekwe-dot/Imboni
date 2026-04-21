export const adminNavItems = [
    { to: '/admin',                 icon: 'dashboard',      label: 'Dashboard',      end: true },
    { to: '/admin/staff',           icon: 'badge',          label: 'Staff'                     },
    { to: '/admin/students',        icon: 'people',         label: 'Students'                  },
    { to: '/admin/finance',         icon: 'payments',       label: 'Finance'                   },
    { to: '/admin/reports',         icon: 'bar_chart',      label: 'Reports'                   },
    { to: '/admin/announcements',   icon: 'announcement',   label: 'Announcements'             },
    { to: '/admin/messages',        icon: 'chat',           label: 'Messages'                  },
    { to: '/admin/settings',        icon: 'settings',       label: 'Settings'                  },
]

export const adminSecondaryItems = [
    { to: '/profile?role=admin', icon: 'account_circle', label: 'Profile' },
    { to: '/login',              icon: 'logout',         label: 'Logout'  },
]

import { notifications } from '../../data/notifications'

export const adminUser = {
    userName:      'Dr. Alphonse Nkurunziza',
    userRole:      'School Principal',
    userInitials:  'AN',
    avatarClass:   'admin-av',
    notifications: notifications.admin,
}
