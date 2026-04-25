export const teacherNavItems = [
    { to: '/teacher',               icon: 'dashboard',      label: 'Dashboard',     end: true },
    { to: '/teacher/classes',       icon: 'book',           label: 'My Classes'               },
    { to: '/teacher/attendance',    icon: 'fact_check',     label: 'Attendance'               },
    { to: '/teacher/assignments',   icon: 'assignment',     label: 'Assignments'              },
    { to: '/teacher/timetable',     icon: 'calendar_month', label: 'Timetable'                },
    { to: '/teacher/announcements', icon: 'announcement',   label: 'Announcements'            },
    { to: '/teacher/messages',      icon: 'chat',           label: 'Messages'                 },
]

export const teacherSecondaryItems = [
    { to: '/profile?role=teacher', icon: 'account_circle', label: 'Profile' },
    { to: '/login',                icon: 'logout',         label: 'Logout'  },
]

import { notifications } from '../../data/notifications'

export const teacherUser = {
    userName:      'Mr. Pacifique Rurangwa',
    userRole:      'Mathematics Teacher',
    userInitials:  'PR',
    avatarClass:   'teacher-av',
    notifications: notifications.teacher,
}
