import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/Modal'
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SkeletonList } from '../../../components/ui/Skeleton'

const CATEGORIES = ['hosting', 'payments', 'domain', 'email', 'saas', 'other']
const RECURRENCE = ['one_time', 'monthly', 'quarterly', 'yearly']

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const emptyForm = () => ({ name: '', vendor: '', category: 'hosting', amount: '', currency: 'USD', recurrence: 'monthly', due_date: '' })

function ExpenseChip({ e }) {
    const { t } = useTranslation()
    if (e.status === 'paid') return <span className="platform-chip platform-chip-ok">{t('platform.expenses.chip.paid')}</span>
    if (e.is_overdue) return <span className="platform-chip platform-chip-bad">{t('platform.expenses.chip.overdue')}</span>
    return <span className="platform-chip platform-chip-warn">{t('platform.expenses.chip.due')}</span>
}

export function ExpensesSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [items, setItems]     = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding]   = useState(false)
    const [form, setForm]       = useState(emptyForm())
    const [saving, setSaving]   = useState(false)
    const [busyId, setBusyId]   = useState(null)
    const x = key => t(`platform.expenses.${key}`)

    const load = useCallback(async () => {
        setLoading(true)
        try { setItems(await getExpenses()) }
        catch (e) { toast.error(errorMessage(e, t('platform.expenses.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, t])
    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function submit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await createExpense({ ...form, amount: form.amount || '0' })
            toast.success(x('added'))
            setForm(emptyForm()); setAdding(false)
            load()
        } catch (err) { toast.error(errorMessage(err, x('addFailed'))) }
        finally { setSaving(false) }
    }

    async function markPaid(item) {
        setBusyId(item.id)
        try {
            const updated = await updateExpense(item.id, { status: 'paid' })
            setItems(list => list.map(i => (i.id === item.id ? { ...i, ...updated } : i)))
            toast.success(t('platform.expenses.paid', { name: item.name }))
        } catch (e) { toast.error(errorMessage(e, x('updateFailed'))) }
        finally { setBusyId(null) }
    }

    async function remove(item) {
        setBusyId(item.id)
        try {
            await deleteExpense(item.id)
            setItems(list => list.filter(i => i.id !== item.id))
            toast.success(x('removed'))
        } catch (e) { toast.error(errorMessage(e, x('removeFailed'))) }
        finally { setBusyId(null) }
    }

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>{x('title')}</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>{x('add')}</button>
                </div>

                {adding && (
                    <Modal title={x('addTitle')} icon="receipt_long" size="lg" onClose={() => setAdding(false)} footer={
                        <>
                            <button className="btn btn-outline" onClick={() => setAdding(false)}>{t('platform.common.cancel')}</button>
                            <button type="submit" form="expense-form" className="btn btn-primary" disabled={saving}>{saving ? x('saving') : x('save')}</button>
                        </>
                    }>
                        <form id="expense-form" className="platform-form-grid" onSubmit={submit}>
                            <label>{x('form.name')}<input className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder={x('form.namePlaceholder')} /></label>
                            <label>{x('form.vendor')}<input className="form-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder={x('form.vendorPlaceholder')} /></label>
                            <label>{x('form.category')}
                                <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
                                    {CATEGORIES.map(v => <option key={v} value={v}>{x(`categories.${v}`)}</option>)}
                                </select>
                            </label>
                            <label>{x('form.amount')}<input className="form-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                            <label>{x('form.currency')}<input className="form-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                            <label>{x('form.recurrence')}
                                <select className="form-input" value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                                    {RECURRENCE.map(v => <option key={v} value={v}>{t(`platform.common.interval.${v}`)}</option>)}
                                </select>
                            </label>
                            <label>{x('form.due')}<input className="form-input" type="date" required value={form.due_date} onChange={e => set('due_date', e.target.value)} /></label>
                        </form>
                    </Modal>
                )}

                {loading ? (
                    <SkeletonList items={3} />
                ) : items.length === 0 ? (
                    <p className="platform-muted">{x('empty')}</p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{x('cols.service')}</th><th>{x('cols.vendor')}</th><th>{x('cols.amount')}</th><th>{x('cols.recurs')}</th>
                                    <th>{x('cols.due')}</th><th>{x('cols.status')}</th><th className="platform-col-action">{x('cols.action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(e => (
                                    <tr key={e.id}>
                                        <td className="platform-strong">{e.name}</td>
                                        <td className="platform-muted">{e.vendor || '-'}</td>
                                        <td>{money(e.amount, e.currency)}</td>
                                        <td className="platform-muted pf-capitalize">{t(`platform.common.interval.${e.recurrence}`, { defaultValue: e.recurrence })}</td>
                                        <td>{e.due_date}</td>
                                        <td><ExpenseChip e={e} /></td>
                                        <td className="platform-col-action">
                                            {e.status !== 'paid' && (
                                                <button className="btn btn-outline btn-sm" disabled={busyId === e.id} onClick={() => markPaid(e)}>{x('markPaid')}</button>
                                            )}
                                            <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === e.id} onClick={() => remove(e)}>{x('delete')}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
