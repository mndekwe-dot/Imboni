export const teacherNavItems = [
    { to: '/teacher',               icon: 'dashboard',      labelKey: 'nav.dashboard',     end: true },
    { to: '/teacher/classes',       icon: 'book',           labelKey: 'nav.myClasses'               },
    { to: '/teacher/students',      icon: 'people',         labelKey: 'nav.students'                 },
    { to: '/teacher/attendance',    icon: 'fact_check',     labelKey: 'nav.attendance'               },
    { to: '/teacher/results',       icon: 'school',         labelKey: 'nav.results'                  },
    { to: '/teacher/assignments',   icon: 'assignment',     labelKey: 'nav.assignments'              },
    { to: '/teacher/exams',         icon: 'description',    labelKey: 'nav.examPapers'               },
    { to: '/teacher/timetable',     icon: 'calendar_month', labelKey: 'nav.timetable'                },
    { to: '/teacher/announcements', icon: 'announcement',   labelKey: 'nav.announcements'            },
    { to: '/teacher/messages',      icon: 'chat',           labelKey: 'nav.messages'                 },
]

export const teacherSecondaryItems = [
    { to: '/profile?role=teacher', icon: 'account_circle', labelKey: 'nav.profile' },
    { to: '/login',                icon: 'logout',         labelKey: 'nav.logout', action: 'logout'  },
]
