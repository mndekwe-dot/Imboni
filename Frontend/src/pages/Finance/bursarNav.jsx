export const bursarNavItems = [
    { to: '/finance',            icon: 'dashboard',      labelKey: 'nav.dashboard', end: true },
    { to: '/finance/fees',       icon: 'receipt_long',   labelKey: 'nav.fees'         },
    { to: '/finance/payments',   icon: 'payments',       labelKey: 'nav.payments'     },
    { to: '/finance/income',     icon: 'add_card',       labelKey: 'nav.otherIncome'  },
    { to: '/finance/expenses',   icon: 'shopping_bag',   labelKey: 'nav.expenses'     },
    { to: '/finance/payroll',    icon: 'badge',          labelKey: 'nav.payroll'      },
    { to: '/finance/cash',       icon: 'savings',        labelKey: 'nav.cash'         },
    { to: '/finance/messages',   icon: 'chat',           labelKey: 'nav.messages'     },
]

export const bursarSecondaryItems = [
    { to: '/finance/settings',    icon: 'settings',       labelKey: 'nav.settings' },
    { to: '/profile?role=bursar', icon: 'account_circle', labelKey: 'nav.profile'  },
    { to: '/login',               icon: 'logout',         labelKey: 'nav.logout', action: 'logout' },
]
