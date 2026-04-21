export const parentNavItems = [
    { to: '/parent',               icon: 'dashboard',      label: 'Dashboard',   end: true },
    { to: '/parent/children',      icon: 'family_history', label: 'My Children'            },
    { to: '/parent/results',       icon: 'assessment',     label: 'Results'                },
    { to: '/parent/attendance',    icon: 'fact_check',     label: 'Attendance'             },
    { to: '/parent/behaviour',     icon: 'person',         label: 'Behaviour'              },
    { to: '/parent/announcements', icon: 'announcement',   label: 'Announcements'          },
    { to: '/parent/messages',      icon: 'chat',           label: 'Messages'               },
]

export const parentSecondaryItems = [
    { to: '/profile?role=parent', icon: 'account_circle', label: 'Profile' },
    { to: '/login',               icon: 'logout',         label: 'Logout'  },
]

import { notifications } from '../../data/notifications'

export const parentUser = {
    userName:      'Mrs. Chantal Uwase',
    userRole:      'Parent',
    userInitials:  'CU',
    avatarClass:   'parent-av',
    notifications: notifications.parent,
}
