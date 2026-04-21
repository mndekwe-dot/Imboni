export const matronNavItems = [
    { to: '/matron',                      icon: 'dashboard',         label: 'Dashboard',       end: true },
    { to: '/matron/students',             icon: 'groups',            label: 'My Students'                },
    { to: '/matron/schedule',             icon: 'schedule',          label: 'Daily Schedule'             },
    { to: '/matron/incidents',            icon: 'report',            label: 'Report Incident'            },
    { to: '/matron/health',               icon: 'health_and_safety', label: 'Health & Wellness'          },
    { to: '/matron/parent-communication', icon: 'family_restroom',   label: 'Parent Comms'               },
    { to: '/matron/messages',             icon: 'chat',              label: 'Messages'                   },
]

export const matronSecondaryItems = [
    { to: '/profile?role=matron', icon: 'account_circle', label: 'Profile' },
    { to: '/login',               icon: 'logout',         label: 'Logout'  },
]

import { notifications } from '../../data/notifications'

export const matronUser = {
    userName:      'Mrs. Gloriose Hakizimana',
    userRole:      'Matron — Karisimbi House',
    userInitials:  'GH',
    avatarClass:   'matron-av',
    notifications: notifications.matron,
}
