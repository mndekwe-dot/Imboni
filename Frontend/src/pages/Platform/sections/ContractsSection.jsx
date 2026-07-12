import { useState, useEffect, useCallback } from 'react'
import {
    getContracts, createContract, signContract, terminateContract, renewContract, deleteContract,
    getPlatformSchools,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)
const plusYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10) }
const emptyForm = () => ({ client: '', title: '', plan: 'basic', amount: '', currency: 'USD', billing_interval: 'yearly', start_date: today(), end_date: plusYear(), grace_days: 14 })
const INTERVALS = [['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly'], ['one_time', 'One-time']]

function ContractChip({ c }) {
    if (c.status === 'active' && c.is_expired) return <span className="platform-chip platform-chip-bad">Expired (grace)</span>
    if (c.status === 'active' && c.is_expiring_soon) return <span className="platform-chip platform-chip-warn">Expiring soon</span>
    const map = { draft: 'info', active: 'ok', expired: 'bad', terminated: 'info' }
    return <span className={`platform-chip platform-chip-${map[c.status] || 'info'}`}>{c.status}</span>
}

function remainingLabel(c) {
    if (c.status !== 'active') return '—'
    const d = c.days_remaining
    if (d === 0) return 'Ends today'
    if (d > 0) return `${d} day${d === 1 ? '' : 's'} left`
    return `${-d} day${d === -1 ? '' : 's'} overdue`
}

export function ContractsSection() {
    const toast = useToast()
    const [items, setItems]   = useState([])
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [form, setForm]     = useState(emptyForm())
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [cs, schs] = await Promise.all([getContracts(), getPlatformSchools()])
            setItems(cs); setSchools(schs)
        } catch (e) { toast.error(errorMessage(e, 'Could not load contracts.')) }
        finally { setLoading(false) }
    }, [toast])
    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const patchItem = (u) => setItems(list => list.map(i => (i.id === u.id ? { ...i, ...u } : i)))

    async function submit(e) {
        e.preventDefault()
        if (!form.client) { toast.error('Pick a school for the contract.'); return }
        setSaving(true)
        try {
            await createContract({ ...form, amount: form.amount || '0' })
            toast.success('Contract created (draft). Sign it to activate.')
            setForm(emptyForm()); setAdding(false); load()
        } catch (err) { toast.error(errorMessage(err, 'Could not create the contract.')) }
        finally { setSaving(false) }
    }

    async function run(id, fn, okMsg, { isNew } = {}) {
        setBusyId(id)
        try {
            const res = await fn()
            if (isNew) load(); else patchItem(res)
            toast.success(okMsg)
        } catch (e) { toast.error(errorMessage(e, 'Action failed.')) }
        finally { setBusyId(null) }
    }

    async function remove(c) {
        setBusyId(c.id)
        try { await deleteContract(c.id); setItems(list => list.filter(i => i.id !== c.id)); toast.success('Contract deleted.') }
        catch (e) { toast.error(errorMessage(e, 'Could not delete the contract.')) }
        finally { setBusyId(null) }
    }

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>Contracts</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setAdding(a => !a)}>{adding ? 'Cancel' : '+ New contract'}</button>
                </div>

                {adding && (
                    <form className="platform-form" onSubmit={submit}>
                        <div className="platform-form-grid">
                            <label>School
                                <select className="form-input" value={form.client} onChange={e => set('client', e.target.value)} required>
                                    <option value="">— select —</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </label>
                            <label>Title<input className="form-input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="2026 Annual — Basic" /></label>
                            <label>Plan
                                <select className="form-input" value={form.plan} onChange={e => set('plan', e.target.value)}>
                                    <option value="basic">Basic</option><option value="premium">Premium</option><option value="free">Free</option>
                                </select>
                            </label>
                            <label>Amount<input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                            <label>Currency<input className="form-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                            <label>Billing
                                <select className="form-input" value={form.billing_interval} onChange={e => set('billing_interval', e.target.value)}>
                                    {INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </label>
                            <label>Start<input className="form-input" type="date" required value={form.start_date} onChange={e => set('start_date', e.target.value)} /></label>
                            <label>End<input className="form-input" type="date" required value={form.end_date} onChange={e => set('end_date', e.target.value)} /></label>
                            <label>Grace (days)<input className="form-input" type="number" min="0" value={form.grace_days} onChange={e => set('grace_days', e.target.value)} /></label>
                        </div>
                        <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Create contract'}</button>
                    </form>
                )}

                {loading ? (
                    <p className="platform-muted">Loading…</p>
                ) : items.length === 0 ? (
                    <p className="platform-muted">No contracts yet. Create one and sign it to start tracking its lifecycle.</p>
                ) : (
                    <div className="platform-table-wrap">
                        <table className="platform-table">
                            <thead>
                                <tr><th>School</th><th>Contract</th><th>Amount</th><th>Term</th><th>Remaining</th><th>Status</th><th className="platform-col-action">Actions</th></tr>
                            </thead>
                            <tbody>
                                {items.map(c => (
                                    <tr key={c.id}>
                                        <td className="platform-strong">{c.school_name}</td>
                                        <td>{c.title}<div className="platform-muted pf-subtle pf-capitalize">{c.plan} · {c.billing_interval.replace('_', ' ')}</div></td>
                                        <td>{money(c.amount, c.currency)}</td>
                                        <td className="platform-muted">{c.start_date} → {c.end_date}</td>
                                        <td>{remainingLabel(c)}</td>
                                        <td><ContractChip c={c} /></td>
                                        <td className="platform-col-action pf-nowrap">
                                            {c.status === 'draft' && <button className="btn btn-primary btn-sm" disabled={busyId === c.id} onClick={() => run(c.id, () => signContract(c.id), 'Contract signed & active.')}>Sign</button>}
                                            {c.status === 'active' && <button className="btn btn-outline btn-sm" disabled={busyId === c.id} onClick={() => run(c.id, () => renewContract(c.id), 'Contract renewed.', { isNew: true })}>Renew</button>}
                                            {c.status === 'active' && <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === c.id} onClick={() => run(c.id, () => terminateContract(c.id), 'Contract terminated.')}>Terminate</button>}
                                            {(c.status === 'draft' || c.status === 'terminated' || c.status === 'expired') && <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === c.id} onClick={() => remove(c)}>Delete</button>}
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
