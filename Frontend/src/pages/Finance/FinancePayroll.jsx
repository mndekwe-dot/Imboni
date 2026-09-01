import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '../../components/ui/DataTable'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import { openDocument } from '../../api/documents'
import {
    cancelPayrollRun, createPayrollRun, getCashAccounts, getPayrollRun,
    getPayrollRuns, getSalaries, payrollAction, saveSalary,
} from '../../api/finance'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { FinanceShell, Money, formatAmount } from './FinanceShell'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december']

/**
 * Staff pay: the standing salaries, and the month that is being paid from them.
 *
 * Two halves on purpose. A salary is a fact about a person that persists; a run
 * is what happened in one month. Editing the first must never rewrite a payslip
 * already issued from the second.
 */
export function FinancePayroll() {
    const { t } = useTranslation()
    const toast = useToast()

    const [tab, setTab]         = useState('runs')
    const [runs, setRuns]       = useState([])
    const [salaries, setSalaries] = useState([])
    const [accounts, setAccounts] = useState([])
    const [openRun, setOpenRun] = useState(null)
    const [editing, setEditing] = useState(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([getPayrollRuns(), getSalaries(), getCashAccounts()])
            .then(([r, s, a]) => {
                setRuns(Array.isArray(r) ? r : [])
                setSalaries(Array.isArray(s) ? s : [])
                setAccounts(Array.isArray(a) ? a : [])
            })
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function startRun() {
        try {
            const run = await createPayrollRun({})
            toast.success(t('finance.payroll.opened', { count: run.payslips_made ?? 0 }))
            load()
            setOpenRun(run.id)
        } catch (error) {
            toast.error(errorMessage(error, t('finance.payroll.openFailed')))
        }
    }

    const monthlyCost = salaries
        .filter(s => s.is_active)
        .reduce((sum, s) => sum + Number(s.net_estimate || 0), 0)

    return (
        <FinanceShell title={t('finance.payroll.title')} subtitle={t('finance.payroll.subtitle')}>
            {openRun && (
                <RunModal id={openRun} accounts={accounts}
                    onClose={() => setOpenRun(null)} onChanged={load} />
            )}
            {editing && (
                <SalaryModal row={editing} onClose={() => setEditing(null)} onSaved={load} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="groups" value={loading ? '-' : salaries.filter(s => s.is_active).length}
                    label={t('finance.payroll.onPayroll')} colorClass="info" />
                <StatCard icon="payments" value={loading ? '-' : <Money value={monthlyCost} />}
                    label={t('finance.payroll.monthlyNet')} />
                <StatCard icon="event_repeat" value={loading ? '-' : runs.length}
                    label={t('finance.payroll.runs')} />
            </div>

            <div className="toolbar-card mb-1-5">
                <div className="filter-tabs-bar">
                    {['runs', 'salaries'].map(key => (
                        <button key={key} type="button"
                            className={`tab-btn${tab === key ? ' active' : ''}`}
                            onClick={() => setTab(key)}>
                            {t(`finance.payroll.tab.${key}`)}
                        </button>
                    ))}
                </div>
                <div className="toolbar-spacer" />
                {tab === 'runs' ? (
                    <button className="btn btn-primary btn-sm" onClick={startRun}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('finance.payroll.openThisMonth')}
                    </button>
                ) : (
                    <DocumentActions url="/imboni/finance/salaries/" stem="staff-salaries"
                        pdf={false} disabled={loading} />
                )}
            </div>

            {tab === 'runs' ? (
                <ListSection icon="event_repeat" title={t('finance.payroll.runs')}
                    count={loading ? null : runs.length}>
                    {loading ? <p className="u-muted">{t('common.loading')}</p>
                        : runs.length === 0 ? (
                            <EmptyState icon="payments" title={t('finance.payroll.noRuns')}
                                description={t('finance.payroll.noRunsDesc')} />
                        ) : (
                            <ul className="fin-row-list">
                                {runs.map(run => (
                                    <li key={run.id} className="fin-row">
                                        <button className="fin-row-open"
                                            onClick={() => setOpenRun(run.id)}>
                                            <span className="fin-expense-icon">
                                                <span className="material-symbols-rounded" aria-hidden="true">payments</span>
                                            </span>
                                            <div className="fin-row-main">
                                                <div className="u-strong">{run.period_label}</div>
                                                <div className="text-xs-muted">
                                                    {t('finance.payroll.staffCount', { count: run.staff_count })}
                                                    {run.prepared_by_name ? ` · ${run.prepared_by_name}` : ''}
                                                </div>
                                            </div>
                                        </button>
                                        <div className="fin-row-figures">
                                            <Money value={run.net_total} />
                                            <span className={`pill fin-payroll-${run.status}`}>
                                                {t(`finance.payroll.status.${run.status}`)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                </ListSection>
            ) : (
                <DataTable
                    title={t('finance.payroll.salaries')}
                    icon="badge"
                    count={salaries.length}
                    columns={[
                        { key: 'staff_name', label: t('common.staff') },
                        { key: 'role', label: t('common.role') },
                        { key: 'gross', label: t('finance.payroll.gross'), align: 'right' },
                        { key: 'allowances', label: t('finance.payroll.allowances'), align: 'right' },
                        { key: 'deductions', label: t('finance.payroll.deductions'), align: 'right' },
                        { key: 'net', label: t('finance.payroll.net'), align: 'right' },
                        { key: 'actions', label: '' },
                    ]}
                    rows={salaries.map(s => ({
                        id: s.id,
                        staff_name: s.staff_name,
                        role: t(`roles.${s.role}`, { defaultValue: s.role }),
                        gross: formatAmount(s.gross),
                        allowances: formatAmount(s.allowances),
                        deductions: `${s.pension_percent}% + ${s.tax_percent}%`,
                        net: <Money value={s.net_estimate} />,
                        actions: (
                            <button className="btn-ghost btn-sm" onClick={() => setEditing(s)}>
                                {t('common.edit')}
                            </button>
                        ),
                    }))}
                    emptyTitle={t('finance.payroll.noSalaries')}
                    emptyDescription={t('finance.payroll.noSalariesDesc')}
                />
            )}
        </FinanceShell>
    )
}

/** One month: its payslips, the register to print, and the three steps. */
function RunModal({ id, accounts, onClose, onChanged }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData] = useState(null)
    const [busy, setBusy] = useState(false)
    const [account, setAccount] = useState('')

    const load = useCallback(() => {
        getPayrollRun(id).then(setData).catch(() => setData(null))
    }, [id])
    useEffect(() => { load() }, [load])

    async function act(action) {
        setBusy(true)
        try {
            await payrollAction(id, action, action === 'pay' && account ? { account } : {})
            toast.success(t(`finance.payroll.done.${action}`))
            load()
            onChanged()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.payroll.actionFailed')))
        } finally {
            setBusy(false)
        }
    }

    async function cancel() {
        setBusy(true)
        try {
            await cancelPayrollRun(id)
            toast.success(t('finance.payroll.done.cancel'))
            onChanged()
            onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.payroll.actionFailed')))
        } finally {
            setBusy(false)
        }
    }

    const run = data?.run
    const status = run?.status

    return (
        <Modal open onClose={onClose} title={run?.period_label || t('finance.payroll.title')}
            size="lg">
            {!data ? <p className="u-muted">{t('common.loading')}</p> : (
                <>
                    <div className="fin-balance-row">
                        <div>
                            <span className="fin-balance-label">{t('finance.payroll.gross')}</span>
                            <Money value={data.totals.gross} />
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('finance.payroll.deductions')}</span>
                            <Money value={Number(data.totals.pension) + Number(data.totals.tax)
                                + Number(data.totals.other)} />
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('finance.payroll.net')}</span>
                            <Money value={data.totals.net} />
                        </div>
                    </div>

                    <div className="toolbar-card mb-1-5">
                        <span className={`pill fin-payroll-${status}`}>
                            {t(`finance.payroll.status.${status}`)}
                        </span>
                        <div className="toolbar-spacer" />
                        <DocumentActions url={`/imboni/finance/payroll/${id}/`}
                            stem="payroll-register" />
                    </div>

                    {status === 'draft' && (
                        <div className="toolbar-card mb-1-5">
                            {/* Rebuilding is safe only while it is a draft. Once
                                approved, the payslips are a statement already
                                made and the server refuses. */}
                            <button className="btn btn-outline btn-sm" disabled={busy}
                                onClick={() => act('rebuild')}>
                                {t('finance.payroll.rebuild')}
                            </button>
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary btn-sm" disabled={busy}
                                onClick={() => act('approve')}>
                                {t('finance.payroll.approve')}
                            </button>
                        </div>
                    )}

                    {status === 'approved' && (
                        <div className="toolbar-card mb-1-5">
                            <select className="form-input" value={account}
                                onChange={e => setAccount(e.target.value)}>
                                <option value="">{t('finance.cash.defaultAccount')}</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} ({formatAmount(a.balance)})
                                    </option>
                                ))}
                            </select>
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary btn-sm" disabled={busy}
                                onClick={() => act('pay')}>
                                {t('finance.payroll.pay')}
                            </button>
                        </div>
                    )}

                    <DataTable
                        title={t('finance.payroll.payslips')}
                        icon="receipt"
                        count={data.payslips.length}
                        columns={[
                            { key: 'staff_name', label: t('common.staff') },
                            { key: 'gross', label: t('finance.payroll.gross'), align: 'right' },
                            { key: 'deductions', label: t('finance.payroll.deductions'), align: 'right' },
                            { key: 'net', label: t('finance.payroll.net'), align: 'right' },
                            { key: 'actions', label: '' },
                        ]}
                        rows={data.payslips.map(p => ({
                            id: p.id,
                            staff_name: p.staff_name,
                            gross: formatAmount(p.gross),
                            deductions: formatAmount(p.total_deductions),
                            net: <Money value={p.net} />,
                            actions: (
                                <button className="btn-ghost btn-sm"
                                    onClick={() => openDocument(`/imboni/finance/payslips/${p.id}/document/`)}>
                                    {t('finance.payroll.payslip')}
                                </button>
                            ),
                        }))}
                        emptyTitle={t('finance.payroll.noPayslips')}
                        emptyDescription={t('finance.payroll.noPayslipsDesc')}
                    />

                    {status !== 'paid' && status !== 'cancelled' && (
                        <div className="mt-1-5">
                            <button className="btn-ghost btn-sm" disabled={busy} onClick={cancel}>
                                {t('finance.payroll.cancelRun')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </Modal>
    )
}

/** One person's standing salary. */
function SalaryModal({ row, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({
        gross: row.gross, allowances: row.allowances,
        pension_percent: row.pension_percent, tax_percent: row.tax_percent,
        other_deduction: row.other_deduction, bank_account: row.bank_account || '',
        is_active: row.is_active,
    })
    const [busy, setBusy] = useState(false)

    const set = (key) => (e) => setForm(f => ({
        ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            await saveSalary({ staff: row.staff, ...form })
            toast.success(t('finance.payroll.salarySaved'))
            onSaved()
            onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.payroll.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal open onClose={onClose} title={row.staff_name}>
            <form onSubmit={submit}>
                <div className="fin-form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('finance.payroll.gross')}</span>
                        <input className="form-input" type="number" min="0" step="1"
                            value={form.gross} onChange={set('gross')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.payroll.allowances')}</span>
                        <input className="form-input" type="number" min="0" step="1"
                            value={form.allowances} onChange={set('allowances')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.payroll.pensionPercent')}</span>
                        <input className="form-input" type="number" min="0" max="100" step="0.01"
                            value={form.pension_percent} onChange={set('pension_percent')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.payroll.taxPercent')}</span>
                        <input className="form-input" type="number" min="0" max="100" step="0.01"
                            value={form.tax_percent} onChange={set('tax_percent')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.payroll.otherDeduction')}</span>
                        <input className="form-input" type="number" min="0" step="1"
                            value={form.other_deduction} onChange={set('other_deduction')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.payroll.bankAccount')}</span>
                        <input className="form-input" value={form.bank_account}
                            onChange={set('bank_account')} />
                    </label>
                </div>

                <p className="u-muted u-sm mt-1">{t('finance.payroll.deductionNote')}</p>

                <label className="form-check mt-1">
                    <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
                    <span>{t('finance.payroll.includeInRuns')}</span>
                </label>

                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export { MONTHS }
