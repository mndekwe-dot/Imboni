export const matronNavItems = [
    { to: '/matron',                      icon: 'dashboard',         labelKey: 'nav.dashboard',       end: true },
    { to: '/matron/students',             icon: 'groups',            labelKey: 'nav.myStudents'                },
    { to: '/matron/schedule',             icon: 'schedule',          labelKey: 'nav.dailySchedule'             },
    { to: '/matron/incidents',            icon: 'report',            labelKey: 'nav.reportIncident'            },
    { to: '/matron/health',               icon: 'health_and_safety', labelKey: 'nav.healthWellness'          },
    { to: '/matron/parent-communication', icon: 'family_restroom',   labelKey: 'nav.parentComms'               },
    { to: '/matron/messages',             icon: 'chat',              labelKey: 'nav.messages'                   },
]

export const matronSecondaryItems = [
    { to: '/profile?role=matron', icon: 'account_circle', labelKey: 'nav.profile' },
    { to: '/login',               icon: 'logout',         labelKey: 'nav.logout', action: 'logout'  },
]

