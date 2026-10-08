import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getPharmacy, addPharmacyItem, movePharmacyStock, getPharmacyHistory } from '../../api/matron'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'

const TONE = { ok: 'badge-soft-success', low: 'badge-soft-warning', out: 'badge-soft-danger',
    expiring: 'badge-soft-warning', expired: 'badge-soft-danger' }
const REASONS = ['received', 'dispensed', 'expired', 'correction']

function AddModal({ onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({ name: '', unit: 'pcs', quantity: '0', reorder_level: '0', expiry_date: '', notes: '' })
    const [busy, setBusy] = useState(false)
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function save(e) {
        e.preventDefault()
        setBusy(true)
        try {
            await addPharmacyItem({ ...form, expiry_date: form.expiry_date || null })
            toast.success(t('matron.pharmacy.saved'))
            onSaved(); onClose()
        } catch (err) {
            toast.error(errorMessage(err, t('matron.pharmacy.saveFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal title={t('matron.pharmacy.add')} icon="medication" onClose={onClose}>
            <form onSubmit={save}>
                <div className="form-grid">
                    <label className="form-group form-col-full">
                        <span className="form-label">{t('matron.pharmacy.name')}</span>
                        <input className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('matron.pharmacy.unit')}</span>
                        <input className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('matron.pharmacy.quantity')}</span>
                        <input className="form-input" type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('matron.pharmacy.reorder')}</span>
                        <input className="form-input" type="number" min="0" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('matron.pharmacy.expiry')}</span>
                        <input className="form-input" type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
                    </label>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{t('matron.pharmacy.save')}</button>
                </div>
            </form>
        </Modal>
    )
}

function StockModal({ item, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [reason, setReason] = useState('received')
    const [change, setChange] = useState('')
    const [note, setNote] = useState('')
    const [busy, setBusy] = useState(false)
    const [history, setHistory] = useState(null)

    useEffect(() => {
        getPharmacyHistory(item.id).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => setHistory([]))
    }, [item.id])

    async function save(e) {
        e.preventDefault()
        setBusy(true)
        try {
            await movePharmacyStock(item.id, { reason, change, note })
            toast.success(t('matron.pharmacy.moved'))
            onSaved(); onClose()
        } catch (err) {
            toast.error(errorMessage(err, t('matron.pharmacy.moveFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal title={item.name} icon="inventory_2" onClose={onClose}>
            <form onSubmit={save}>
                <div className="form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('matron.pharmacy.why')}</span>
                        <select className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
                            {REASONS.map(r => <option key={r} value={r}>{t(`matron.pharmacy.reasons.${r}`)}</option>)}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('matron.pharmacy.howMany')} ({item.unit})</span>
                        <input className="form-input" type="number" required value={change} onChange={e => setChange(e.target.value)} />
                    </label>
                    <label className="form-group form-col-full">
                        <span className="form-label">{t('matron.pharmacy.note')}</span>
                        <input className="form-input" value={note} onChange={e => setNote(e.target.value)} />
                    </label>
                </div>
                {reason === 'correction' && <p className="text-xs-muted">{t('matron.pharmacy.correctionHint')}</p>}
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !change}>{t('matron.pharmacy.apply')}</button>
                </div>
            </form>

            <h3 className="stu-modal-section">{t('matron.pharmacy.history')}</h3>
            {history && history.length === 0 && <p className="empty-note">{t('matron.pharmacy.noHistory')}</p>}
            <ul className="row-list">
                {(history || []).map(m => (
                    <li key={m.id} className="row-item">
                        <span className="row-main">
                            <span className="u-strong u-sm">{m.change > 0 ? `+${m.change}` : m.change} · {t(`matron.pharmacy.reasons.${m.reason}`)}</span>
                            <span className="text-xs-muted">
                                {formatDate(m.at)}{m.by_name && ` · ${t('matron.pharmacy.by', { name: m.by_name })}`}
                                {m.student_name && ` · ${m.student_name}`}{m.note && ` · ${m.note}`}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </Modal>
    )
}

/** What the sick bay has in its cupboard, worst problems first. */
export function MatronPharmacy() {
    const { t } = useTranslation()
    const toast = useToast()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [items, setItems] = useState(null)
    const [adding, setAdding] = useState(false)
    const [moving, setMoving] = useState(null)

    const load = useCallback(() => {
        getPharmacy()
            .then(d => setItems(Array.isArray(d) ? d : []))
            .catch(e => { setItems([]); toast.error(errorMessage(e, t('matron.pharmacy.loadFailed'))) })
    }, [toast, t])

    useEffect(() => { load() }, [load])

    const list = items || []
    const lowOrOut = list.filter(i => i.status === 'low' || i.status === 'out').length
    const dated = list.filter(i => i.status === 'expiring' || i.status === 'expired').length

    return (
        <>
            {adding && <AddModal onClose={() => setAdding(false)} onSaved={load} />}
            {moving && <StockModal item={moving} onClose={() => setMoving(null)} onSaved={load} />}
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('matron.pharmacy.title')} subtitle={t('matron.pharmacy.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications} onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="portal-stat-grid">
                            <StatCard icon="medication" value={items ? list.length : '-'} label={t('matron.pharmacy.stats.items')} colorClass="info" />
                            <StatCard icon="warning" value={items ? lowOrOut : '-'} label={t('matron.pharmacy.stats.low')} colorClass={lowOrOut ? 'warning' : ''} />
                            <StatCard icon="event_busy" value={items ? dated : '-'} label={t('matron.pharmacy.stats.expiring')} colorClass={dated ? 'warning' : ''} />
                        </div>

                        <div className="toolbar-card mb-1-5">
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                                {t('matron.pharmacy.add')}
                            </button>
                        </div>

                        {items && list.length === 0 ? (
                            <EmptyState icon="medication" title={t('matron.pharmacy.empty')} description={t('matron.pharmacy.emptyDesc')} />
                        ) : (
                            <ul className="row-list">
                                {list.map(i => (
                                    <li key={i.id} className="row-item">
                                        <span className="row-main">
                                            <span className="u-strong u-sm">{i.name}</span>
                                            <span className="text-xs-muted">
                                                {i.quantity} {i.unit}
                                                {i.expiry_date && ` · ${t('matron.pharmacy.expires', { date: formatDate(i.expiry_date) })}`}
                                            </span>
                                        </span>
                                        <span className={`badge ${TONE[i.status]}`}>{t(`matron.pharmacy.status.${i.status}`)}</span>
                                        <button className="btn btn-outline btn-sm" onClick={() => setMoving(i)}>{t('matron.pharmacy.stock')}</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
