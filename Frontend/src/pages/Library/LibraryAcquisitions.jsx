import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FilterBar } from '../../components/ui/FilterBar'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { readStoredUser } from '../../utils/roles'
import { createAcquisition, decideAcquisition, getAcquisitions, receiveAcquisition } from '../../api/library'
import { LibraryShell } from './LibraryShell'

const FILTERS = ['all', 'pending', 'approved', 'received', 'declined']

/**
 * Books the library wants to buy: asked for here, decided in the office,
 * received back here.
 *
 * Approval and receipt are separate steps on purpose. A request approved in
 * March and delivered in June is the ordinary case, and until the stock
 * arrives there is nothing to lend — so "approved" must not put copies on the
 * shelf.
 */
export function LibraryAcquisitions() {
    const { t } = useTranslation()
    const toast = useToast()
    const role = readStoredUser()?.role

    const [rows, setRows]       = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter]   = useState('pending')
    const [showNew, setShowNew] = useState(false)

    const load = useCallback(() => {
        setLoading(true)
        getAcquisitions({ status: filter })
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [filter, toast, t])

    useEffect(() => { load() }, [load])

    async function handleCreate(form) {
        try {
            await createAcquisition({
                ...form,
                quantity: Number(form.quantity) || 1,
                unit_price: form.unit_price || null,
            })
            setShowNew(false)
            load()
            toast.success(t('library.acquisitions.requested'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    async function handleDecision(req, decision) {
        try {
            await decideAcquisition(req.id, decision, '')
            load()
            toast.success(t(decision === 'approved'
                ? 'library.acquisitions.approved' : 'library.acquisitions.declined'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    async function handleReceive(req) {
        try {
            const result = await receiveAcquisition(req.id)
            load()
            toast.success(t('library.acquisitions.received', {
                count: result?.copies?.length ?? req.quantity, title: req.title,
            }))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    const pending = rows.filter(r => r.status === 'pending').length
    const awaitingDelivery = rows.filter(r => r.status === 'approved').length

    return (
        <LibraryShell
            title={t('library.acquisitions.title')}
            subtitle={t('library.acquisitions.subtitle')}
        >
            {showNew && <RequestForm onClose={() => setShowNew(false)} onSave={handleCreate} />}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="pending_actions" value={loading ? '-' : pending}
                    label={t('library.acquisitions.awaitingDecision')} colorClass="warning" />
                <StatCard icon="local_shipping" value={loading ? '-' : awaitingDelivery}
                    label={t('library.acquisitions.awaitingDelivery')} colorClass="info" />
            </div>

            <div className="toolbar-card mb-1-5">
                <FilterBar
                    options={FILTERS.map(key => ({ key, label: t(`library.acquisitions.filter.${key}`) }))}
                    active={filter}
                    onChange={setFilter}
                />
                <div className="toolbar-spacer" />
                {role === 'librarian' && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('library.acquisitions.newRequest')}
                    </button>
                )}
            </div>

            <ListSection
                icon="shopping_cart"
                title={t(`library.acquisitions.filter.${filter}`)}
                count={loading ? null : t('library.requestCount', { count: rows.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon="shopping_cart"
                        title={t('library.acquisitions.empty')}
                        description={t('library.acquisitions.emptyDesc')}
                        action={role === 'librarian'
                            ? { label: t('library.acquisitions.newRequest'), icon: 'add',
                                onClick: () => setShowNew(true) }
                            : undefined}
                    />
                ) : (
                    <ul className="lib-loan-list">
                        {rows.map(req => (
                            <li key={req.id} className="lib-loan-row">
                                <span className="lib-loan-icon" aria-hidden="true">
                                    <span className="material-symbols-rounded">local_library</span>
                                </span>
                                <div className="lib-loan-main">
                                    <div className="u-strong u-sm">
                                        {req.title}
                                        <span className="text-xs-muted">
                                            {' '}× {req.quantity}
                                        </span>
                                    </div>
                                    <div className="text-xs-muted">
                                        {req.author || t('library.fields.unknownAuthor')}
                                        {req.requested_by_name ? ` · ${req.requested_by_name}` : ''}
                                        {' · '}{formatDate(req.created_at)}
                                    </div>
                                </div>
                                <div className="lib-loan-due">
                                    <span className={`badge lib-acq-${req.status}`}>
                                        {t(`library.acquisitions.status.${req.status}`)}
                                    </span>
                                    {Number(req.estimated_cost) > 0 && (
                                        <span className="text-xs-muted">{req.estimated_cost}</span>
                                    )}
                                </div>
                                <div className="lib-loan-actions">
                                    {/* Only the office decides, and only on a
                                        request nobody has decided yet. */}
                                    {req.status === 'pending' && role === 'admin' && (
                                        <>
                                            <button className="btn btn-outline btn-sm"
                                                onClick={() => handleDecision(req, 'declined')}>
                                                {t('library.acquisitions.decline')}
                                            </button>
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => handleDecision(req, 'approved')}>
                                                {t('library.acquisitions.approve')}
                                            </button>
                                        </>
                                    )}
                                    {req.status === 'approved' && role === 'librarian' && (
                                        <button className="btn btn-primary btn-sm"
                                            onClick={() => handleReceive(req)}>
                                            <span className="material-symbols-rounded icon-sm"
                                                aria-hidden="true">inventory</span>
                                            {t('library.acquisitions.receive')}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>
        </LibraryShell>
    )
}

function RequestForm({ onClose, onSave }) {
    const { t } = useTranslation()
    const [form, setForm] = useState({ title: '', author: '', isbn: '', quantity: 1, unit_price: '', reason: '' })
    const [error, setError] = useState(null)
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    function submit() {
        if (!form.title.trim()) {
            setError(t('library.catalogue.titleRequired'))
            return
        }
        onSave({ ...form, title: form.title.trim() })
    }

    return (
        <Modal
            title={t('library.acquisitions.newRequest')}
            icon="add_shopping_cart"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={submit}>{t('common.send')}</button>
                </>
            }
        >
            <div className="lib-form-grid">
                <div className="lib-col-full">
                    <label className="form-label" htmlFor="acq-title">{t('library.fields.title')}</label>
                    <input id="acq-title" className="form-input" value={form.title}
                        onChange={e => set('title', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="acq-author">{t('library.fields.author')}</label>
                    <input id="acq-author" className="form-input" value={form.author}
                        onChange={e => set('author', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="acq-isbn">{t('library.fields.isbn')}</label>
                    <input id="acq-isbn" className="form-input" value={form.isbn}
                        onChange={e => set('isbn', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="acq-qty">{t('library.fields.quantity')}</label>
                    <input id="acq-qty" type="number" min="1" className="form-input" value={form.quantity}
                        onChange={e => set('quantity', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="acq-price">{t('library.fields.unitPrice')}</label>
                    <input id="acq-price" type="number" step="0.01" className="form-input"
                        value={form.unit_price} onChange={e => set('unit_price', e.target.value)} />
                </div>
                <div className="lib-col-full">
                    <label className="form-label" htmlFor="acq-reason">{t('library.fields.reason')}</label>
                    <textarea id="acq-reason" className="form-input form-textarea" rows="2"
                        placeholder={t('library.acquisitions.reasonPlaceholder')}
                        value={form.reason} onChange={e => set('reason', e.target.value)} />
                </div>
            </div>
            {error && <p className="form-error">{error}</p>}
        </Modal>
    )
}
