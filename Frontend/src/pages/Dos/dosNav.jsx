export const dosNavItems = [
    { to: '/dos',               icon: 'dashboard',      labelKey: 'nav.dashboard',  end: true },
    { to: '/dos/results',       icon: 'assessment',     labelKey: 'nav.results'               },
    { to: '/dos/teachers',      icon: 'badge',          labelKey: 'nav.teachers'              },
    { to: '/dos/students',      icon: 'people',         labelKey: 'nav.students'              },
    { to: '/dos/attendance',    icon: 'fact_check',     labelKey: 'nav.attendance'            },
    { to: '/dos/scheduling',    icon: 'calendar_month', labelKey: 'nav.scheduling'            },
    { to: '/dos/exam-papers',   icon: 'description',    labelKey: 'nav.examPapers'            },
    { to: '/dos/announcements', icon: 'announcement',   labelKey: 'nav.announcements'         },
    { to: '/dos/messages',      icon: 'chat',           labelKey: 'nav.messages'              },
]

export const dosSecondaryItems = [
    { to: '/dos/settings',     icon: 'settings',       labelKey: 'nav.settings' },
    { to: '/profile?role=dos', icon: 'account_circle', labelKey: 'nav.profile'  },
    { to: '/login',            icon: 'logout',         labelKey: 'nav.logout', action: 'logout'   },
]
