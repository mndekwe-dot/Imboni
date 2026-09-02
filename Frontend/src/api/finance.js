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

// ── Where the money sits ──────────────────────────────────────────────────────
// A receipt says a parent paid; these say where what they handed over now is.
export const getCashAccounts   = (params) => client.get('/imboni/finance/accounts/', { params })
export const createCashAccount = (data)   => client.post('/imboni/finance/accounts/', data)
export const updateCashAccount = (id, d)  => client.patch(`/imboni/finance/accounts/${id}/`, d)
export const getCashPosition   = (params) => client.get('/imboni/finance/cash/', { params })
export const transferCash      = (data)   => client.post('/imboni/finance/cash/transfer/', data)
export const adjustCash        = (data)   => client.post('/imboni/finance/cash/adjust/', data)
export const getReconciliations = (params) =>
    client.get('/imboni/finance/cash/reconciliations/', { params })
export const recordCount       = (data)   =>
    client.post('/imboni/finance/cash/reconciliations/', data)

// ── Income that is not school fees ────────────────────────────────────────────
export const getOtherIncome      = (params) => client.get('/imboni/finance/income/', { params })
export const recordOtherIncome   = (data)   => client.post('/imboni/finance/income/', data)
export const getIncomeCategories = () => client.get('/imboni/finance/income-categories/')
export const createIncomeCategory = (d) => client.post('/imboni/finance/income-categories/', d)

// ── What is owed from earlier terms ───────────────────────────────────────────
export const getArrears     = (params) => client.get('/imboni/finance/arrears/', { params })
export const carryArrears   = (data)   => client.post('/imboni/finance/arrears/', data || {})

// ── Budget ────────────────────────────────────────────────────────────────────
export const getBudgets     = (params) => client.get('/imboni/finance/budgets/', { params })
export const createBudget   = (data)   => client.post('/imboni/finance/budgets/', data)
export const getBudget      = (id)     => client.get(`/imboni/finance/budgets/${id}/`)
export const updateBudget   = (id, d)  => client.patch(`/imboni/finance/budgets/${id}/`, d)
export const deleteBudget   = (id)     => client.delete(`/imboni/finance/budgets/${id}/`)
export const setBudgetLine  = (id, d)  => client.post(`/imboni/finance/budgets/${id}/lines/`, d)

// ── Payroll ───────────────────────────────────────────────────────────────────
export const getSalaries    = (params) => client.get('/imboni/finance/salaries/', { params })
export const saveSalary     = (data)   => client.post('/imboni/finance/salaries/', data)
export const getPayrollRuns = (params) => client.get('/imboni/finance/payroll/', { params })
export const createPayrollRun = (data) => client.post('/imboni/finance/payroll/', data)
export const getPayrollRun  = (id)     => client.get(`/imboni/finance/payroll/${id}/`)
export const cancelPayrollRun = (id)   => client.delete(`/imboni/finance/payroll/${id}/`)
// rebuild | approve | pay — the three steps a run moves through.
export const payrollAction  = (id, action, data) =>
    client.post(`/imboni/finance/payroll/${id}/${action}/`, data || {})
