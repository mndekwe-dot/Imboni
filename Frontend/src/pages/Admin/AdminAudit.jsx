import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { EmptyState } from '../../components/ui/EmptyState'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getAuditLog } from '../../api/audit'
import { adminNavItems, adminSecondaryItems } from './adminNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'

const when = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

/** `{amount: '40000', notes: 'Bursary'}` as "amount: 40000 · notes: Bursary". */
function summarise(detail) {
    if (!detail || typeof detail !== 'object') return ''
    return Object.entries(detail)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' → ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' · ')
}

/**
 * Who did what, and when.
 *
 * Read-only on purpose: the server has no route that edits or deletes an
 * entry, and this page does not pretend otherwise. Filters narrow the QUERY,
 * and Export downloads the whole filtered set, not the rows currently loaded.
 */
export function AdminAudit() {
    const { t } = useTranslation()
    const toast = useToast()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()

    const [filters, setFilters] = useState({ action: '', actor: '', q: '', from: '', to: '' })
    const [rows, setRows] = useState([])
    const [count, setCount] = useState(0)
    const [actions, setActions] = useState([])
    const [loading, setLoading] = useState(true)
    const set = (key, value) => setFilters(f => ({ ...f, [key]: value }))

    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))

    const load = useCallback(async (offset = 0) => {
        setLoading(true)
        try {
            const data = await getAuditLog({ ...params, ...(offset ? { offset } : {}) })
            setRows(prev => (offset ? [...prev, ...data.results] : data.results))
            setCount(data.count)
            setActions(data.actions || [])
        } catch (e) {
            toast.error(errorMessage(e, t('admin.audit.loadFailed')))
        } finally { setLoading(false) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, toast, t])

    useEffect(() => { load(0) }, [load])

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('admin.audit.title')} subtitle={t('admin.audit.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications} onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="card">
                            <div className="card-content">
                                <div className="form-grid">
                                    <label className="form-group">
                                        <span className="form-label">{t('admin.audit.action')}</span>
                                        <select className="form-input" value={filters.action} onChange={e => set('action', e.target.value)}>
                                            <option value="">{t('admin.audit.allActions')}</option>
                                            {actions.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-group">
                                        <span className="form-label">{t('admin.audit.actor')}</span>
                                        <input className="form-input" value={filters.actor} placeholder={t('admin.audit.actorPlaceholder')}
                                            onChange={e => set('actor', e.target.value)} />
                                    </label>
                                    <label className="form-group">
                                        <span className="form-label">{t('admin.audit.target')}</span>
                                        <input className="form-input" value={filters.q} placeholder={t('admin.audit.targetPlaceholder')}
                                            onChange={e => set('q', e.target.value)} />
                                    </label>
                                    <label className="form-group">
                                        <span className="form-label">{t('admin.audit.from')}</span>
                                        <input type="date" className="form-input" value={filters.from} onChange={e => set('from', e.target.value)} />
                                    </label>
                                    <label className="form-group">
                                        <span className="form-label">{t('admin.audit.to')}</span>
                                        <input type="date" className="form-input" value={filters.to} onChange={e => set('to', e.target.value)} />
                                    </label>
                                </div>
                                <DocumentActions url="/imboni/audit/" params={params} stem="audit-log" pdf={false} disabled={loading} />
                            </div>
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-content">
                                {!loading && rows.length === 0 ? (
                                    <EmptyState icon="search_off" title={t('admin.audit.empty')} description={t('admin.audit.emptyDesc')} />
                                ) : (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('admin.audit.when')}</th>
                                                    <th>{t('admin.audit.actor')}</th>
                                                    <th>{t('admin.audit.action')}</th>
                                                    <th>{t('admin.audit.target')}</th>
                                                    <th>{t('admin.audit.detail')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(r => (
                                                    <tr key={r.id}>
                                                        <td className="u-nowrap">{when(r.when)}</td>
                                                        <td>{r.actor_name}{r.actor_role && <span className="text-xs-muted"> · {r.actor_role}</span>}</td>
                                                        <td><code>{r.action}</code></td>
                                                        <td>{r.target}</td>
                                                        <td className="u-muted u-sm">{summarise(r.detail)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {rows.length > 0 && (
                                    <p className="u-muted u-sm mt-1">{t('admin.audit.showing', { shown: rows.length, count })}</p>
                                )}
                                {rows.length < count && (
                                    <button className="btn btn-outline btn-sm" disabled={loading} onClick={() => load(rows.length)}>
                                        {t('admin.audit.more')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
