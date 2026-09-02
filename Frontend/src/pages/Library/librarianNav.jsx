export const librarianNavItems = [
    { to: '/library',              icon: 'dashboard',     labelKey: 'nav.dashboard', end: true },
    { to: '/library/catalogue',    icon: 'menu_book',     labelKey: 'nav.catalogue'    },
    { to: '/library/circulation',  icon: 'swap_horiz',    labelKey: 'nav.circulation'  },
    { to: '/library/members',      icon: 'people',        labelKey: 'nav.borrowers'    },
    { to: '/library/reservations', icon: 'bookmark',      labelKey: 'nav.reservations' },
    { to: '/library/overdue',      icon: 'event_busy',    labelKey: 'nav.overdue'      },
    { to: '/library/acquisitions', icon: 'shopping_cart', labelKey: 'nav.acquisitions' },
    { to: '/library/stocktake',    icon: 'inventory',     labelKey: 'nav.stocktake'    },
    { to: '/library/reports',      icon: 'monitoring',    labelKey: 'nav.reports'      },
    { to: '/library/messages',     icon: 'chat',          labelKey: 'nav.messages'     },
]

export const librarianSecondaryItems = [
    { to: '/library/settings',       icon: 'settings',       labelKey: 'nav.settings' },
    { to: '/profile?role=librarian', icon: 'account_circle', labelKey: 'nav.profile'  },
    { to: '/login',                  icon: 'logout',         labelKey: 'nav.logout', action: 'logout' },
]
