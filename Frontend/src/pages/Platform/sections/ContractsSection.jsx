import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/Modal'
import {
    getContracts, createContract, signContract, terminateContract, renewContract, deleteContract,
    getPlatformSchools,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SkeletonList } from '../../../components/ui/Skeleton'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)
const plusYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10) }
const emptyForm = () => ({ client: '', title: '', plan: 'basic', amount: '', currency: 'USD', billing_interval: 'yearly', start_date: today(), end_date: plusYear(), grace_days: 14 })
const INTERVALS = ['monthly', 'quarterly', 'yearly', 'one_time']
const CHIP_CLASS = { draft: 'info', active: 'ok', expired: 'bad', terminated: 'info' }

function ContractChip({ c }) {
    const { t } = useTranslation()
    const chip = (key, cls) => <span className={`platform-chip platform-chip-${cls}`}>{t(`platform.contracts.chip.${key}`, { defaultValue: key })}</span>
    if (c.status === 'active' && c.is_expired) return chip('expired_grace', 'bad')
    if (c.status === 'active' && c.is_expiring_soon) return chip('expiring', 'warn')
    return chip(c.status, CHIP_CLASS[c.status] || 'info')
}

export function ContractsSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [items, setItems]   = useState([])
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [form, setForm]     = useState(emptyForm())
    const [saving, setSaving] = useState(false)
    const [busyId, setBusyId] = useState(null)
    const p = key => t(`platform.contracts.${key}`)

    function remainingLabel(c) {
        if (c.status !== 'active') return '-'
        const d = c.days_remaining
        if (d === 0) return p('endsToday')
        if (d > 0) return t('platform.contracts.daysLeft', { count: d })
        return t('platform.contracts.daysOverdue', { count: -d })
    }

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [cs, schs] = await Promise.all([getContracts(), getPlatformSchools()])
            setItems(cs); setSchools(schs)
        } catch (e) { toast.error(errorMessage(e, t('platform.contracts.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, t])
    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const patchItem = (u) => setItems(list => list.map(i => (i.id === u.id ? { ...i, ...u } : i)))

    async function submit(e) {
        e.preventDefault()
        if (!form.client) { toast.error(p('pickSchool')); return }
        setSaving(true)
        try {
            await createContract({ ...form, amount: form.amount || '0' })
            toast.success(p('created'))
            setForm(emptyForm()); setAdding(false); load()
        } catch (err) { toast.error(errorMessage(err, p('createFailed'))) }
        finally { setSaving(false) }
    }

    async function run(id, fn, okMsg, { isNew } = {}) {
        setBusyId(id)
        try {
            const res = await fn()
            if (isNew) load(); else patchItem(res)
            toast.success(okMsg)
        } catch (e) { toast.error(errorMessage(e, t('platform.common.actionFailed'))) }
        finally { setBusyId(null) }
    }

    async function remove(c) {
        setBusyId(c.id)
        try { await deleteContract(c.id); setItems(list => list.filter(i => i.id !== c.id)); toast.success(p('deleted')) }
        catch (e) { toast.error(errorMessage(e, p('deleteFailed'))) }
        finally { setBusyId(null) }
    }

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>{p('title')}</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>{p('newContract')}</button>
                </div>

                {adding && (
                    <Modal title={p('newTitle')} icon="contract" size="lg" onClose={() => setAdding(false)} footer={
                        <>
                            <button className="btn btn-outline" onClick={() => setAdding(false)}>{t('platform.common.cancel')}</button>
                            <button type="submit" form="contract-form" className="btn btn-primary" disabled={saving}>{saving ? p('saving') : p('create')}</button>
                        </>
                    }>
                        <form id="contract-form" className="platform-form-grid" onSubmit={submit}>
                            <label>{p('form.school')}
                                <select className="form-input" value={form.client} onChange={e => set('client', e.target.value)} required>
                                    <option value="">{p('form.select')}</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </label>
                            <label>{p('form.title')}<input className="form-input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder={p('form.titlePlaceholder')} /></label>
                            <label>{p('form.plan')}
                                <select className="form-input" value={form.plan} onChange={e => set('plan', e.target.value)}>
                                    <option value="basic">{t('platform.common.plan.basic')}</option>
                                    <option value="premium">{t('platform.common.plan.premium')}</option>
                                    <option value="free">{t('platform.common.plan.free')}</option>
                                </select>
                            </label>
                            <label>{p('form.amount')}<input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                            <label>{p('form.currency')}<input className="form-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                            <label>{p('form.billing')}
                                <select className="form-input" value={form.billing_interval} onChange={e => set('billing_interval', e.target.value)}>
                                    {INTERVALS.map(v => <option key={v} value={v}>{t(`platform.common.interval.${v}`)}</option>)}
                                </select>
                            </label>
                            <label>{p('form.start')}<input className="form-input" type="date" required value={form.start_date} onChange={e => set('start_date', e.target.value)} /></label>
                            <label>{p('form.end')}<input className="form-input" type="date" required value={form.end_date} onChange={e => set('end_date', e.target.value)} /></label>
                            <label>{p('form.grace')}<input className="form-input" type="number" min="0" value={form.grace_days} onChange={e => set('grace_days', e.target.value)} /></label>
                        </form>
                    </Modal>
                )}

                {loading ? (
                    <SkeletonList items={3} />
                ) : items.length === 0 ? (
                    <p className="platform-muted">{p('empty')}</p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{p('cols.school')}</th><th>{p('cols.contract')}</th><th>{p('cols.amount')}</th><th>{p('cols.term')}</th>
                                    <th>{p('cols.remaining')}</th><th>{p('cols.status')}</th><th className="platform-col-action">{p('cols.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(c => (
                                    <tr key={c.id}>
                                        <td className="platform-strong">{c.school_name}</td>
                                        <td>{c.title}<div className="platform-muted pf-subtle pf-capitalize">{t(`platform.common.plan.${c.plan}`, { defaultValue: c.plan })} · {t(`platform.common.interval.${c.billing_interval}`, { defaultValue: c.billing_interval })}</div></td>
                                        <td>{money(c.amount, c.currency)}</td>
                                        <td className="platform-muted">{c.start_date} → {c.end_date}</td>
                                        <td>{remainingLabel(c)}</td>
                                        <td><ContractChip c={c} /></td>
                                        <td className="platform-col-action pf-nowrap">
                                            {c.status === 'draft' && <button className="btn btn-primary btn-sm" disabled={busyId === c.id} onClick={() => run(c.id, () => signContract(c.id), p('signed'))}>{p('sign')}</button>}
                                            {c.status === 'active' && <button className="btn btn-outline btn-sm" disabled={busyId === c.id} onClick={() => run(c.id, () => renewContract(c.id), p('renewed'), { isNew: true })}>{p('renew')}</button>}
                                            {c.status === 'active' && <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === c.id} onClick={() => run(c.id, () => terminateContract(c.id), p('terminated'))}>{p('terminate')}</button>}
                                            {(c.status === 'draft' || c.status === 'terminated' || c.status === 'expired') && <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === c.id} onClick={() => remove(c)}>{p('delete')}</button>}
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
