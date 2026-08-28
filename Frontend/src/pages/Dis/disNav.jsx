

export const disNavItems = [
    { to: '/discipline',               icon: 'dashboard',      labelKey: 'nav.dashboard',    end: true },
    { to: '/discipline/students',      icon: 'people',         labelKey: 'nav.students'               },
    { to: '/discipline/student-life',  icon: 'emoji_events',   labelKey: 'nav.studentLife'           },
    { to: '/discipline/boarding',      icon: 'hotel',          labelKey: 'nav.boarding'               },
    /* Dining plans and activity consent requests were routed but listed
       nowhere: two working features with no way into them short of typing the
       URL. Nothing else in the app links to either. */
    { to: '/discipline/dining',        icon: 'restaurant',     labelKey: 'nav.dining'                 },
    { to: '/discipline/activities',    icon: 'sports_soccer',  labelKey: 'nav.activities'             },
    { to: '/discipline/staff',         icon: 'badge',          labelKey: 'nav.staff'                  },
    { to: '/discipline/announcements', icon: 'campaign',       labelKey: 'nav.announcements'          },
    { to: '/discipline/parent-comms',  icon: 'family_restroom', labelKey: 'nav.parentComms'           },
    { to: '/discipline/messages',      icon: 'chat',           labelKey: 'nav.messages'               },
    { to: '/discipline/timetable',     icon: 'calendar_month', labelKey: 'nav.timetable'              },
]

export const disSecondaryItems = [
    { to: '/discipline/settings',      icon: 'settings',       labelKey: 'nav.settings'},
    { to: '/profile?role=discipline',  icon: 'account_circle', labelKey: 'nav.profile' },
    { to: '/login',                    icon: 'logout',         labelKey: 'nav.logout', action: 'logout'  },
]
