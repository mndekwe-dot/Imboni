import client from './client'

/**
 * The finance API.
 *
 * Pro-only on the server: a school off the plan gets 402, not 403 -- the
 * request is not forbidden, it is unpaid for. `getFinanceAvailability` is
 * deliberately ungated, because it is what the app asks before deciding
 * whether to show the portal, and it must be able to answer "no".
 */
export const getFinanceAvailability = () => client.get('/imboni/finance/availability/')

export const getFinanceDashboard = (params) => client.get('/imboni/finance/dashboard/', { params })
export const getFinanceReport    = (params) => client.get('/imboni/finance/report/', { params })
export const getFinanceSettings  = ()   => client.get('/imboni/finance/settings/')
export const saveFinanceSettings = (d)  => client.put('/imboni/finance/settings/', d)

// ── Charges and the money against them ────────────────────────────────────────
export const getFees      = (params) => client.get('/imboni/finance/fees/', { params })
export const createFee    = (data)   => client.post('/imboni/finance/fees/', data)
export const getPayments  = (params) => client.get('/imboni/finance/payments/', { params })
export const recordPayment = (data)  => client.post('/imboni/finance/payments/record/', data)
export const reversePayment = (id, reason) =>
    client.post(`/imboni/finance/payments/${id}/reverse/`, { reason })

// ── Students ──────────────────────────────────────────────────────────────────
export const getDebtors        = (params) => client.get('/imboni/finance/debtors/', { params })
export const getStudentFinance = (id, params) =>
    client.get(`/imboni/finance/students/${id}/`, { params })
export const saveStudentAccount = (id, data) =>
    client.put(`/imboni/finance/students/${id}/`, data)

// ── Fee structure and invoicing ───────────────────────────────────────────────
export const getFeeStructures  = (params) => client.get('/imboni/finance/structures/', { params })
export const createFeeStructure = (data)  => client.post('/imboni/finance/structures/', data)
export const deleteFeeStructure = (id)    => client.delete(`/imboni/finance/structures/${id}/`)
export const invoiceStructure   = (id)    =>
    client.post(`/imboni/finance/structures/${id}/invoice/`, {})

// ── Expenses ──────────────────────────────────────────────────────────────────
export const getExpenses       = (params) => client.get('/imboni/finance/expenses/', { params })
export const createExpense     = (data)   => client.post('/imboni/finance/expenses/', data)
export const decideExpense     = (id, decision, note) =>
    client.post(`/imboni/finance/expenses/${id}/decision/`, { decision, note })
export const getExpenseCategories = () => client.get('/imboni/finance/expense-categories/')
export const createExpenseCategory = (d) => client.post('/imboni/finance/expense-categories/', d)
