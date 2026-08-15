export const parentNavItems = [
    { to: '/parent',               icon: 'dashboard',      labelKey: 'nav.dashboard',   end: true },
    { to: '/parent/children',      icon: 'family_history', labelKey: 'nav.myChildren'            },
    { to: '/parent/results',       icon: 'assessment',     labelKey: 'nav.results'                },
    { to: '/parent/attendance',    icon: 'fact_check',     labelKey: 'nav.attendance'             },
    { to: '/parent/behaviour',     icon: 'person',         labelKey: 'nav.behaviour'              },
    { to: '/parent/announcements', icon: 'announcement',   labelKey: 'nav.announcements'          },
    { to: '/parent/messages',      icon: 'chat',           labelKey: 'nav.messages'               },
]

export const parentSecondaryItems = [
    { to: '/profile?role=parent', icon: 'account_circle', labelKey: 'nav.profile' },
    { to: '/login',               icon: 'logout',         labelKey: 'nav.logout', action: 'logout'  },
]

import { notifications } from '../../data/notifications'

export const parentUser = {
    userName:      'Mrs. Chantal Uwase',
    userRole:      'Parent',
    userInitials:  'CU',
    avatarClass:   'parent-av',
    notifications: notifications.parent,
}
