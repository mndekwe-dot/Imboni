import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { OfflineIndicator } from '../../components/ui/OfflineIndicator'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'
import '../../styles/tables.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { classLabel, sectionsFromClasses } from '../../utils/classes'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import {
    getTeacherMyClasses,
    getTeacherAttendanceStats,
    getTeacherAttendanceStudents,
    markTeacherAttendance,
} from '../../api/teacher'

const STATUS_COLORS = {
    present: 'var(--success, #16a34a)',
    absent:  'var(--danger,  #dc2626)',
    late:    'var(--warning, #d97706)',
    excused: 'var(--primary, #2563eb)',
}

const STATUS_LABELS = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' }

function todayISO() {
    return new Date().toISOString().split('T')[0]
}

export function TeacherAttendance() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    const [section, setSection]   = useState('')
    const [year, setYear]         = useState('')
    const [classVal, setClassVal] = useState('')
    const [selectedDate, setSelectedDate] = useState(todayISO())

    const { config } = useSchoolConfig()
    const [myClasses, setMyClasses]   = useState([])
    // Rebuilt when either the classes or the school's configuration arrives —
    // the config loads asynchronously, so deriving this once inside the fetch
    // would group years before the section names were known.
    const sections = useMemo(() => sectionsFromClasses(myClasses, config), [myClasses, config])
    const [classIdMap, setClassIdMap] = useState({})

    const [students, setStudents] = useState([])
    const [stats, setStats]       = useState(null)
    const [attendance, setAttendance] = useState({})

    const [loadingClasses,  setLoadingClasses]  = useState(true)
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError]   = useState(null)
    const [saved, setSaved]   = useState(false)

    const classKey        = year && classVal ? `${year}${classVal}` : ''
    const selectedClassId = classIdMap[classKey] ?? null

    useEffect(() => {
        async function init() {
            try {
                const res = await getTeacherMyClasses()
                const seen = new Set()
                const unique = []
                for (const cls of res) {
                    const key = String(cls.class_id)
                    if (!seen.has(key)) { seen.add(key); unique.push(cls) }
                }
                setMyClasses(unique)
                const map = {}
                unique.forEach(c => { map[classLabel(c.grade, c.section)] = c.class_id })
                setClassIdMap(map)
            } catch {
                setError(t('teacher.attendance.loadClassesFailed'))
            } finally {
                setLoadingClasses(false)
            }
        }
        init()
    }, [])

    useEffect(() => {
        if (!selectedClassId) {
            setStudents([])
            setStats(null)
            setAttendance({})
            return
        }
        async function loadAttendance() {
            setLoadingStudents(true)
            setError(null)
            setSaved(false)
            try {
                const params = { class_id: selectedClassId, date: selectedDate }
                const [stuRes, statsRes] = await Promise.all([
                    getTeacherAttendanceStudents(params),
                    getTeacherAttendanceStats(params),
                ])
                setStudents(stuRes)
                setStats(statsRes)
                const init = {}
                stuRes.forEach(s => {
                    init[s.student_id] = { status: s.status ?? 'present', notes: s.notes ?? '' }
                })
                setAttendance(init)
            } catch {
                setError(t('teacher.attendance.loadDataFailed'))
            } finally {
                setLoadingStudents(false)
            }
        }
        loadAttendance()
    }, [selectedClassId, selectedDate])

    function getStatus(id) { return attendance[id]?.status ?? 'present' }
    function getNotes(id)  { return attendance[id]?.notes  ?? '' }

    function setStudentStatus(id, status) {
        setAttendance(prev => ({ ...prev, [id]: { ...prev[id], status } }))
    }
    function setStudentNotes(id, notes) {
        setAttendance(prev => ({ ...prev, [id]: { ...prev[id], notes } }))
    }
    function markAllPresent() {
        const next = {}
        students.forEach(s => { next[s.student_id] = { status: 'present', notes: getNotes(s.student_id) } })
        setAttendance(next)
    }

    async function handleSave() {
        if (!selectedClassId || !students.length || saving) return
        setSaving(true)
        setError(null)
        setSaved(false)
        try {
            const records = students.map(s => ({
                student_id: s.student_id,
                status: getStatus(s.student_id),
                notes:  getNotes(s.student_id),
            }))
            const res = await markTeacherAttendance({ class_id: selectedClassId, date: selectedDate, records })
            if (res?.queued) {
                // No connection — the register is in the offline outbox and
                // will sync automatically when we're back online.
                setSaved('offline')
            } else {
                try {
                    const statsRes = await getTeacherAttendanceStats({ class_id: selectedClassId, date: selectedDate })
                    setStats(statsRes)
                } catch { /* stats refresh is cosmetic — don't undo the save */ }
                setSaved(true)
            }
        } catch {
            setError(t('teacher.attendance.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    const presentCount = students.filter(s => getStatus(s.student_id) === 'present').length
    const absentCount  = students.filter(s => getStatus(s.student_id) === 'absent').length
    const lateCount    = students.filter(s => getStatus(s.student_id) === 'late').length

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('teacher.attendance.title')}
                        subtitle={t('teacher.attendance.subtitle')}
                        userName={fullName}
                        userRole={t('roles.teacher')}
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loadingClasses ? (
                            <EmptyState icon="sync" title={t('common.loadingClasses')} description={t('teacher.attendance.fetchingClasses')} />
                        ) : (
                            <>
                                <ClassPicker
                                    sections={sections}
                                    section={section}
                                    onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                                    year={year}
                                    onYearChange={y => { setYear(y); setClassVal('') }}
                                    classVal={classVal}
                                    onClassChange={setClassVal}
                                />

                                <div className="toolbar-card">
                                    <button className="btn btn-outline select-xs" onClick={markAllPresent} disabled={!classKey || loadingStudents}>
                                        <span className="material-symbols-rounded icon-sm">done_all</span>
                                        Mark All Present
                                    </button>
                                    <OfflineIndicator />
                                    <div className="toolbar-spacer" />
                                    <input
                                        type="date"
                                        className="input input-auto select-xs"
                                        value={selectedDate}
                                        max={todayISO()}
                                        onChange={e => setSelectedDate(e.target.value)}
                                    />
                                </div>

                                {error && (
                                    <div className="alert alert-danger">{error}</div>
                                )}
                                {saved === true && (
                                    <div className="alert alert-success">Attendance saved successfully.</div>
                                )}
                                {saved === 'offline' && (
                                    <div className="alert alert-success">
                                        Attendance saved offline. It will sync automatically when you're back online.
                                    </div>
                                )}

                                {!classKey ? (
                                    <EmptyState icon="fact_check" title={t('common.noClassSelected')} description={t('teacher.attendance.pickerHintAttendance')} />
                                ) : loadingStudents ? (
                                    <EmptyState icon="sync" title="Loading…" description={`Fetching students for ${classKey}.`} />
                                ) : (
                                    <>
                                        <div className="mini-stats-row">
                                            {[
                                                { label: 'Present',     value: presentCount,         color: STATUS_COLORS.present },
                                                { label: 'Absent',      value: absentCount,          color: STATUS_COLORS.absent  },
                                                { label: 'Late',        value: lateCount,            color: STATUS_COLORS.late    },
                                                { label: 'Total',       value: students.length,      color: 'var(--primary)'     },
                                                { label: 'Weekly Rate', value: stats ? `${stats.weekly_rate}%` : '-', color: 'var(--primary)' },
                                            ].map(s => (
                                                <div key={s.label} className="mini-stat">
                                                    <div className="mini-stat-value">{s.value}</div>
                                                    <div className="mini-stat-label">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <DataTable
                                            title={`${classKey} Attendance`}
                                            data={students}
                                            columns={['Student', 'Status', 'Notes']}
                                            renderRow={s => (
                                                <tr key={s.student_id}>
                                                    <td>
                                                        <div className="dt-cell-user">
                                                            <div className="dt-avatar">{s.initials}</div>
                                                            <div>
                                                                <div className="dt-name">{s.full_name}</div>
                                                                <div className="dt-sub">{s.student_code}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="input input-auto"
                                                            value={getStatus(s.student_id)}
                                                            onChange={e => setStudentStatus(s.student_id, e.target.value)}
                                                            style={{ color: STATUS_COLORS[getStatus(s.student_id)] }}
                                                        >
                                                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                                                <option key={val} value={val}>{label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            placeholder={t('common.notesOptional')}
                                                            value={getNotes(s.student_id)}
                                                            onChange={e => setStudentNotes(s.student_id, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                            emptyIcon="people"
                                            emptyTitle={t('teacher.attendance.noStudents')}
                                            emptyDesc={`No students are enrolled in ${classKey} this term.`}
                                        />

                                        <div className="modal-confirm-actions">
                                            <button className="btn btn-outline" onClick={() => {
                                                const reset = {}
                                                students.forEach(s => { reset[s.student_id] = { status: s.status ?? 'present', notes: s.notes ?? '' } })
                                                setAttendance(reset)
                                            }}>Reset</button>
                                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                                <span className="material-symbols-rounded icon-sm">save</span>
                                                {saving ? 'Saving…' : 'Save Attendance'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
