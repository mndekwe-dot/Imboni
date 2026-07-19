import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { StatCard } from '../../../components/layout/StatCard'
import { getPayments, createPayment, deletePayment, getPlatformSchools } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const usd = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
            <div className="platform-cards pf-mb">
                <StatCard icon="account_balance" value={usd(total)} label="Total received" colorClass="success" />
                <StatCard icon="trending_up" value={usd(monthTotal)} label="This month" colorClass="success" />
            </div>

            <div className="card">
                <div className="card-content">
                    <div className="platform-panel-head">
                        <h2>Payments received</h2>
                        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Record payment</button>
                    </div>

                    {adding && (
                        <Modal title="Record a payment" icon="payments" size="lg" onClose={() => setAdding(false)} footer={
                            <>
                                <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
                                <button type="submit" form="payment-form" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</button>
                            </>
                        }>
                            <form id="payment-form" className="platform-form-grid" onSubmit={submit}>
                                <label>School
                                    <select className="form-input" value={form.client} onChange={e => set('client', e.target.value)}>
                                        <option value="">Select</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </label>
                                <label>Amount<input className="form-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                                <label>Currency<input className="form-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                                <label>Plan
                                    <select className="form-input" value={form.plan} onChange={e => set('plan', e.target.value)}>
                                        <option value="basic">Basic</option><option value="premium">Premium</option><option value="free">Free</option>
                                    </select>
                                </label>
                                <label>Status
                                    <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                                        <option value="succeeded">Succeeded</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
                                    </select>
                                </label>
                                <label>Date<input className="form-input" type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} /></label>
                            </form>
                        </Modal>
                    )}

                    {loading ? (
                        <p className="platform-muted">Loading…</p>
                    ) : payments.length === 0 ? (
                        <p className="platform-muted">No payments yet. They&apos;ll appear automatically once Stripe is live, or record one manually.</p>
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
                                            <td className="platform-strong">{p.school_name || '-'}</td>
                                            <td className="pf-capitalize">{p.plan || '-'}</td>
                                            <td>{money(p.amount, p.currency)}</td>
                                            <td><span className={`platform-chip platform-chip-${STATUS_CLS[p.status] || 'info'}`}>{p.status}</span></td>
                                            <td className="platform-col-action">
                                                <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === p.id} onClick={() => remove(p)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
