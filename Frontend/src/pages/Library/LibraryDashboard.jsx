import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { StatCard } from '../../components/layout/StatCard'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getLibraryDashboard } from '../../api/library'
import { LibraryShell } from './LibraryShell'

/** The desk at a glance: what is out, what is late, what is waiting to be bought. */
export function LibraryDashboard() {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData]       = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getLibraryDashboard()
            .then(setData)
            // 402 means the school is not on the plan; the shell already says
            // so, and a toast on top of it would be shouting the same thing.
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    const stats = [
        { icon: 'menu_book',  value: data?.titles,       label: t('library.stats.titles'),   colorClass: 'info' },
        { icon: 'inventory_2', value: data?.copies,      label: t('library.stats.copies'),   colorClass: '' },
        { icon: 'swap_horiz', value: data?.on_loan,      label: t('library.stats.onLoan'),   colorClass: 'success' },
        { icon: 'schedule',   value: data?.overdue,      label: t('library.stats.overdue'),
          colorClass: data?.overdue ? 'warning' : '' },
    ]

    return (
        <LibraryShell title={t('library.dashboard.title')} subtitle={t('library.dashboard.subtitle')}>
            <div className="portal-stat-grid mb-1-5">
                {stats.map((s, i) => (
                    <StatCard key={i} {...s} value={loading ? '-' : (s.value ?? 0)} />
                ))}
            </div>

            <div className="lib-dash-grid">
                <ListSection
                    icon="event_upcoming"
                    title={t('library.dashboard.dueSoon')}
                    count={loading ? null : t('library.loanCount', { count: data?.due_soon?.length ?? 0 })}
                >
                    {loading ? (
                        <p className="u-muted">{t('common.loading')}</p>
                    ) : !data?.due_soon?.length ? (
                        <EmptyState
                            icon="event_available"
                            title={t('library.dashboard.nothingDue')}
                            description={t('library.dashboard.nothingDueDesc')}
                        />
                    ) : (
                        <ul className="lib-due-list">
                            {data.due_soon.map(loan => (
                                <li key={loan.id} className="lib-due-row">
                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">book</span>
                                    <div className="lib-due-main">
                                        <div className="u-strong u-sm">{loan.book_title}</div>
                                        <div className="text-xs-muted">{loan.borrower_detail?.name}</div>
                                    </div>
                                    <span className="badge">{formatDate(loan.due_on)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </ListSection>

                <ListSection
                    icon="local_fire_department"
                    title={t('library.dashboard.popular')}
                    count={loading ? null : t('library.titleCount', { count: data?.popular?.length ?? 0 })}
                >
                    {loading ? (
                        <p className="u-muted">{t('common.loading')}</p>
                    ) : !data?.popular?.length ? (
                        <EmptyState
                            icon="menu_book"
                            title={t('library.dashboard.noBorrowing')}
                            description={t('library.dashboard.noBorrowingDesc')}
                        />
                    ) : (
                        <ol className="lib-popular-list">
                            {data.popular.map((book, i) => (
                                <li key={book.id} className="lib-popular-row">
                                    <span className="lib-rank">{i + 1}</span>
                                    <div className="lib-due-main">
                                        <div className="u-strong u-sm">{book.title}</div>
                                        <div className="text-xs-muted">{book.author}</div>
                                    </div>
                                    <span className="dt-count">
                                        {t('library.borrowedCount', { count: book.times_borrowed })}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </ListSection>
            </div>

            {/* The two numbers that mean somebody has to do something today. */}
            <div className="lib-action-row mt-1-5">
                <Link to="/library/circulation?status=overdue" className="lib-action-card">
                    <span className="material-symbols-rounded" aria-hidden="true">running_with_errors</span>
                    <div>
                        <div className="lib-action-value">{loading ? '-' : data?.overdue ?? 0}</div>
                        <div className="lib-action-label">{t('library.dashboard.chaseOverdue')}</div>
                    </div>
                </Link>
                <Link to="/library/reservations" className="lib-action-card">
                    <span className="material-symbols-rounded" aria-hidden="true">bookmark</span>
                    <div>
                        <div className="lib-action-value">{loading ? '-' : data?.reservations ?? 0}</div>
                        <div className="lib-action-label">{t('library.dashboard.holdQueue')}</div>
                    </div>
                </Link>
                <Link to="/library/acquisitions" className="lib-action-card">
                    <span className="material-symbols-rounded" aria-hidden="true">shopping_cart</span>
                    <div>
                        <div className="lib-action-value">{loading ? '-' : data?.pending_acquisitions ?? 0}</div>
                        <div className="lib-action-label">{t('library.dashboard.awaitingDecision')}</div>
                    </div>
                </Link>
            </div>
        </LibraryShell>
    )
}
