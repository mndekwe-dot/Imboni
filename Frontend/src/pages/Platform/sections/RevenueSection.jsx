import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/Modal'
import { StatCard } from '../../../components/layout/StatCard'
import { getPayments, createPayment, deletePayment, getPlatformSchools } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SkeletonList } from '../../../components/ui/Skeleton'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const usd = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({ client: '', amount: '', currency: 'USD', plan: 'basic', status: 'succeeded', received_at: today(), note: '' })

const STATUS_CLS = { succeeded: 'ok', pending: 'warn', failed: 'bad', refunded: 'info' }
const STATUSES = ['succeeded', 'pending', 'failed', 'refunded']

export function RevenueSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [payments, setPayments] = useState([])
    const [schools, setSchools]   = useState([])
    const [loading, setLoading]   = useState(true)
    const [adding, setAdding]     = useState(false)
    const [form, setForm]         = useState(emptyForm())
    const [saving, setSaving]     = useState(false)
    const [busyId, setBusyId]     = useState(null)
    const r = key => t(`platform.revenue.${key}`)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [pays, schs] = await Promise.all([getPayments(), getPlatformSchools()])
            setPayments(pays); setSchools(schs)
        } catch (e) { toast.error(errorMessage(e, t('platform.revenue.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, t])
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
            toast.success(r('recorded'))
            setForm(emptyForm()); setAdding(false)
            load()
        } catch (err) { toast.error(errorMessage(err, r('recordFailed'))) }
        finally { setSaving(false) }
    }

    async function remove(p) {
        setBusyId(p.id)
        try {
            await deletePayment(p.id)
            setPayments(list => list.filter(x => x.id !== p.id))
            toast.success(r('removed'))
        } catch (e) { toast.error(errorMessage(e, r('removeFailed'))) }
        finally { setBusyId(null) }
    }

    return (
        <>
            <div className="platform-cards pf-mb">
                <StatCard icon="account_balance" value={usd(total)} label={r('totalReceived')} colorClass="success" />
                <StatCard icon="trending_up" value={usd(monthTotal)} label={r('thisMonth')} colorClass="success" />
            </div>

            <div className="card">
                <div className="card-content">
                    <div className="platform-panel-head">
                        <h2>{r('title')}</h2>
                        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>{r('record')}</button>
                    </div>

                    {adding && (
                        <Modal title={r('recordTitle')} icon="payments" size="lg" onClose={() => setAdding(false)} footer={
                            <>
                                <button className="btn btn-outline" onClick={() => setAdding(false)}>{t('platform.common.cancel')}</button>
                                <button type="submit" form="payment-form" className="btn btn-primary" disabled={saving}>{saving ? r('saving') : r('save')}</button>
                            </>
                        }>
                            <form id="payment-form" className="platform-form-grid" onSubmit={submit}>
                                <label>{r('form.school')}
                                    <select className="form-input" value={form.client} onChange={e => set('client', e.target.value)}>
                                        <option value="">{r('form.select')}</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </label>
                                <label>{r('form.amount')}<input className="form-input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
                                <label>{r('form.currency')}<input className="form-input" maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
                                <label>{r('form.plan')}
                                    <select className="form-input" value={form.plan} onChange={e => set('plan', e.target.value)}>
                                        <option value="basic">{t('platform.common.plan.basic')}</option>
                                        <option value="premium">{t('platform.common.plan.premium')}</option>
                                        <option value="free">{t('platform.common.plan.free')}</option>
                                    </select>
                                </label>
                                <label>{r('form.status')}
                                    <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                                        {STATUSES.map(s => <option key={s} value={s}>{r(`status.${s}`)}</option>)}
                                    </select>
                                </label>
                                <label>{r('form.date')}<input className="form-input" type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} /></label>
                            </form>
                        </Modal>
                    )}

                    {loading ? (
                        <SkeletonList items={3} />
                    ) : payments.length === 0 ? (
                        <p className="platform-muted">{r('empty')}</p>
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{r('cols.date')}</th><th>{r('cols.school')}</th><th>{r('cols.plan')}</th><th>{r('cols.amount')}</th>
                                        <th>{r('cols.status')}</th><th className="platform-col-action">{r('cols.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map(p => (
                                        <tr key={p.id}>
                                            <td>{(p.received_at || '').slice(0, 10)}</td>
                                            <td className="platform-strong">{p.school_name || '-'}</td>
                                            <td className="pf-capitalize">{p.plan ? t(`platform.common.plan.${p.plan}`, { defaultValue: p.plan }) : '-'}</td>
                                            <td>{money(p.amount, p.currency)}</td>
                                            <td><span className={`platform-chip platform-chip-${STATUS_CLS[p.status] || 'info'}`}>{t(`platform.revenue.status.${p.status}`, { defaultValue: p.status })}</span></td>
                                            <td className="platform-col-action">
                                                <button className="btn btn-outline btn-sm platform-danger" disabled={busyId === p.id} onClick={() => remove(p)}>{r('delete')}</button>
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
