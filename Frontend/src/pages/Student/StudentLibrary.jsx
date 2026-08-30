import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { SearchBar } from '../../components/ui/SearchBar'
import { TabGroup } from '../../components/ui/TabGroup'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useLibraryFeature } from '../../hooks/useLibraryFeature'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { cancelReservation, getCatalogue, getMyLibrary, reserveBook } from '../../api/library'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/tables.css'
import '../../styles/library.css'

/**
 * The library, as a student sees it: what is on the shelf, and what they have.
 *
 * Read-only apart from joining and leaving a queue. Borrowing happens at the
 * desk with a physical book in hand, so there is no "borrow" button here that
 * could promise something the shelf cannot deliver.
 */
export function StudentLibrary() {
    const { t } = useTranslation()
    const toast = useToast()
    const { notifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { enabled, loading: checking } = useLibraryFeature()

    const [tab, setTab]         = useState('mine')
    const [search, setSearch]   = useState('')
    const [books, setBooks]     = useState([])
    const [mine, setMine]       = useState(null)
    const [loading, setLoading] = useState(true)

    const loadMine = useCallback(() => {
        getMyLibrary()
            .then(setMine)
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
    }, [toast, t])

    useEffect(() => {
        if (enabled !== true) return
        setLoading(true)
        Promise.all([getCatalogue(), getMyLibrary()])
            .then(([catalogue, me]) => {
                setBooks(Array.isArray(catalogue) ? catalogue : [])
                setMine(me)
            })
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [enabled, toast, t])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return books
        return books.filter(b =>
            (b.title || '').toLowerCase().includes(q)
            || (b.author || '').toLowerCase().includes(q)
            || (b.subject || '').toLowerCase().includes(q))
    }, [books, search])

    const openLoans = (mine?.loans || []).filter(l => l.status !== 'returned')
    const overdue   = openLoans.filter(l => l.status === 'overdue')

    async function handleReserve(book) {
        try {
            await reserveBook(book.id)
            loadMine()
            toast.success(t('library.student.reserved', { title: book.title }))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    async function handleCancel(res) {
        try {
            await cancelReservation(res.id)
            loadMine()
            toast.success(t('library.reservations.cancelled'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('library.student.title')}
                        subtitle={t('library.student.subtitle')}
                        {...sessionUser}
                        notifications={notifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* null means "still asking", and must not read as "no":
                            telling a paying school it has not paid is worse
                            than a moment of blank content. */}
                        {enabled === false ? (
                            <EmptyState
                                icon="local_library"
                                title={t('library.student.unavailable')}
                                description={t('library.student.unavailableDesc')}
                            />
                        ) : checking ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : (
                            <>
                                <div className="portal-stat-grid mb-1-5">
                                    <StatCard icon="book" value={loading ? '-' : openLoans.length}
                                        label={t('library.student.borrowed')} colorClass="info" />
                                    <StatCard icon="schedule" value={loading ? '-' : overdue.length}
                                        label={t('library.stats.overdue')}
                                        colorClass={overdue.length ? 'warning' : ''} />
                                    <StatCard icon="bookmark"
                                        value={loading ? '-' : (mine?.reservations?.length ?? 0)}
                                        label={t('library.student.reservations')} />
                                    <StatCard icon="inventory_2" value={loading ? '-' : (mine?.limit ?? '-')}
                                        label={t('library.student.limit')} />
                                </div>

                                <TabGroup
                                    tabs={[
                                        { key: 'mine', label: t('library.student.myBooks'), icon: 'book',
                                          count: openLoans.length },
                                        { key: 'browse', label: t('library.student.browse'),
                                          icon: 'search' },
                                    ]}
                                    value={tab}
                                    onChange={setTab}
                                    label={t('library.student.title')}
                                    idPrefix="stu-lib-"
                                />

                                {tab === 'mine' && (
                                    <div id="stu-lib-panel-mine" role="tabpanel"
                                        aria-labelledby="stu-lib-tab-mine">
                                        <MyLoans loans={openLoans} loading={loading} />
                                        <MyReservations
                                            reservations={mine?.reservations || []}
                                            loading={loading}
                                            onCancel={handleCancel}
                                        />
                                    </div>
                                )}

                                {tab === 'browse' && (
                                    <div id="stu-lib-panel-browse" role="tabpanel"
                                        aria-labelledby="stu-lib-tab-browse">
                                        <div className="toolbar-card mb-1-5">
                                            <SearchBar value={search} onChange={setSearch}
                                                placeholder={t('library.student.searchPlaceholder')} />
                                        </div>
                                        <ListSection
                                            icon="menu_book"
                                            title={t('library.student.catalogue')}
                                            count={loading ? null
                                                : t('library.titleCount', { count: visible.length })}
                                        >
                                            {loading ? (
                                                <p className="u-muted">{t('common.loading')}</p>
                                            ) : visible.length === 0 ? (
                                                <EmptyState
                                                    icon={search ? 'search_off' : 'menu_book'}
                                                    title={search
                                                        ? t('common.noResults', { query: search })
                                                        : t('library.student.emptyCatalogue')}
                                                    description={search
                                                        ? t('common.trySearch')
                                                        : t('library.student.emptyCatalogueDesc')}
                                                    action={search
                                                        ? { label: t('common.clear'), icon: 'close',
                                                            onClick: () => setSearch('') }
                                                        : undefined}
                                                />
                                            ) : (
                                                <div className="lib-book-grid">
                                                    {visible.map(book => (
                                                        <CatalogueCard key={book.id} book={book}
                                                            onReserve={() => handleReserve(book)} />
                                                    ))}
                                                </div>
                                            )}
                                        </ListSection>
                                    </div>
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}

function MyLoans({ loans, loading }) {
    const { t } = useTranslation()
    return (
        <ListSection
            className="mb-1-5"
            icon="book"
            title={t('library.student.myBooks')}
            count={loading ? null : t('library.loanCount', { count: loans.length })}
        >
            {loading ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : loans.length === 0 ? (
                <EmptyState
                    icon="book"
                    title={t('library.student.nothingOut')}
                    description={t('library.student.nothingOutDesc')}
                />
            ) : (
                <ul className="lib-loan-list">
                    {loans.map(loan => (
                        <li key={loan.id}
                            className={`lib-loan-row${loan.status === 'overdue' ? ' overdue' : ''}`}>
                            <span className={`lib-loan-icon${loan.status === 'overdue' ? ' overdue' : ''}`}
                                aria-hidden="true">
                                <span className="material-symbols-rounded">
                                    {loan.status === 'overdue' ? 'running_with_errors' : 'book'}
                                </span>
                            </span>
                            <div className="lib-loan-main">
                                <div className="u-strong u-sm">{loan.book_title}</div>
                                <div className="text-xs-muted">{loan.book_author}</div>
                            </div>
                            <div className="lib-loan-due">
                                <span className={loan.status === 'overdue' ? 'lib-stock-none' : 'text-xs-muted'}>
                                    {loan.status === 'overdue'
                                        ? t('library.circulation.daysLate', { count: loan.days_late })
                                        : t('library.circulation.dueOn', { date: formatDate(loan.due_on) })}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </ListSection>
    )
}

function MyReservations({ reservations, loading, onCancel }) {
    const { t } = useTranslation()
    if (loading || reservations.length === 0) return null

    return (
        <ListSection
            icon="bookmark"
            title={t('library.student.reservations')}
            count={t('library.reservationCount', { count: reservations.length })}
        >
            <ul className="lib-loan-list">
                {reservations.map(res => (
                    <li key={res.id} className="lib-loan-row">
                        <span className="lib-rank">{res.position ?? '·'}</span>
                        <div className="lib-loan-main">
                            <div className="u-strong u-sm">{res.book_title}</div>
                            <div className="text-xs-muted">
                                {res.status === 'ready'
                                    ? t('library.student.readyToCollect', {
                                        date: formatDate(res.expires_on) })
                                    : t('library.student.queuePosition', { position: res.position })}
                            </div>
                        </div>
                        <div className="lib-loan-actions">
                            <button className="btn btn-outline btn-sm" onClick={() => onCancel(res)}>
                                {t('common.cancel')}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </ListSection>
    )
}

function CatalogueCard({ book, onReserve }) {
    const { t } = useTranslation()
    const onShelf = book.available_copies > 0

    return (
        <article className="lib-book-card">
            <div className="lib-book-open lib-book-static">
                <span className="lib-book-spine" aria-hidden="true">
                    <span className="material-symbols-rounded">menu_book</span>
                </span>
                <span className="lib-book-body">
                    <span className="lib-book-title">{book.title}</span>
                    <span className="lib-book-author">{book.author || t('library.fields.unknownAuthor')}</span>
                    <span className="lib-book-meta">
                        <span className="badge">{t(`library.categories.${book.category}`)}</span>
                        {book.shelf && <span className="text-xs-muted">{book.shelf}</span>}
                    </span>
                </span>
            </div>
            <div className="lib-book-stock">
                <span className={onShelf ? 'lib-stock-ok' : 'lib-stock-none'}>
                    {onShelf
                        ? t('library.student.onShelf', { count: book.available_copies })
                        : t('library.student.allOut')}
                </span>
                {/* Reserving a book that is on the shelf is refused by the
                    server -- it can just be borrowed -- so it is not offered. */}
                {!onShelf && (
                    <button className="btn btn-outline btn-sm" onClick={onReserve}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">bookmark_add</span>
                        {t('library.student.reserve')}
                    </button>
                )}
            </div>
        </article>
    )
}
