import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { Modal } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/DataTable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'
import '../../styles/tables.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getTeacherMyClasses, getTeacherStudents } from '../../api/teacher'

function buildSections(classes) {
    const oLevel = { name: 'O-Level', years: [] }
    const aLevel = { name: 'A-Level', years: [] }
    for (const cls of classes) {
        const grade = parseInt(cls.grade)
        const group = grade <= 3 ? oLevel : aLevel
        const yearName = `S${cls.grade}`
        let yearObj = group.years.find(y => y.name === yearName)
        if (!yearObj) {
            yearObj = { name: yearName, streams: [] }
            group.years.push(yearObj)
        }
        if (!yearObj.streams.includes(cls.section)) yearObj.streams.push(cls.section)
    }
    return [oLevel, aLevel].filter(s => s.years.length > 0)
}

function performanceBadge(pct) {
    if (pct == null) return { label: '—',        cls: 'badge-soft-warning' }
    if (pct >= 75)   return { label: 'Excellent', cls: 'badge-soft-success' }
    if (pct >= 50)   return { label: 'Good',      cls: 'badge-soft-info'    }
    return                  { label: 'Fair',      cls: 'badge-soft-warning' }
}

function attendanceBadge(pct) {
    if (pct == null) return { label: '—',    cls: 'badge-soft-warning' }
    if (pct >= 85)   return { label: `${pct}%`, cls: 'badge-soft-success' }
    if (pct >= 70)   return { label: `${pct}%`, cls: 'badge-soft-warning' }
    return                  { label: `${pct}%`, cls: 'badge-soft-error'   }
}

function StudentRow({ student, onView }) {
    const perf = performanceBadge(student.performance_rate)
    const att  = attendanceBadge(student.attendance_rate)
    return (
        <tr>
            <td>
                <div className="student-info-cell">
                    <div className="student-avatar">{student.initials}</div>
                    <div>
                        <div className="student-name">{student.full_name}</div>
                        <div className="student-id-text">{student.student_code}</div>
                    </div>
                </div>
            </td>
            <td>{student.class_name}</td>
            <td><span className={`badge ${att.cls}`}>{att.label}</span></td>
            <td>
                <span className={`badge ${perf.cls}`}>
                    {perf.label}{student.performance_rate != null ? ` (${student.performance_rate}%)` : ''}
                </span>
            </td>
            <td>
                <button className="btn btn-sm btn-outline" onClick={() => onView(student)}>
                    <span className="material-symbols-rounded icon-sm">visibility</span>
                    View
                </button>
            </td>
        </tr>
    )
}

export function TeacherStudent() {
    const [classes,  setClasses]  = useState([])
    const [sections, setSections] = useState([])
    const [students, setStudents] = useState([])
    const [loading,  setLoading]  = useState(true)

    const [section,    setSection]    = useState('')
    const [year,       setYear]       = useState('')
    const [classVal,   setClassVal]   = useState('')
    const [search,     setSearch]     = useState('')
    const [perfFilter, setPerfFilter] = useState('all')
    const [selected,   setSelected]   = useState(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    // Load classes and initial student list
    useEffect(() => {
        getTeacherMyClasses()
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setClasses(list)
                setSections(buildSections(list))
            })
            .catch(() => {})
        getTeacherStudents()
            .then(data => setStudents(Array.isArray(data) ? data : []))
            .catch(() => setStudents([]))
            .finally(() => setLoading(false))
    }, [])

    // Re-fetch when class filter changes
    useEffect(() => {
        if (loading) return
        const classKey = year && classVal ? `S${year.replace('S', '')}${classVal}` : null
        const cls = classKey ? classes.find(c => c.class_name === classKey) : null
        const params = cls ? { class_id: cls.class_id } : {}
        setLoading(true)
        getTeacherStudents(params)
            .then(data => setStudents(Array.isArray(data) ? data : []))
            .catch(() => setStudents([]))
            .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, classVal])

    // Client-side filters for search and performance
    const visible = students.filter(s => {
        if (section) {
            const clsObj = classes.find(c => c.class_name === s.class_name)
            if (clsObj) {
                const isO = parseInt(clsObj.grade) <= 3
                if (section === 'O-Level' && !isO) return false
                if (section === 'A-Level' && isO)  return false
            }
        }
        if (search) {
            const q = search.toLowerCase()
            if (!s.full_name.toLowerCase().includes(q) && !s.student_code.toLowerCase().includes(q)) return false
        }
        if (perfFilter === 'high'   && (s.performance_rate == null || s.performance_rate < 75))                    return false
        if (perfFilter === 'medium' && (s.performance_rate == null || s.performance_rate < 50 || s.performance_rate >= 75)) return false
        if (perfFilter === 'low'    && (s.performance_rate == null || s.performance_rate >= 50))                   return false
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>

            {selected && (
                <Modal title="Student Profile" icon="person" onClose={() => setSelected(null)}>
                    <div className="student-profile-header">
                        <div className="student-avatar student-profile-avatar">{selected.initials}</div>
                        <div>
                            <div className="student-profile-name">{selected.full_name}</div>
                            <div className="student-profile-code">{selected.student_code}</div>
                        </div>
                    </div>
                    <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                        <div>
                            <div className="detail-label">Class</div>
                            <div className="detail-value">{selected.class_name}</div>
                        </div>
                        <div>
                            <div className="detail-label">Attendance</div>
                            <span className={`badge ${attendanceBadge(selected.attendance_rate).cls}`}>
                                {selected.attendance_rate != null ? `${selected.attendance_rate}%` : '—'}
                            </span>
                        </div>
                        <div>
                            <div className="detail-label">Performance</div>
                            <span className={`badge ${performanceBadge(selected.performance_rate).cls}`}>
                                {selected.performance_rate != null ? `${selected.performance_rate}%` : '—'}
                            </span>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Students"
                        subtitle="View and manage students across your classes"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                    />
                    <DashboardContent>

                        <ClassPicker
                            sections={sections}
                            section={section}   onSectionChange={v => { setSection(v); setYear(''); setClassVal('') }}
                            year={year}         onYearChange={v => { setYear(v); setClassVal('') }}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <div className="search-filter-bar mb-5">
                            <div className="search-input-wrapper">
                                <span className="material-symbols-rounded search-input-icon">search</span>
                                <input
                                    type="text"
                                    className="input search-input"
                                    placeholder="Search by name or student code…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <select className="input input-auto" value={perfFilter} onChange={e => setPerfFilter(e.target.value)}>
                                    <option value="all">All Performance</option>
                                    <option value="high">Excellent (75%+)</option>
                                    <option value="medium">Good (50–74%)</option>
                                    <option value="low">Fair (below 50%)</option>
                                </select>
                            </div>
                        </div>

                        <DataTable
                            title="Student List"
                            data={visible}
                            columns={['Student', 'Class', 'Attendance', 'Performance', 'Actions']}
                            renderRow={(s, i) => <StudentRow key={i} student={s} onView={setSelected} />}
                            emptyIcon="people"
                            emptyTitle={loading ? 'Loading students…' : 'No students found'}
                            emptyDesc="No students match your filters."
                        />

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
