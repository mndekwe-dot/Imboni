import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { Timetable } from '../../components/timetable/Timetable'
import { getThisMonday } from '../../components/timetable/dateUtils'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import { getMyChildren, getChildTimetable } from '../../api/parent'
import { toList } from '../../api/client'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'

/** Each linked child's class week, read from the timetable the DOS built. */
export function ParentTimetable() {
    const { t } = useTranslation()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())
    const [children,      setChildren]      = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading,       setLoading]       = useState(true)
    const [slots,         setSlots]         = useState(null)

    useEffect(() => {
        getMyChildren()
            .then(d => setChildren(toList(d)))
            .catch(e => toast.error(errorMessage(e, 'Could not load your children.')))
            .finally(() => setLoading(false))
    }, [toast])

    const child = children[selectedIndex]

    useEffect(() => {
        if (!child) return
        let live = true
        getChildTimetable(child.id)
            // The class is already in the heading; the second line of each lesson
            // is its teacher, so the class name is left off the rows.
            .then(d => { if (live) setSlots(toList(d).map(s => ({ ...s, class_name: '' }))) })
            .catch(e => {
                if (!live) return
                setSlots([])
                toast.error(errorMessage(e, 'Could not load the timetable.'))
            })
        return () => { live = false }
    }, [child, toast])

    function pick(index) {
        setSlots(null)
        setSelectedIndex(index)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('parent.timetable.title')}
                        subtitle={t('parent.timetable.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : children.length === 0 ? (
                            <p className="u-pad u-muted">No children linked to your account yet.</p>
                        ) : (
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        {child.student_name} (Class {child.grade}{child.section})
                                    </h2>
                                    {children.length > 1 && (
                                        <div className="flex-row-gap-sm">
                                            <label className="form-label mb-0" htmlFor="parent-timetable-child">Child:</label>
                                            <select
                                                id="parent-timetable-child"
                                                className="form-input u-w-auto"
                                                value={selectedIndex}
                                                onChange={e => pick(Number(e.target.value))}
                                            >
                                                {children.map((c, i) => (
                                                    <option key={c.id} value={i}>
                                                        {c.student_name} ({c.grade}{c.section})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="card-content">
                                    {slots === null ? (
                                        <p className="u-pad u-muted">{t('common.loading')}</p>
                                    ) : (
                                        <Timetable
                                            type="teacher"
                                            teacherSlots={slots}
                                            freeLabel=""
                                            currentMonday={currentMonday}
                                            onWeekChange={setCurrentMonday}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
