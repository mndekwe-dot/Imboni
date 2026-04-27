import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DataTable } from '../../components/ui/DataTable'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import '../../styles/tables.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const SECTIONS = [
    { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C'] },
    { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['A', 'B', 'C'] },
]

const studentStats = [
    { icon: 'people',       value: '1,245', label: 'Total Students',    trend: '+15 this term',   trendClass: 'positive', colorClass: 'info'    },
    { icon: 'check_circle', value: '1,198', label: 'Active Students',   trend: '96% enrollment',  trendClass: 'positive', colorClass: 'success' },
    { icon: 'person_add',   value: '47',    label: 'New Admissions',    trend: 'This term',       trendClass: '',         colorClass: 'warning' },
    { icon: 'trending_up',  value: '78%',   label: 'Avg Performance',   trend: '+3% improvement', trendClass: 'positive', colorClass: 'success' },
]

const allStudents = [
    { initials: 'UA', name: 'Uwase Amina',     adm: 'ADM-2026-001', year: 'S4', classLetter: 'A', house: 'Bisoke',    t1: '74%', t2: '78%', curr: '81%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'KM', name: 'Mutabazi Kevin',  adm: 'ADM-2026-002', year: 'S3', classLetter: 'B', house: 'Muhabura',  t1: '65%', t2: '68%', curr: '70%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'IM', name: 'Ingabire Marie',  adm: 'ADM-2026-003', year: 'S3', classLetter: 'A', house: 'Bisoke',    t1: '88%', t2: '91%', curr: '90%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'PN', name: 'Nkurunziza Peter',adm: 'ADM-2026-004', year: 'S2', classLetter: 'A', house: 'Sabyinyo',  t1: '55%', t2: '52%', curr: '58%', standClass: 'dos-stand-concern',   standing: 'Concern'   },
    { initials: 'UD', name: 'Umutoni Diane',   adm: 'ADM-2026-005', year: 'S5', classLetter: 'A', house: 'Karisimbi', t1: '79%', t2: '82%', curr: '84%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'JB', name: 'Bizimana James',  adm: 'ADM-2026-006', year: 'S5', classLetter: 'A', house: 'Muhabura',  t1: '61%', t2: '65%', curr: '67%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'HG', name: 'Hakizimana Grace',adm: 'ADM-2026-007', year: 'S1', classLetter: 'A', house: 'Bisoke',    t1: '93%', t2: '95%', curr: '94%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'EN', name: 'Ndagijimana Eric',adm: 'ADM-2026-008', year: 'S1', classLetter: 'B', house: 'Sabyinyo',  t1: '48%', t2: '55%', curr: '59%', standClass: 'dos-stand-concern',   standing: 'Concern'   },
]


const ADMIT_YEARS   = ['S1','S2','S3','S4','S5','S6']
const ADMIT_CLASSES = ['A','B','C']
const ADMIT_HOUSES  = ['Bisoke','Muhabura','Karisimbi','Sabyinyo']

function AddStudentModal({ onClose, onAdd, count }) {
    const [form, setForm] = useState({ name: '', year: 'S1', classLetter: 'A', house: 'Bisoke' })
    const [err, setErr]   = useState({})

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    function handle(e) {
        const { name, value } = e.target
        setForm(p => ({ ...p, [name]: value }))
        if (err[name]) setErr(p => ({ ...p, [name]: '' }))
    }

    function save() {
        if (!form.name.trim()) { setErr({ name: 'Full name is required' }); return }
        const initials = form.name.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        const adm      = `ADM-2026-${String(count + 1).padStart(3, '0')}`
        onAdd({ initials, name: form.name.trim(), adm, year: form.year, classLetter: form.classLetter, house: form.house, t1: 'N/A', t2: 'N/A', curr: 'N/A', standClass: 'dos-stand-good', standing: 'Good' })
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">person_add</span>
                        <h2 className="modal-title">Admit Student</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Full Name *</label>
                        <input className={`form-input${err.name ? ' input-error' : ''}`} name="name" value={form.name} onChange={handle} placeholder="e.g. Uwase Amina" autoFocus />
                        {err.name && <span className="text-destructive" style={{ fontSize: '0.75rem' }}>{err.name}</span>}
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Year</label>
                            <select className="form-input" name="year" value={form.year} onChange={handle}>
                                {ADMIT_YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Class</label>
                            <select className="form-input" name="classLetter" value={form.classLetter} onChange={handle}>
                                {ADMIT_CLASSES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Dormitory</label>
                        <select className="form-input" name="house" value={form.house} onChange={handle}>
                            {ADMIT_HOUSES.map(h => <option key={h}>{h}</option>)}
                        </select>
                    </div>
                </div>
                <div className="modal-footer">
                    <div className="modal-footer-row">
                        <span className="modal-footer-hint">Scores can be entered later from the Results page.</span>
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={save}>Admit</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StudentRow({ initials, name, adm, house, t1, t2, curr, standClass, standing }) {
    return (
        <tr>
            <td><div className="tm-teacher-cell"><div className="tm-av">{initials}</div><span>{name}</span></div></td>
            <td>{adm}</td><td>{house}</td><td>{t1}</td><td>{t2}</td><td>{curr}</td>
            <td><span className={standClass}>{standing}</span></td>
            <td><button className="tm-btn">View</button></td>
        </tr>
    )
}

export function DosStudents() {
    const [students, setStudents] = useState(allStudents)
    const [section, setSection]   = useState('')
    const [year, setYear]         = useState('')
    const [classVal, setClassVal] = useState('')
    const [search, setSearch]     = useState('')
    const [showAdd, setShowAdd]   = useState(false)

    const filtered = students.filter(s => {
        if (year && s.year !== year) return false
        if (classVal && s.classLetter !== classVal) return false
        if (search) {
            const q = search.toLowerCase()
            if (!s.name.toLowerCase().includes(q) && !s.adm.toLowerCase().includes(q)) return false
        }
        return true
    })

    const classLabel = year && classVal ? `${year}${classVal}` : year || 'All Classes'

    function handleExport() {
        if (!filtered.length) return
        const header = 'Name,Adm No,Year,Class,Dormitory,Term 1,Term 2,Current,Standing'
        const body   = filtered.map(s =>
            `"${s.name}","${s.adm}",${s.year},${s.classLetter},${s.house},${s.t1},${s.t2},${s.curr},${s.standing}`
        ).join('\n')
        const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a'); a.href = url; a.download = `students-${classLabel}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Student Management</h1>
                            <p>Monitor student enrollment and performance</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <Link to="/profile" className="header-user-av dos-av">JN</Link>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {studentStats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <ClassPicker
                            sections={SECTIONS}
                            section={section}
                            onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                            year={year}
                            onYearChange={y => { setYear(y); setClassVal('') }}
                            classVal={classVal}
                            onClassChange={setClassVal}
                        />

                        {/* Toolbar */}
                        <div className="toolbar-card">
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input placeholder="Search by name or admission number..." value={search} onChange={e => setSearch(e.target.value)} />
                                {search && <button className="toolbar-search-clear" onClick={() => setSearch('')}><span className="material-symbols-rounded">close</span></button>}
                            </div>
                            <div className="toolbar-spacer" />
                            <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!filtered.length}><span className="material-symbols-rounded icon-sm">download</span> Export</button>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><span className="material-symbols-rounded icon-sm">person_add</span> Add Student</button>
                        </div>

                        <DataTable
                            title={`${classLabel} — Students`}
                            data={filtered}
                            columns={['Student','Adm No.','Dormitory','Term 1','Term 2','Current','Standing','Actions']}
                            renderRow={s => <StudentRow key={s.adm} {...s} />}
                            emptyIcon="people"
                            emptyTitle="No students found"
                            emptyDesc={search ? `No results for "${search}"` : `No students found for ${classLabel}.`}
                            onClearFilters={search ? () => setSearch('') : undefined}
                        />
                    </DashboardContent>
                </main>
            </div>
            {showAdd && (
                <AddStudentModal
                    count={students.length}
                    onClose={() => setShowAdd(false)}
                    onAdd={s => setStudents(prev => [...prev, s])}
                />
            )}
        </>
    )
}
