export const bursarNavItems = [
    { to: '/finance',            icon: 'dashboard',      labelKey: 'nav.dashboard', end: true },
    { to: '/finance/fees',       icon: 'receipt_long',   labelKey: 'nav.charges'      },
    { to: '/finance/payments',   icon: 'payments',       labelKey: 'nav.payments'     },
    { to: '/finance/debtors',    icon: 'account_balance_wallet', labelKey: 'nav.debtors' },
    { to: '/finance/structure',  icon: 'price_change',   labelKey: 'nav.feeStructure' },
    { to: '/finance/income',     icon: 'add_card',       labelKey: 'nav.otherIncome'  },
    { to: '/finance/expenses',   icon: 'shopping_bag',   labelKey: 'nav.expenses'     },
    { to: '/finance/budget',     icon: 'request_quote',  labelKey: 'nav.budget'       },
    { to: '/finance/payroll',    icon: 'badge',          labelKey: 'nav.payroll'      },
    { to: '/finance/cash',       icon: 'savings',        labelKey: 'nav.cash'         },
    { to: '/finance/reports',    icon: 'monitoring',     labelKey: 'nav.reports'      },
    { to: '/finance/messages',   icon: 'chat',           labelKey: 'nav.messages'     },
]

export const bursarSecondaryItems = [
    { to: '/finance/settings',    icon: 'settings',       labelKey: 'nav.settings' },
    { to: '/profile?role=bursar', icon: 'account_circle', labelKey: 'nav.profile'  },
    { to: '/login',               icon: 'logout',         labelKey: 'nav.logout', action: 'logout' },
]
