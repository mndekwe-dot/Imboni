export const dosNavItems = [
    { to: '/dos',               icon: 'dashboard',      label: 'Dashboard',  end: true },
    { to: '/dos/results',       icon: 'assessment',     label: 'Results'               },
    { to: '/dos/teachers',      icon: 'badge',          label: 'Teachers'              },
    { to: '/dos/students',      icon: 'people',         label: 'Students'              },
    { to: '/dos/attendance',    icon: 'fact_check',     label: 'Attendance'            },
    { to: '/dos/scheduling',    icon: 'calendar_month', label: 'Scheduling'            },
    { to: '/dos/announcements', icon: 'announcement',   label: 'Announcements'         },
    { to: '/dos/messages',      icon: 'chat',           label: 'Messages'              },
]

export const dosSecondaryItems = [
    { to: '/profile?role=dos', icon: 'account_circle', label: 'Profile' },
    { to: '/login',            icon: 'logout',         label: 'Logout'  },
]

import { notifications } from '../../data/notifications'

export const dosUser = {
    userName:      'Dr. Jean-Claude Ndagijimana',
    userRole:      'Director of Studies',
    userInitials:  'JN',
    avatarClass:   'dos-av',
    notifications: notifications.dos,
}
