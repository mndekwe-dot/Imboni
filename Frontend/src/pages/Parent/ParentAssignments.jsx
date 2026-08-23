import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DataTable } from '../../components/ui/DataTable'
import { StatCard } from '../../components/layout/StatCard'
import { FilterBar } from '../../components/ui/FilterBar'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import { getMyChildren, getChildAssignments } from '../../api/parent'
import { formatDate } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

const toList = d => Array.isArray(d) ? d : (d?.results ?? [])

/* Each status gets the same badge class the other portals use for that state,
   so "overdue" looks the same to a parent as it does to their child. */
const STATUS_CLASS = {
    graded:    'badge-soft-success',
    submitted: 'badge-soft-info',
    late:      'badge-soft-warning',
    overdue:   'badge-soft-destructive',
    pending:   'badge-secondary',
}

const FILTERS = ['all', 'pending', 'overdue', 'submitted', 'graded']

/**
 * A parent's view of their child's homework.
 *
 * Parents could already see results, attendance and behaviour, but not the
 * assignments themselves - which is the thing most often asked about at home,
 * and the one that arrives weekly rather than once a term. The marks here are
 * per assignment, as each is entered, so a parent sees a problem while there
 * is still time to do something about it rather than at the end of term.
 */
export function ParentAssignments() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()

    const [children,      setChildren]      = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [assignments,   setAssignments]   = useState([])
    const [loading,       setLoading]       = useState(true)
    const [loadingChild,  setLoadingChild]  = useState(false)
    const [error,         setError]         = useState(null)
    const [filter,        setFilter]        = useState('all')

    useEffect(() => {
        getMyChildren()
            .then(d => setChildren(toList(d)))
            .catch(() => setError(t('parent.assignments.loadFailed')))
            .finally(() => setLoading(false))
    }, [t])

    const child = children[selectedIndex]

    useEffect(() => {
        if (!child) return
        let alive = true
        setLoadingChild(true)
        getChildAssignments(child.id)
            .then(d => alive && setAssignments(toList(d)))
            .catch(() => alive && setError(t('parent.assignments.loadFailed')))
            .finally(() => alive && setLoadingChild(false))
        return () => { alive = false }
    }, [child, t])

    const visible = filter === 'all'
        ? assignments
        : assignments.filter(a => a.status === filter)

    /* Counted over everything, not the filtered view: a tile that changed with
       the filter would be measuring the filter, not the child. */
    const graded    = assignments.filter(a => a.status === 'graded')
    const needsWork = assignments.filter(a => a.status === 'pending' || a.status === 'overdue')
    const average   = graded.length
        ? Math.round(graded.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / graded.length)
        : null

    const filterOptions = FILTERS.map(key => ({
        key,
        label: t(`parent.assignments.filter.${key}`),
        count: key === 'all' ? undefined : assignments.filter(a => a.status === key).length,
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('parent.assignments.title')}
                        subtitle={t('parent.assignments.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {error && (
                            <div className="alert alert-danger u-mb">
                                <span className="material-symbols-rounded alert-icon">error</span>
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : children.length === 0 ? (
                            <p className="u-pad u-muted">{t('parent.noChildren')}</p>
                        ) : (
                            <>
                                {children.length > 1 && (
                                    <div className="card u-mb">
                                        <div className="card-content flex-row-gap-sm">
                                            <label className="form-label mb-0" htmlFor="parent-assignments-child">
                                                {t('parent.child')}
                                            </label>
                                            <select
                                                id="parent-assignments-child"
                                                className="form-input u-w-auto"
                                                value={selectedIndex}
                                                onChange={e => setSelectedIndex(Number(e.target.value))}
                                            >
                                                {children.map((c, i) => (
                                                    <option key={c.id} value={i}>
                                                        {c.student_name} ({c.grade}{c.section})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="portal-stat-grid mb-1-5">
                                    <StatCard icon="assignment" value={assignments.length}
                                        label={t('parent.assignments.statTotal')} />
                                    <StatCard icon="pending_actions" value={needsWork.length}
                                        label={t('parent.assignments.statOutstanding')}
                                        colorClass={needsWork.length ? 'warning' : ''} />
                                    <StatCard icon="grading" value={graded.length}
                                        label={t('parent.assignments.statMarked')} colorClass="success" />
                                    <StatCard icon="percent"
                                        value={average === null ? '—' : `${average}%`}
                                        label={t('parent.assignments.statAverage')} />
                                </div>

                                <div className="u-mb">
                                    <FilterBar options={filterOptions} active={filter} onChange={setFilter} />
                                </div>

                                {loadingChild ? (
                                    <p className="u-pad u-muted">{t('common.loading')}</p>
                                ) : (
                                    <DataTable
                                        title={t('parent.assignments.tableTitle', {
                                            name: child?.student_name ?? '',
                                        })}
                                        data={visible}
                                        columns={[
                                            { label: t('common.title')    },
                                            { label: t('common.subject')  },
                                            { label: t('roles.teacher')   },
                                            { label: t('parent.assignments.due')    },
                                            { label: t('common.status')   },
                                            { label: t('parent.assignments.score')  },
                                        ]}
                                        emptyIcon="assignment"
                                        emptyTitle={t('parent.assignments.emptyTitle')}
                                        emptyDesc={filter === 'all'
                                            ? t('parent.assignments.emptyDesc')
                                            : t('parent.assignments.emptyFiltered')}
                                        onClearFilters={filter === 'all' ? undefined : () => setFilter('all')}
                                        renderRow={a => (
                                            <tr key={a.id}>
                                                <td>
                                                    <div className="u-strong">{a.title}</div>
                                                    {a.mode === 'online' && (
                                                        <span className="badge badge-soft-info">
                                                            {t('parent.assignments.onlineQuiz')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{a.subject}</td>
                                                <td>{a.teacher}</td>
                                                <td>{formatDate(a.due_date)}</td>
                                                <td>
                                                    <span className={`badge ${STATUS_CLASS[a.status] || 'badge-secondary'}`}>
                                                        {t(`parent.assignments.filter.${a.status}`, a.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {/* A mark exists only once it has been entered; an
                                                        unmarked assignment shows a dash, never a zero. */}
                                                    {a.score === null || a.score === undefined
                                                        ? <span className="u-muted">—</span>
                                                        : <span className="u-strong">{a.score}/{a.max_score}</span>}
                                                </td>
                                            </tr>
                                        )}
                                    />
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
