import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageLoading } from '../../components/layout/PageLoading'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DataTable } from '../../components/ui/DataTable'
import { SearchBar } from '../../components/ui/SearchBar'
import { MatronStudentModal } from '../../components/modals/MatronStudentModal'
import { useSchoolBranding } from '../../hooks/useSchoolBranding'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { useToast } from '../../context/ToastContext'
import { getMatronStudents } from '../../api/matron'
import { classLabel } from '../../utils/classes'
import { downloadCsv, printTable } from '../../utils/exportTable'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import '../../styles/pages.css'

/**
 * The boarding roll.
 *
 * The list is fetched ONCE and every filter — house, class, and the search box
 * — runs in the browser over that one array. It used to re-request on every
 * keystroke behind a 300ms debounce, and because the request set the page-level
 * `loading` flag, each keystroke replaced the whole page (sidebar, header,
 * stats and all) with the loading shell. Typing three letters tore the page
 * down three times. Now only the rows change, and they change on the keystroke
 * rather than 300ms after it.
 *
 * The server caps the roll at 500 boarders, which is the whole school for the
 * schools this serves.
 */

function initialsOf(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

/** The one place a student becomes a row, so the table, the CSV and the printed
 *  roll can never list different columns for the same person. */
function toRow(s) {
    return [s.name, s.studentCode, s.classBadge, s.room, s.dormitory, s.boardingType]
}

/**
 * One boarder.
 *
 * The whole row opens the student, because the row is what people aim at after
 * searching for a name. The name is ALSO a real <button>, so the row is not a
 * click target that only a mouse can reach — a div with an onClick is
 * invisible to the keyboard and to a screen reader, and there is nothing else
 * on the row to tab to.
 */
function StudentRow({ student, onOpen }) {
    const { initials, name, studentCode, year, classBadge, room, dormitory, boardingType } = student
    return (
        <tr
            data-year={year}
            data-name={name.toLowerCase()}
            className="row-clickable"
            onClick={() => onOpen(student)}
        >
            <td>
                <div className="stu-cell">
                    <div className="stu-av">{initials}</div>
                    <div>
                        <button type="button" className="stu-name link-button" onClick={() => onOpen(student)}>
                            {name}
                        </button>
                        <div className="stu-id">{studentCode}</div>
                    </div>
                </div>
            </td>
            <td><span className="class-badge">{classBadge}</span></td>
            <td>{room}</td>
            <td>{dormitory}</td>
            <td className="u-capitalize">{boardingType}</td>
        </tr>
    )
}

export function MatronStudents() {
    const { t } = useTranslation()
    const myHouse = useMatronDormitory()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { schoolName, logo } = useSchoolBranding()
    const toast = useToast()

    const [section, setSection] = useState('')
    const [year, setYear] = useState('')
    const [classVal, setClassVal] = useState('')
    const [house, setHouse] = useState('')
    const [search, setSearch] = useState('')
    const [openStudent, setOpenStudent] = useState(null)
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // One request, on mount. Nothing here depends on the filters any more.
    useEffect(() => {
        let cancelled = false
        getMatronStudents()
            .then(data => { if (!cancelled) setStudents(Array.isArray(data) ? data : []) })
            .catch(err => { if (!cancelled) setError(err.message) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])

    const roll = useMemo(() => students.map(s => ({
        id: s.id,
        initials: initialsOf(s.full_name || ''),
        name: s.full_name,
        studentCode: s.student_code,
        year: s.grade,
        classLetter: s.section,
        classBadge: classLabel(s.grade, s.section),
        room: s.room_number,
        dormitory: s.dormitory,
        boardingType: s.boarding_type,
    })), [students])

    // Houses the roll actually contains, so the filter can never offer a
    // dormitory with nobody in it.
    const houses = useMemo(
        () => [...new Set(roll.map(s => s.dormitory).filter(Boolean))].sort(),
        [roll],
    )

    const visibleStudents = useMemo(() => {
        const q = search.trim().toLowerCase()
        return roll.filter(s => {
            if (house && s.dormitory !== house) return false
            if (year && s.year !== year) return false
            if (classVal && s.classLetter !== classVal) return false
            if (!q) return true
            // Name or admission number — the two things written on the list a
            // matron is holding when she searches.
            return (s.name || '').toLowerCase().includes(q)
                || (s.studentCode || '').toLowerCase().includes(q)
        })
    }, [roll, house, year, classVal, search])

    const scopeLabel = house || t('common.allDormitories')

    // The CSV and the printed sheet carry the same headings the table shows,
    // in the reader's language — a roll printed for a Kinyarwanda-speaking
    // matron with English column headings is half-translated.
    const exportColumns = [
        t('common.student'), t('common.admissionNo'), t('common.class'),
        t('common.room'), t('common.dormitory'), t('common.boardingType'),
    ]

    const studentStats = [
        { colorClass: '',        icon: 'groups',       value: visibleStudents.length,                                        label: t('common.totalStudents') },
        { colorClass: 'success', icon: 'home',         value: visibleStudents.filter(s => s.boardingType === 'full').length, label: t('common.fullBoarders')   },
        { colorClass: 'warning', icon: 'wb_sunny',     value: visibleStudents.filter(s => s.boardingType === 'day').length,  label: t('common.dayBoarders')    },
        { colorClass: 'info',    icon: 'meeting_room', value: new Set(visibleStudents.map(s => s.room).filter(Boolean)).size, label: t('common.roomsOccupied') },
    ]

    const listTitle = house
        ? t('matron.students.listTitle', { house })
        : t('matron.students.listTitleNoHouse')

    function handleExport() {
        if (visibleStudents.length === 0) { toast.info(t('common.nothingToExport')); return }
        downloadCsv(listTitle, { columns: exportColumns, rows: visibleStudents.map(toRow) })
    }

    function handlePrint() {
        const opened = printTable({
            title: listTitle,
            subtitle: [scopeLabel, classVal ? `${year}${classVal}` : year, search && `“${search}”`]
                .filter(Boolean).join(' · '),
            columns: exportColumns,
            rows: visibleStudents.map(toRow),
            schoolName: schoolName || 'Imboni',
            logo,
            preparedBy: sessionUser.userName,
            footNote: t('matron.students.printFootNote'),
            signatureLabel: t('matron.students.printSignature'),
        })
        if (!opened) toast.error(t('common.popupBlocked'))
    }

    function clearFilters() {
        setSection(''); setYear(''); setClassVal(''); setHouse(''); setSearch('')
    }

    if (loading) return (
        <PageLoading
            navItems={matronNavItems} secondaryItems={matronSecondaryItems}
            title={t('matron.students.title')}
            user={sessionUser}
        />
    )
    if (error) return <p className="u-pad u-danger">Error: {error}</p>

    return (
        <>
            {openStudent && (
                <MatronStudentModal student={openStudent} onClose={() => setOpenStudent(null)} />
            )}
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('matron.students.title')}
                        subtitle={myHouse
                            ? t('matron.students.subtitle', { house: myHouse, count: visibleStudents.length })
                            : t('matron.students.subtitleNoHouse', { count: visibleStudents.length })}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        {/* Scope: which house, then which class. Both narrow the
                            same roll, so they share one bar rather than sitting
                            in two cards that look like unrelated controls. */}
                        <div className="class-picker mb-5">
                            <div className="class-picker-group">
                                <label className="class-picker-label" htmlFor="matron-house">
                                    {t('common.dormitory')}
                                </label>
                                <select
                                    id="matron-house"
                                    className="picker-select"
                                    value={house}
                                    onChange={e => setHouse(e.target.value)}
                                >
                                    <option value="">{t('common.allDormitories')}</option>
                                    {houses.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            {myHouse && house !== myHouse && (
                                <button className="btn btn-outline btn-sm" onClick={() => setHouse(myHouse)}>
                                    <span className="material-symbols-rounded icon-sm">home</span>
                                    {t('matron.students.myHouse')}
                                </button>
                            )}
                        </div>

                        <ClassPicker
                            section={section} onSectionChange={setSection}
                            year={year} onYearChange={setYear}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <div className="portal-stat-grid mb-5">
                            {studentStats.map((stat, index) => (
                                <StatCard key={index} {...stat} />
                            ))}
                        </div>

                        <div className="toolbar-card">
                            <SearchBar
                                value={search}
                                onChange={setSearch}
                                placeholder={t('matron.students.search')}
                                label={t('matron.students.search')}
                            />
                            <button className="btn btn-outline btn-sm" onClick={handleExport}>
                                <span className="material-symbols-rounded icon-sm">download</span> {t('common.export')}
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={handlePrint}>
                                <span className="material-symbols-rounded icon-sm">print</span> {t('matron.students.printRoll')}
                            </button>
                        </div>

                        <DataTable
                            title={listTitle}
                            data={visibleStudents}
                            columns={[
                                t('common.student'), t('common.class'),
                                t('common.room'), t('common.dormitory'),
                                t('common.boardingType'),
                            ]}
                            renderRow={(student, index) => (
                                <StudentRow key={student.id ?? index} student={student} onOpen={setOpenStudent} />
                            )}
                            emptyIcon="people"
                            emptyTitle={t('common.noStudentsFound')}
                            emptyDesc={t('common.noStudentsFiltered')}
                            onClearFilters={clearFilters}
                        />

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
