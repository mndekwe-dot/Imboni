import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '../../components/ui/DataTable'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { StatCard } from '../../components/layout/StatCard'
import { printPdf } from '../../api/documents'
import { getUsageReport, importBooks } from '../../api/library'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { LibraryShell } from './LibraryShell'

/**
 * What the collection is doing, and how to load one it does not have yet.
 *
 * Dead stock is the half nobody asks for and the half that decides next year's
 * acquisition budget: a title that has not left the shelf is money already
 * spent, and knowing which titles those are is what stops the school buying six
 * more of them.
 */
export function LibraryReports() {
    const { t } = useTranslation()
    const toast = useToast()

    const [report, setReport] = useState(null)
    const [range, setRange] = useState({ from: '', to: '' })
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState(null)

    const params = {
        ...(range.from ? { from: range.from } : {}),
        ...(range.to ? { to: range.to } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        getUsageReport(params)
            .then(setReport)
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, range.from, range.to])

    useEffect(() => { load() }, [load])

    async function handleImport(event) {
        const file = event.target.files?.[0]
        // Clear the input straight away, or choosing the same corrected file
        // twice fires no change event and looks like the import is ignoring you.
        event.target.value = ''
        if (!file) return

        setImporting(true)
        setResult(null)
        try {
            const outcome = await importBooks(file)
            setResult(outcome)
            toast.success(t('library.reports.imported', {
                created: outcome.created, updated: outcome.updated,
            }))
            load()
        } catch (error) {
            toast.error(errorMessage(error, t('library.reports.importFailed')))
        } finally {
            setImporting(false)
        }
    }

    return (
        <LibraryShell title={t('library.reports.title')} subtitle={t('library.reports.subtitle')}>
            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="swap_horiz" value={loading ? '-' : report?.total_loans ?? 0}
                    label={t('library.reports.loans')} colorClass="info" />
                <StatCard icon="local_library" value={loading ? '-' : (report?.popular || []).length}
                    label={t('library.reports.titlesMoving')} />
                <StatCard icon="inventory_2" value={loading ? '-' : (report?.dead_stock || []).length}
                    label={t('library.reports.neverBorrowed')}
                    colorClass={(report?.dead_stock || []).length ? 'warning' : ''} />
            </div>

            <div className="toolbar-card mb-1-5">
                <label className="form-group u-inline">
                    <span className="form-label">{t('common.from')}</span>
                    <input className="form-input class-filter-select" type="date"
                        value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
                </label>
                <label className="form-group u-inline">
                    <span className="form-label">{t('common.to')}</span>
                    <input className="form-input class-filter-select" type="date"
                        value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
                </label>
                <div className="toolbar-spacer" />
                <DocumentActions url="/imboni/library/usage/" params={params}
                    stem="library-usage" disabled={loading} />
            </div>

            <DataTable
                title={t('library.reports.mostBorrowed')}
                icon="trending_up"
                count={(report?.popular || []).length}
                columns={[
                    { key: 'title', label: t('library.fields.title') },
                    { key: 'author', label: t('library.fields.author') },
                    { key: 'times', label: t('library.reports.timesOut'), align: 'right' },
                ]}
                rows={(report?.popular || []).map((b, i) => ({
                    id: `${b.copy__book__id}-${i}`,
                    title: b.copy__book__title,
                    author: b.copy__book__author,
                    times: b.times,
                }))}
                emptyTitle={t('library.reports.nothingBorrowed')}
                emptyDescription={t('library.reports.nothingBorrowedDesc')}
            />

            <div className="mt-1-5">
                <ListSection icon="groups" title={t('library.reports.byClass')}
                    count={(report?.by_class || []).length}>
                    {(report?.by_class || []).length === 0 ? (
                        <p className="u-muted">{t('library.reports.nothingBorrowed')}</p>
                    ) : (
                        <ul className="fin-row-list">
                            {(report?.by_class || []).map(c => (
                                <li key={`${c.borrower__student_profile__grade}${c.borrower__student_profile__section}`}
                                    className="fin-row">
                                    <span className="fin-class-chip">
                                        {c.borrower__student_profile__grade}
                                        {c.borrower__student_profile__section}
                                    </span>
                                    <div className="fin-row-main">
                                        <div className="text-xs-muted">
                                            {t('library.reports.loansCount', { count: c.times })}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </ListSection>
            </div>

            <div className="mt-1-5">
                <DataTable
                    title={t('library.reports.neverBorrowed')}
                    icon="inventory_2"
                    count={(report?.dead_stock || []).length}
                    columns={[
                        { key: 'title', label: t('library.fields.title') },
                        { key: 'author', label: t('library.fields.author') },
                        { key: 'shelf', label: t('library.fields.shelf') },
                    ]}
                    rows={(report?.dead_stock || []).map(b => ({
                        id: b.id, title: b.title, author: b.author, shelf: b.shelf,
                    }))}
                    emptyTitle={t('library.reports.everythingMoves')}
                    emptyDescription={t('library.reports.everythingMovesDesc')}
                />
            </div>

            <div className="mt-1-5">
                <ListSection icon="upload_file" title={t('library.reports.import')}>
                    <p className="u-muted">{t('library.reports.importDesc')}</p>

                    <div className="toolbar-card mt-1">
                        <label className="btn btn-primary btn-sm">
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">upload</span>
                            {importing ? t('common.preparing') : t('library.reports.chooseFile')}
                            <input type="file" accept=".csv,text/csv" hidden
                                onChange={handleImport} disabled={importing} />
                        </label>
                        <div className="toolbar-spacer" />
                        {/* The template, so nobody has to guess the columns. */}
                        <DocumentActions url="/imboni/library/import/" stem="catalogue-template"
                            pdf={false} />
                        <button className="btn btn-outline btn-sm"
                            onClick={() => printPdf('/imboni/library/export/catalogue/')}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">print</span>
                            {t('library.reports.printCatalogue')}
                        </button>
                        <DocumentActions url="/imboni/library/export/catalogue/"
                            stem="catalogue" pdf={false} />
                        <DocumentActions url="/imboni/library/export/loans/"
                            stem="loans" pdf={false} />
                    </div>

                    {result && (
                        <div className="card u-banner mt-1">
                            <p className="u-strong">
                                {t('library.reports.importSummary', {
                                    created: result.created, updated: result.updated,
                                    copies: result.copies,
                                })}
                            </p>
                            {result.problems?.length > 0 && (
                                <>
                                    {/* Reported rather than swallowed: a 3,000-row
                                        file with two broken rows should import
                                        2,998 books and say which two failed. */}
                                    <p className="u-muted u-sm mt-1">
                                        {t('library.reports.importProblems', {
                                            count: result.problems.length,
                                        })}
                                    </p>
                                    <ul className="u-muted u-sm">
                                        {result.problems.slice(0, 10).map(p => (
                                            <li key={p.row}>
                                                {t('library.reports.rowError', {
                                                    row: p.row, error: p.error,
                                                })}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}

                    {!result && !importing && (
                        <EmptyState icon="upload_file" title={t('library.reports.importIdle')}
                            description={t('library.reports.importIdleDesc')} />
                    )}
                </ListSection>
            </div>
        </LibraryShell>
    )
}
