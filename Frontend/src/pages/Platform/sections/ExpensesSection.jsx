import { useState, useEffect, useCallback } from 'react'
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const CATEGORIES = [
    ['hosting', 'Hosting / Infrastructure'], ['payments', 'Payment processing'],
    ['domain', 'Domain / DNS'], ['email', 'Email / Messaging'],
    ['saas', 'SaaS / Tools'], ['other', 'Other'],
]
const RECURRENCE = [['one_time', 'One-time'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']]

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const emptyForm = () => ({ name: '', vendor: '', category: 'hosting', amount: '', currency: 'USD', recurrence: 'monthly', due_date: '' })

function ExpenseChip({ e }) {
    if (e.status === 'paid') return <span className="platform-chip platform-chip-ok">Paid</span>
    if (e.is_overdue) return <span className="platform-chip platform-chip-bad">Overdue</span>
    return <span className="platform-chip platform-chip-warn">Due</span>
}

export function ExpensesSection() {
    const toast = useToast()
    const [items, setItems]     = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding]   = useState(false)
    const [form, setForm]       = useState(emptyForm())
    const [saving, setSaving]   = useState(false)
    const [busyId, setBusyId]   = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try { setItems(await getExpenses()) }
        catch (e) { toast.error(errorMessage(e, 'Could not load expenses.')) }
        finally { setLoading(false) }
    }, [toast])
    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function submit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await createExpense({ ...form, amount: form.amount || '0' })
            toast.success('Bill added.')
            setForm(emptyForm()); setAdding(false)
            load()
        } catch (err) {
            toast.error(errorMessage(err, 'Could not add the bill.'))
        } finally { setSaving(false) }
    }

    async function markPaid(item) {
        setBusyId(item.id)
        try {
            const updated = await updateExpense(item.id, { status: 'paid' })
            setItems(list => list.map(i => (i.id === item.id ? { ...i, ...updated } : i)))
            toast.success(`${item.name} marked paid.`)
        } catch (e) { toast.error(errorMessage(e, 'Could not update the bill.')) }
        finally { setBusyId(null) }
    }

    async function remove(item) {
        setBusyId(item.id)
        try {
            await deleteExpense(item.id)
            setItems(list => list.filter(i => i.id !== item.id))
            toast.success('Bill removed.')
        } catch (e) { toast.error(errorMessage(e, 'Could not remove the bill.')) }
        finally { setBusyId(null) }
    }

    return (
        <div className="platform-panel">
            <div className="platform-panel-head">
                <h2>Services &amp; bills</h2>
                <button className="platform-btn platform-btn-primary" onClick={() => setAdding(a => !a)}>
                    {adding ? 'Cancel' : '+ Add bill'}
                </button>
            </div>

            {adding && (
                <form className="platform-form" onSubmit={submit}>
                    <div className="platform-form-grid">
                        <label>Name<input className="platform-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. AWS hosting" /></label>
                        <label>Vendor<input className="platform-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="e.g. Amazon" /></label>
                        <label>Category
                            <select className="platform-input" value={form.category} onChange={e => set('category', e.target.value)}>
                                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </label>
                        <label>Amount<input className="platform-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                        <label>Currency<input className="platform-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                        <label>Recurrence
                            <select className="platform-input" value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                                {RECURRENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </label>
                        <label>Due date<input className="platform-input" type="date" required value={form.due_date} onChange={e => set('due_date', e.target.value)} /></label>
                    </div>
                    <button className="platform-btn platform-btn-primary" disabled={saving} style={{ marginTop: '0.75rem' }}>
                        {saving ? 'Saving…' : 'Save bill'}
                    </button>
                </form>
            )}

            {loading ? (
                <p className="platform-muted">Loading…</p>
            ) : items.length === 0 ? (
                <p className="platform-muted">No bills tracked yet. Add the services you pay for to see upcoming and overdue amounts.</p>
            ) : (
                <div className="platform-table-wrap">
                    <table className="platform-table">
                        <thead>
                            <tr><th>Service</th><th>Vendor</th><th>Amount</th><th>Recurs</th><th>Due date</th><th>Status</th><th className="platform-col-action">Action</th></tr>
                        </thead>
                        <tbody>
                            {items.map(e => (
                                <tr key={e.id}>
                                    <td className="platform-strong">{e.name}</td>
                                    <td className="platform-muted">{e.vendor || '—'}</td>
                                    <td>{money(e.amount, e.currency)}</td>
                                    <td className="platform-muted" style={{ textTransform: 'capitalize' }}>{e.recurrence.replace('_', ' ')}</td>
                                    <td>{e.due_date}</td>
                                    <td><ExpenseChip e={e} /></td>
                                    <td className="platform-col-action" style={{ whiteSpace: 'nowrap' }}>
                                        {e.status !== 'paid' && (
                                            <button className="platform-btn" disabled={busyId === e.id} onClick={() => markPaid(e)}>Mark paid</button>
                                        )}
                                        <button className="platform-btn platform-btn-danger" disabled={busyId === e.id} onClick={() => remove(e)} style={{ marginLeft: '0.4rem' }}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
