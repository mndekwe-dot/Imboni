import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClassFilter } from '../../components/ui/ClassFilter'
import { DataTable } from '../../components/ui/DataTable'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import { printPdf } from '../../api/documents'
import { getBorrowerHistory, getOverdue } from '../../api/library'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { LibraryShell } from './LibraryShell'

/**
 * Chasing what is late.
 *
 * Filtered by class because that is how a school actually chases: the list goes
 * to a form teacher for one register, not to two hundred pupils individually.
 */
export function LibraryOverdue() {
    const { t } = useTranslation()
    const toast = useToast()

    const [loans, setLoans] = useState([])
    const [loading, setLoading] = useState(true)
    const [klass, setKlass] = useState({ grade: '', stream: '' })
    const [borrower, setBorrower] = useState(null)

    const params = {
        ...(klass.grade ? { grade: klass.grade } : {}),
        ...(klass.stream ? { stream: klass.stream } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        getOverdue(params)
            .then(d => setLoans(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, klass.grade, klass.stream])

    useEffect(() => { load() }, [load])

    const today = new Date()
    const daysLate = (due) => Math.max(
        Math.round((today - new Date(due)) / 86400000), 0)

    const borrowers = new Set(loans.map(l => l.borrower?.id ?? l.borrower)).size

    async function printNotices() {
        try {
            await printPdf('/imboni/library/overdue/notices/', params)
        } catch (error) {
            toast.error(errorMessage(error, t('common.documentFailed')))
        }
    }

    return (
        <LibraryShell title={t('library.overdue.title')} subtitle={t('library.overdue.subtitle')}>
            {borrower && (
                <BorrowerModal id={borrower} onClose={() => setBorrower(null)} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="event_busy" value={loading ? '-' : loans.length}
                    label={t('library.overdue.booksOut')}
                    colorClass={loans.length ? 'warning' : ''} />
                <StatCard icon="people" value={loading ? '-' : borrowers}
                    label={t('library.overdue.borrowers')} colorClass="info" />
            </div>

            <div className="toolbar-card mb-1-5">
                <ClassFilter grade={klass.grade} stream={klass.stream}
                    onChange={setKlass} disabled={loading} />
                <div className="toolbar-spacer" />
                {/* One page per borrower rather than one list: a sheet naming
                    forty pupils and their debts is not a reminder. */}
                <button className="btn btn-outline btn-sm" onClick={printNotices}
                    disabled={loading || !loans.length}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">mail</span>
                    {t('library.overdue.printNotices')}
                </button>
                <DocumentActions url="/imboni/library/overdue/" params={params}
                    stem="overdue" disabled={loading} />
            </div>

            <DataTable
                title={t('library.overdue.title')}
                icon="event_busy"
                count={loans.length}
                columns={[
                    { key: 'borrower', label: t('library.fields.borrower') },
                    { key: 'class_label', label: t('common.class') },
                    { key: 'title', label: t('library.fields.title') },
                    { key: 'copy', label: t('library.fields.copy') },
                    { key: 'due', label: t('library.fields.due') },
                    { key: 'late', label: t('library.overdue.daysLate'), align: 'right' },
                ]}
                rows={loans.map(l => ({
                    id: l.id,
                    borrower: (
                        <button className="btn-ghost btn-sm"
                            onClick={() => setBorrower(l.borrower?.id ?? l.borrower)}>
                            {l.borrower?.name || l.borrower_name}
                        </button>
                    ),
                    class_label: l.borrower?.class_label || '',
                    title: l.book_title || l.copy?.book?.title,
                    copy: l.copy_code || l.copy?.copy_code,
                    due: formatDate(l.due_on),
                    late: <span className="pill fin-status-overdue">{daysLate(l.due_on)}</span>,
                }))}
                emptyTitle={t('library.overdue.none')}
                emptyDescription={t('library.overdue.noneDesc')}
            />
        </LibraryShell>
    )
}

/** One reader's whole record — the answer at the desk. */
function BorrowerModal({ id, onClose }) {
    const { t } = useTranslation()
    const [data, setData] = useState(null)

    useEffect(() => {
        getBorrowerHistory(id).then(setData).catch(() => setData(null))
    }, [id])

    return (
        <Modal open onClose={onClose} title={data?.borrower?.name || t('library.fields.borrower')}
            size="lg">
            {!data ? <p className="u-muted">{t('common.loading')}</p> : (
                <>
                    <div className="fin-balance-row">
                        <div>
                            <span className="fin-balance-label">{t('library.borrower.out')}</span>
                            {data.open_loans.length}
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('library.borrower.overdue')}</span>
                            <span className={data.overdue.length ? 'fin-owed' : ''}>
                                {data.overdue.length}
                            </span>
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('library.borrower.everBorrowed')}</span>
                            {data.total_borrowed}
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('library.borrower.owed')}</span>
                            {data.owed}
                        </div>
                    </div>

                    {data.block && (
                        <p className="mt-1">
                            <span className="pill fin-status-overdue">
                                {t('library.borrower.blocked')}
                            </span>{' '}{data.block}
                        </p>
                    )}

                    <div className="toolbar-card mb-1-5 mt-1">
                        <div className="toolbar-spacer" />
                        <DocumentActions url={`/imboni/library/borrowers/${id}/`}
                            stem="borrower-record" />
                    </div>

                    <DataTable
                        title={t('library.borrower.history')}
                        icon="history"
                        count={data.loans.length}
                        columns={[
                            { key: 'title', label: t('library.fields.title') },
                            { key: 'issued', label: t('library.fields.issued') },
                            { key: 'due', label: t('library.fields.due') },
                            { key: 'returned', label: t('library.fields.returned') },
                        ]}
                        rows={data.loans.map(l => ({
                            id: l.id,
                            title: l.book_title || l.copy?.book?.title,
                            issued: formatDate(l.issued_at),
                            due: formatDate(l.due_on),
                            returned: l.returned_at ? formatDate(l.returned_at) : '—',
                        }))}
                        emptyTitle={t('library.borrower.nothingYet')}
                        emptyDescription={t('library.borrower.nothingYetDesc')}
                    />
                </>
            )}
        </Modal>
    )
}
