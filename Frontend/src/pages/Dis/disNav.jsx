import { notifications } from '../../data/notifications'

export const disUser = {
    userName:      'Mr. Eric Mutabazi',
    userRole:      'Director of Discipline',
    userInitials:  'EM',
    avatarClass:   'discipline-av',
    notifications: notifications.discipline,
}

export const disNavItems = [
    { to: '/discipline',               icon: 'dashboard',      label: 'Dashboard',    end: true },
    { to: '/discipline/students',      icon: 'people',         label: 'Students'               },
    { to: '/discipline/student-life',  icon: 'emoji_events',   label: 'Student Life'           },
    { to: '/discipline/boarding',      icon: 'hotel',          label: 'Boarding'               },
    { to: '/discipline/staff',         icon: 'badge',          label: 'Staff'                  },
    { to: '/discipline/announcements', icon: 'campaign',       label: 'Announcements'          },
    { to: '/discipline/messages',      icon: 'chat',           label: 'Messages'               },
    { to: '/discipline/timetable',     icon: 'calendar_month', label: 'Timetable'              },
]

export const disSecondaryItems = [
    { to: '/profile?role=discipline',  icon: 'account_circle', label: 'Profile' },
    { to: '/login',                    icon: 'logout',         label: 'Logout'  },
]
