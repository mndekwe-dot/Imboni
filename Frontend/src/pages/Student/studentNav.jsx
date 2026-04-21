export const studentNavItems = [
    { to: '/student',               icon: 'dashboard',      label: 'Dashboard',     end: true },
    { to: '/student/results',       icon: 'assessment',     label: 'My Results'               },
    { to: '/student/attendance',    icon: 'fact_check',     label: 'Attendance'               },
    { to: '/student/timetable',     icon: 'calendar_month', label: 'Timetable'                },
    { to: '/student/assignments',   icon: 'assignment',     label: 'Assignments'              },
    { to: '/student/activities',    icon: 'emoji_events',   label: 'Activities'               },
    { to: '/student/discipline',    icon: 'gavel',          label: 'Discipline'               },
    { to: '/student/announcements', icon: 'announcement',   label: 'Announcements'            },
    { to: '/student/messages',      icon: 'chat',           label: 'Messages'                 },
]

export const studentSecondaryItems = [
    { to: '/profile?role=student', icon: 'account_circle', label: 'Profile' },
    { to: '/login',                icon: 'logout',         label: 'Logout'  },
]

import { notifications } from '../../data/notifications'

export const studentUser = {
    userName:      'Uwase Amina',
    userRole:      'Student · S4A',
    userInitials:  'UA',
    avatarClass:   'student-av',
    notifications: notifications.student,
}
