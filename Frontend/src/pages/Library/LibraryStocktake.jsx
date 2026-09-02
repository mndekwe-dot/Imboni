import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '../../components/ui/DataTable'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { Modal } from '../../components/ui/Modal'
import { ScanInput } from '../../components/ui/ScanInput'
import { StatCard } from '../../components/layout/StatCard'
import {
    abandonStocktake, closeStocktake, createStocktake, getLostAndDamaged,
    getStocktake, getStocktakes, recordCopyEvent, scanCopy,
} from '../../api/library'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { LibraryShell } from './LibraryShell'
import { pill } from '../../utils/tone'

/**
 * Counting the shelves against the catalogue.
 *
 * Until a library does this, its catalogue records what the school BOUGHT
 * rather than what it has. The gap between the two is the whole point.
 */
export function LibraryStocktake() {
    const { t } = useTranslation()
    const toast = useToast()

    const [counts, setCounts] = useState([])
    const [openId, setOpenId] = useState(null)
    const [starting, setStarting] = useState(false)
    const [missing, setMissing] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([getStocktakes(), getLostAndDamaged()])
            .then(([s, m]) => {
                setCounts(Array.isArray(s) ? s : [])
                setMissing(Array.isArray(m) ? m : [])
            })
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    const open = counts.filter(c => c.status === 'open')

    return (
        <LibraryShell title={t('library.stocktake.title')}
            subtitle={t('library.stocktake.subtitle')}>
            {starting && (
                <StartModal onClose={() => setStarting(false)}
                    onStarted={id => { load(); setOpenId(id) }} />
            )}
            {openId && (
                <CountModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="inventory" value={loading ? '-' : open.length}
                    label={t('library.stocktake.inProgress')} colorClass="info" />
                <StatCard icon="report" value={loading ? '-' : missing.length}
                    label={t('library.stocktake.lostOrDamaged')}
                    colorClass={missing.length ? 'warning' : ''} />
            </div>

            <div className="toolbar-card mb-1-5">
                <button className="btn btn-primary btn-sm" onClick={() => setStarting(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('library.stocktake.start')}
                </button>
                <div className="toolbar-spacer" />
                <DocumentActions url="/imboni/library/lost-damaged/" stem="lost-and-damaged"
                    pdf={false} disabled={loading} />
            </div>

            <ListSection icon="inventory" title={t('library.stocktake.counts')}
                count={loading ? null : counts.length}>
                {loading ? <p className="u-muted">{t('common.loading')}</p>
                    : counts.length === 0 ? (
                        <EmptyState icon="inventory" title={t('library.stocktake.none')}
                            description={t('library.stocktake.noneDesc')}
                            action={{ label: t('library.stocktake.start'), icon: 'add',
                                onClick: () => setStarting(true) }} />
                    ) : (
                        <ul className="row-list">
                            {counts.map(c => (
                                <li key={c.id} className="row-item">
                                    <button className="row-item-button" onClick={() => setOpenId(c.id)}>
                                        <span className="row-icon">
                                            <span className="material-symbols-rounded" aria-hidden="true">inventory</span>
                                        </span>
                                        <div className="row-main">
                                            <div className="u-strong">{c.name}</div>
                                            <div className="text-xs-muted">
                                                {formatDate(c.started_at)}
                                                {c.scope_shelf ? ` · ${c.scope_shelf}` : ''}
                                                {` · ${t('library.stocktake.scanned', { count: c.scanned })}`}
                                            </div>
                                        </div>
                                    </button>
                                    <span className={pill(c.status)}>
                                        {c.status_label}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
            </ListSection>

            <div className="mt-1-5">
                <DataTable
                    title={t('library.stocktake.lostOrDamaged')}
                    icon="report"
                    data={missing}
                    columns={[
                        { label: t('library.fields.copy') },
                        { label: t('library.fields.title') },
                        { label: t('common.status') },
                        { label: t('library.fields.condition') },
                        { label: '' },
                    ]}
                    renderRow={c => (
                        <tr key={c.id}>
                            <td><code className="lib-copy-code">{c.copy_code}</code></td>
                            <td>{c.book_title || c.title}</td>
                            <td>{c.status_label || c.status}</td>
                            <td>{c.condition_label || c.condition}</td>
                            <td className="action-cell">
                                <button className="btn-ghost btn-sm"
                                    onClick={async () => {
                                        try {
                                            await recordCopyEvent(c.id, { kind: 'found' })
                                            toast.success(t('library.stocktake.restored'))
                                            load()
                                        } catch (error) {
                                            toast.error(errorMessage(error, t('library.stocktake.actionFailed')))
                                        }
                                    }}>
                                    {t('library.stocktake.markFound')}
                                </button>
                            </td>
                        </tr>
                    )}
                    emptyIcon="report"
                    emptyTitle={t('library.stocktake.nothingMissing')}
                    emptyDesc={t('library.stocktake.nothingMissingDesc')}
                />
            </div>
        </LibraryShell>
    )
}

function StartModal({ onClose, onStarted }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({ name: '', scope_shelf: '', scope_category: '' })
    const [busy, setBusy] = useState(false)
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            const count = await createStocktake(form)
            toast.success(t('library.stocktake.started'))
            onStarted(count.id)
            onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('library.stocktake.actionFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal onClose={onClose} title={t('library.stocktake.start')}>
            <form onSubmit={submit}>
                <label className="form-group">
                    <span className="form-label">{t('common.name')}</span>
                    <input className="form-input" value={form.name} onChange={set('name')}
                        placeholder={t('library.stocktake.namePlaceholder')} required autoFocus />
                </label>
                <div className="form-grid mt-1">
                    <label className="form-group">
                        <span className="form-label">{t('library.fields.shelf')}</span>
                        <input className="form-input" value={form.scope_shelf}
                            onChange={set('scope_shelf')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('library.fields.category')}</span>
                        <input className="form-input" value={form.scope_category}
                            onChange={set('scope_category')} />
                    </label>
                </div>
                <p className="u-muted u-sm mt-1">{t('library.stocktake.scopeNote')}</p>
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? t('common.saving') : t('library.stocktake.start')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

/** Scan copies off, and see what is still unaccounted for. */
function CountModal({ id, onClose, onChanged }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData] = useState(null)
    const [busy, setBusy] = useState(false)
    const [confirming, setConfirming] = useState(false)

    const load = useCallback(() => {
        getStocktake(id).then(setData).catch(() => setData(null))
    }, [id])
    useEffect(() => { load() }, [load])

    async function submitScan(value) {
        if (!value) return
        setBusy(true)
        try {
            const result = await scanCopy(id, value)
            // A duplicate is not an error — the person is holding a scanner and
            // a stack of books, not watching the screen.
            if (result.already_seen) toast.info(t('library.stocktake.alreadySeen'))
            setData(d => (d ? { ...d, ...result.progress } : d))
            load()
        } catch (error) {
            toast.error(errorMessage(error, t('library.stocktake.scanFailed')))
        } finally {
            setBusy(false)
        }
    }

    async function finish(markMissing) {
        setBusy(true)
        try {
            const result = await closeStocktake(id, markMissing)
            toast.success(markMissing
                ? t('library.stocktake.closedMarked', { count: result.marked_lost })
                : t('library.stocktake.closed'))
            onChanged()
            onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('library.stocktake.actionFailed')))
        } finally { setBusy(false); setConfirming(false) }
    }

    const isOpen = data?.stocktake?.status === 'open'

    return (
        <Modal onClose={onClose} title={data?.stocktake?.name || t('library.stocktake.title')}
            size="lg">
            {!data ? <p className="u-muted">{t('common.loading')}</p> : (
                <>
                    <div className="figure-strip">
                        <div>
                            <span className="figure-label">{t('library.stocktake.inScope')}</span>
                            {data.total}
                        </div>
                        <div>
                            <span className="figure-label">{t('library.stocktake.seen')}</span>
                            {data.seen} ({data.percent_seen}%)
                        </div>
                        <div>
                            <span className="figure-label">{t('library.stocktake.onLoan')}</span>
                            {data.on_loan}
                        </div>
                        <div>
                            <span className="figure-label">{t('library.stocktake.unaccounted')}</span>
                            <span className={data.unaccounted ? 'amount-owed' : ''}>
                                {data.unaccounted}
                            </span>
                        </div>
                    </div>

                    {isOpen && (
                        <div className="mb-1-5">
                            {/* The same box as the desk, so a librarian who has
                                learnt one has learnt both -- and the phone
                                camera works here too, which matters when the
                                counting happens at the shelves. */}
                            <ScanInput onScan={submitScan} busy={busy}
                                label={t('library.fields.copy')}
                                placeholder={t('library.stocktake.scanPlaceholder')} />
                        </div>
                    )}

                    <p className="u-muted u-sm">{t('library.stocktake.onLoanNote')}</p>

                    <div className="toolbar-card mb-1-5 mt-1">
                        <DocumentActions url={`/imboni/library/stocktakes/${id}/`}
                            stem="stocktake" />
                        <div className="toolbar-spacer" />
                        {isOpen && (
                            <>
                                <button className="btn btn-outline btn-sm" disabled={busy}
                                    onClick={() => finish(false)}>
                                    {t('library.stocktake.close')}
                                </button>
                                <button className="btn btn-outline btn-sm" disabled={busy}
                                    onClick={() => setConfirming(true)}>
                                    {t('library.stocktake.closeAndMark')}
                                </button>
                            </>
                        )}
                    </div>

                    {confirming && (
                        <div className="card u-banner u-banner--warn mb-1-5">
                            <p className="u-strong">
                                {t('library.stocktake.confirmMark', { count: data.unaccounted })}
                            </p>
                            <p className="u-muted u-sm">{t('library.stocktake.confirmMarkDesc')}</p>
                            <div className="u-row mt-1">
                                <button className="btn btn-outline btn-sm"
                                    onClick={() => setConfirming(false)}>
                                    {t('common.cancel')}
                                </button>
                                <button className="btn btn-primary btn-sm" disabled={busy}
                                    onClick={() => finish(true)}>
                                    {t('library.stocktake.confirmMarkAction')}
                                </button>
                            </div>
                        </div>
                    )}

                    <DataTable
                        title={t('library.stocktake.unaccounted')}
                        icon="search_off"
                        data={data.unaccounted_copies || []}
                        columns={[
                            { label: t('library.fields.copy') },
                            { label: t('library.fields.title') },
                            { label: t('library.fields.shelf') },
                        ]}
                        renderRow={c => (
                            <tr key={c.id}>
                                <td><code className="lib-copy-code">{c.copy_code}</code></td>
                                <td>{c.book_title || c.title}</td>
                                <td className="text-muted">{c.shelf || ''}</td>
                            </tr>
                        )}
                        emptyIcon="search_off"
                        emptyTitle={t('library.stocktake.allFound')}
                        emptyDesc={t('library.stocktake.allFoundDesc')}
                    />

                    {data.stocktake.status === 'open' && (
                        <div className="mt-1-5">
                            <button className="btn-ghost btn-sm" disabled={busy}
                                onClick={async () => {
                                    await abandonStocktake(id); onChanged(); onClose()
                                }}>
                                {t('library.stocktake.abandon')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </Modal>
    )
}
