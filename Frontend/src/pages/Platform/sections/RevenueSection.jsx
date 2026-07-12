import { useState, useEffect, useCallback } from 'react'
import { getPayments, createPayment, deletePayment, getPlatformSchools } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({ client: '', amount: '', currency: 'USD', plan: 'basic', status: 'succeeded', received_at: today(), note: '' })

const STATUS_CLS = { succeeded: 'ok', pending: 'warn', failed: 'bad', refunded: 'info' }

export function RevenueSection() {
    const toast = useToast()
    const [payments, setPayments] = useState([])
    const [schools, setSchools]   = useState([])
    const [loading, setLoading]   = useState(true)
    const [adding, setAdding]     = useState(false)
    const [form, setForm]         = useState(emptyForm())
    const [saving, setSaving]     = useState(false)
    const [busyId, setBusyId]     = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [pays, schs] = await Promise.all([getPayments(), getPlatformSchools()])
            setPayments(pays); setSchools(schs)
        } catch (e) { toast.error(errorMessage(e, 'Could not load revenue.')) }
        finally { setLoading(false) }
    }, [toast])
    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const succeeded = payments.filter(p => p.status === 'succeeded')
    const total = succeeded.reduce((s, p) => s + Number(p.amount || 0), 0)
    const monthStart = today().slice(0, 8) + '01'
    const monthTotal = succeeded.filter(p => (p.received_at || '') >= monthStart).reduce((s, p) => s + Number(p.amount || 0), 0)

    async function submit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            const payload = { ...form, amount: form.amount || '0' }
            if (!payload.client) delete payload.client
            await createPayment(payload)
            toast.success('Payment recorded.')
            setForm(emptyForm()); setAdding(false)
            load()
        } catch (err) { toast.error(errorMessage(err, 'Could not record the payment.')) }
        finally { setSaving(false) }
    }

    async function remove(p) {
        setBusyId(p.id)
        try {
            await deletePayment(p.id)
            setPayments(list => list.filter(x => x.id !== p.id))
            toast.success('Payment removed.')
        } catch (e) { toast.error(errorMessage(e, 'Could not remove the payment.')) }
        finally { setBusyId(null) }
    }

    return (
        <>
            <div className="platform-cards">
                <div className="platform-card platform-card-ok">
                    <span className="material-symbols-rounded platform-card-icon">account_balance</span>
                    <div><div className="platform-card-value">{money(total)}</div><div className="platform-card-label">Total received</div></div>
                </div>
                <div className="platform-card">
                    <span className="material-symbols-rounded platform-card-icon">trending_up</span>
                    <div><div className="platform-card-value">{money(monthTotal)}</div><div className="platform-card-label">This month</div></div>
                </div>
            </div>

            <div className="platform-panel">
                <div className="platform-panel-head">
                    <h2>Payments received</h2>
                    <button className="platform-btn platform-btn-primary" onClick={() => setAdding(a => !a)}>
                        {adding ? 'Cancel' : '+ Record payment'}
                    </button>
                </div>

                {adding && (
                    <form className="platform-form" onSubmit={submit}>
                        <div className="platform-form-grid">
                            <label>School
                                <select className="platform-input" value={form.client} onChange={e => set('client', e.target.value)}>
                                    <option value="">— select —</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </label>
                            <label>Amount<input className="platform-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                            <label>Currency<input className="platform-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                            <label>Plan
                                <select className="platform-input" value={form.plan} onChange={e => set('plan', e.target.value)}>
                                    <option value="basic">Basic</option><option value="premium">Premium</option><option value="free">Free</option>
                                </select>
                            </label>
                            <label>Status
                                <select className="platform-input" value={form.status} onChange={e => set('status', e.target.value)}>
                                    <option value="succeeded">Succeeded</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
                                </select>
                            </label>
                            <label>Date<input className="platform-input" type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} /></label>
                        </div>
                        <button className="platform-btn platform-btn-primary" disabled={saving} style={{ marginTop: '0.75rem' }}>
                            {saving ? 'Saving…' : 'Record payment'}
                        </button>
                    </form>
                )}

                {loading ? (
                    <p className="platform-muted">Loading…</p>
                ) : payments.length === 0 ? (
                    <p className="platform-muted">No payments yet. They'll appear automatically once Stripe is live, or record one manually.</p>
                ) : (
                    <div className="platform-table-wrap">
                        <table className="platform-table">
                            <thead>
                                <tr><th>Date</th><th>School</th><th>Plan</th><th>Amount</th><th>Status</th><th className="platform-col-action">Action</th></tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id}>
                                        <td>{(p.received_at || '').slice(0, 10)}</td>
                                        <td className="platform-strong">{p.school_name || '—'}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{p.plan || '—'}</td>
                                        <td>{money(p.amount, p.currency)}</td>
                                        <td><span className={`platform-chip platform-chip-${STATUS_CLS[p.status] || 'info'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span></td>
                                        <td className="platform-col-action">
                                            <button className="platform-btn platform-btn-danger" disabled={busyId === p.id} onClick={() => remove(p)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    )
}
