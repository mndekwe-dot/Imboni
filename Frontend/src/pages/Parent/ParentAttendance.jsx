import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { AttendanceRecord } from '../../components/attendance/AttendanceRecord'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import {
    getMyChildren, getChildAttendanceStats, getChildAttendanceCalendar,
} from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'

const toList = d => Array.isArray(d) ? d : (d?.results ?? [])

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function AttendancePanel({ childId }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [stats,   setStats]   = useState(null)
    const [loading, setLoading] = useState(true)

    // Keyed by child in the parent, so a new child is a fresh panel.
    useEffect(() => {
        getChildAttendanceStats(childId)
            .then(setStats)
            .catch(e => toast.error(errorMessage(e, t('attendance.loadFailed'))))
            .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [childId])

    const loadMonth = useCallback(
        (year, month) => getChildAttendanceCalendar(childId, month, year).then(toList),
        [childId],
    )

    return <AttendanceRecord stats={stats} loading={loading} loadMonth={loadMonth} />
}

export function ParentAttendance() {
    const toast = useToast()
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [children,  setChildren]  = useState([])
    const [activeIdx, setActiveIdx] = useState(0)
    const [loading,   setLoading]   = useState(true)

    useEffect(() => {
        getMyChildren()
            .then(d => setChildren(toList(d)))
            .catch(e => toast.error(errorMessage(e, "Could not load this page's data.")))
            .finally(() => setLoading(false))
    }, [toast])

    const child = children[activeIdx]

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('parent.attendance.title')}
                        subtitle={t('parent.attendance.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    {!loading && children.length > 0 && (
                        <div className="child-switcher-bar">
                            <span className="child-switcher-label">Child:</span>
                            {children.map((c, i) => (
                                <button key={c.id}
                                    className={`child-tab${i === activeIdx ? ' active' : ''}`}
                                    onClick={() => setActiveIdx(i)}>
                                    <div className="child-tab-avatar">{initials(c.student_name)}</div>
                                    <span className="child-tab-name">{c.student_name}</span>
                                    <span className="child-tab-grade">&middot; {c.grade}{c.section}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <DashboardContent>
                        {loading ? (
                            <p className="u-pad u-muted">Loading…</p>
                        ) : !child ? (
                            <p className="u-pad u-muted">No children linked to your account yet.</p>
                        ) : (
                            <AttendancePanel key={child.id} childId={child.id} />
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
