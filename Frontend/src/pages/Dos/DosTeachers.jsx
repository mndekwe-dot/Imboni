import { useState, useRef, useEffect } from 'react'
import { DataTable } from '../../components/ui/DataTable'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Constants ─────────────────────────────────────────────────────────────────
const SUBJECTS = ['Mathematics','English','Biology','Chemistry','Physics','History','Geography','Kinyarwanda','CRE','Art & Design']
const TYPES    = ['Full-Time','Part-Time']

const AVATAR_COLORS = ['#003d7a','#10b981','#f59e0b','#6366f1','#ef4444','#0891b2','#7c3aed','#be185d']
function avatarColor(name) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }
function initials(name)    { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }

const INITIAL_TEACHERS = [
    { id:'TST-001', name:'Claudine Umutoni',     subject:'English',     type:'Full-Time', classes:['S1A','S3A'],        status:'Active' },
    { id:'TST-002', name:'Pacifique Rurangwa',   subject:'Mathematics', type:'Full-Time', classes:['S2A','S2B'],        status:'Active' },
    { id:'TST-003', name:'Immaculee Nsabimana',  subject:'Biology',     type:'Full-Time', classes:['S3A','S3B','S4A'],  status:'Active' },
    { id:'TST-004', name:'Theophile Bizimana',   subject:'Chemistry',   type:'Part-Time', classes:['S2B'],              status:'Active' },
    { id:'TST-005', name:'Sandrine Uwera',        subject:'Physics',     type:'Full-Time', classes:['S3A','S3B','S4A'],  status:'Active' },
    { id:'TST-006', name:'Janvier Ntakirutimana',subject:'History',     type:'Full-Time', classes:['S3A','S4A'],        status:'Active' },
]

const EMPTY_FORM = { name:'', subject:'', type:'Full-Time', status:'Active' }

// ── Inline dropdown (shared) ──────────────────────────────────────────────────
function InlineSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    const label = options.find(o => o === value) ?? placeholder
    return (
        <div ref={ref} className="inline-select-wrap">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`inline-select-btn${value ? ' has-value' : ''}`}>
                {label}
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="inline-select-menu">
                    {[placeholder, ...options].map(opt => (
                        <button key={opt} type="button"
                            onClick={() => { onChange(opt === placeholder ? '' : opt); setOpen(false) }}
                            className={`inline-select-opt${value === opt ? ' active' : ''}`}
                            onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = 'var(--muted)' }}
                            onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = 'transparent' }}
                        >{opt}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── FormSelect (for modals) ───────────────────────────────────────────────────
function FormSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    const selected = options.find(o => o.value === value)
    return (
        <div ref={ref} className="form-select-wrap">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`form-select-btn${selected ? ' has-value' : ''}`}>
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="form-select-menu">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`form-select-opt${value === opt.value ? ' active' : ''}`}
                            onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--muted)' }}
                            onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent' }}
                        >{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Unified Add / Edit Teacher Modal (details + class assignment) ─────────────
function TeacherModal({ teacher, config, onClose, onSave }) {
    const isEdit   = !!teacher
    const sections = config.sections ?? []
    const noConfig = sections.length === 0 ||
        sections.every(s => s.years.length === 0 || s.classes.length === 0)

    const [form, setForm] = useState(
        isEdit
            ? { name: teacher.name, subject: teacher.subject, type: teacher.type, status: teacher.status }
            : { ...EMPTY_FORM }
    )
    const [selected, setSelected] = useState(new Set(teacher?.classes ?? []))

    const isValid = form.name.trim() && form.subject && form.type

    function toggle(cls) {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(cls) ? next.delete(cls) : next.add(cls)
            return next
        })
    }

    function toggleYear(year, streams) {
        const yearClasses = streams.map(s => `${year}${s}`)
        const allOn = yearClasses.every(c => selected.has(c))
        setSelected(prev => {
            const next = new Set(prev)
            yearClasses.forEach(c => allOn ? next.delete(c) : next.add(c))
            return next
        })
    }

    function toggleSection(sec) {
        const sectionClasses = sec.years.flatMap(y => sec.classes.map(s => `${y}${s}`))
        const allOn = sectionClasses.every(c => selected.has(c))
        setSelected(prev => {
            const next = new Set(prev)
            sectionClasses.forEach(c => allOn ? next.delete(c) : next.add(c))
            return next
        })
    }

    function handleSave() {
        onSave({ ...form, classes: [...selected].sort() })
        onClose()
    }

    return (
        <Modal
            title={isEdit ? 'Edit Teacher' : 'Add Teacher'}
            icon={isEdit ? 'edit' : 'person_add'}
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-confirm-actions" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={handleSave}>
                        <span className="material-symbols-rounded icon-sm">{isEdit ? 'save' : 'person_add'}</span>
                        {isEdit ? 'Save Changes' : 'Add Teacher'}
                    </button>
                </div>
            }
        >
            {/* ── Teacher Details ── */}
            <p className="teacher-modal-section-label">Teacher Details</p>
            <div className="settings-form">
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-control" placeholder="e.g. Jean-Pierre Habimana"
                        value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                </div>
                <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                    <div className="form-group">
                        <label className="form-label">Subject *</label>
                        <FormSelect value={form.subject} onChange={v => setForm(p => ({ ...p, subject: v }))}
                            placeholder="— Select subject —"
                            options={SUBJECTS.map(s => ({ value: s, label: s }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Employment Type *</label>
                        <FormSelect value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))}
                            placeholder=""
                            options={TYPES.map(t => ({ value: t, label: t }))} />
                    </div>
                </div>
                {isEdit && (
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <FormSelect value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))}
                            placeholder=""
                            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            <div className="teacher-modal-divider" />

            {/* ── Classes to Teach ── */}
            <p className="teacher-modal-section-label">Classes to Teach</p>

            {noConfig ? (
                <EmptyState
                    icon="settings"
                    title="No classes configured yet"
                    description="Go to School Settings to add sections, year groups, and streams before assigning classes."
                />
            ) : (
                <>
                    {sections.map(sec => {
                        const sectionClasses = sec.years.flatMap(y => sec.classes.map(s => `${y}${s}`))
                        const allSectionOn   = sectionClasses.length > 0 && sectionClasses.every(c => selected.has(c))
                        return (
                            <div key={sec.name} className="assign-section">
                                <div className="assign-section-hdr">
                                    <span className="assign-section-name">{sec.name}</span>
                                    <button type="button" className="assign-select-all" onClick={() => toggleSection(sec)}>
                                        {allSectionOn ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {sec.years.map(year => {
                                    const allYearOn = sec.classes.length > 0 &&
                                        sec.classes.map(s => `${year}${s}`).every(c => selected.has(c))
                                    return (
                                        <div key={year} className="assign-year-row">
                                            <button type="button"
                                                className={`assign-year-lbl${allYearOn ? ' active' : ''}`}
                                                onClick={() => toggleYear(year, sec.classes)}
                                                title={`Toggle all ${year} classes`}>
                                                {year}
                                            </button>
                                            <div className="assign-stream-group">
                                                {sec.classes.map(stream => {
                                                    const cls = `${year}${stream}`
                                                    return (
                                                        <button key={stream} type="button" onClick={() => toggle(cls)}
                                                            className={`assign-class-btn${selected.has(cls) ? ' active' : ''}`}>
                                                            {stream}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                    <div className="teacher-assign-hint">
                        {selected.size === 0
                            ? 'No classes selected — teacher will not appear on any timetable'
                            : `${selected.size} class${selected.size !== 1 ? 'es' : ''} selected · ${[...selected].sort().join(', ')}`
                        }
                    </div>
                </>
            )}
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DosTeachers() {
    const { config }                      = useSchoolConfig()
    const [teachers,     setTeachers]     = useState(INITIAL_TEACHERS)
    const [search,       setSearch]       = useState('')
    const [subjectFilter,setSubjectFilter]= useState('')
    const [typeFilter,   setTypeFilter]   = useState('')
    const [addOpen,  setAddOpen]  = useState(false)
    const [editing,  setEditing]  = useState(null)
    let nextId = useRef(teachers.length + 1)

    const teacherStats = [
        { colorClass: 'info',    icon: 'school',   trend: '+3 this term', value: teachers.length,                                   label: 'Total Teachers'        },
        { colorClass: 'success', icon: 'badge',    trend: `${Math.round(teachers.filter(t=>t.type==='Full-Time').length/teachers.length*100)}% of staff`, value: teachers.filter(t=>t.type==='Full-Time').length,  label: 'Full-Time' },
        { colorClass: 'warning', icon: 'schedule', trend: `${Math.round(teachers.filter(t=>t.type==='Part-Time').length/teachers.length*100)}% of staff`, value: teachers.filter(t=>t.type==='Part-Time').length,  label: 'Part-Time' },
        { colorClass: 'info',    icon: 'groups',   trend: 'Optimal',      value: '1:15',                                            label: 'Student-Teacher Ratio' },
    ]

    function handleAdd({ name, subject, type, status, classes }) {
        const id = `TST-${String(nextId.current++).padStart(3, '0')}`
        setTeachers(prev => [...prev, { id, name, subject, type, status, classes }])
    }

    function handleEdit({ name, subject, type, status, classes }) {
        setTeachers(prev => prev.map(t => t.id === editing.id ? { ...t, name, subject, type, status, classes } : t))
    }

    const filtered = teachers.filter(t => {
        if (subjectFilter && t.subject !== subjectFilter) return false
        if (typeFilter    && t.type    !== typeFilter)    return false
        if (search) {
            const q = search.toLowerCase()
            if (!t.name.toLowerCase().includes(q) && !t.subject.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false
        }
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Teacher Management" subtitle="View, add, update teachers and manage class assignments" {...dosUser} />

                    <DashboardContent>
                        <div className="portal-stat-grid">
                            {teacherStats.map((s,i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="toolbar-card">
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input placeholder="Search by name or subject..." value={search} onChange={e => setSearch(e.target.value)} />
                                {search && <button className="toolbar-search-clear" onClick={() => setSearch('')}><span className="material-symbols-rounded">close</span></button>}
                            </div>
                            <InlineSelect value={subjectFilter} onChange={setSubjectFilter} options={SUBJECTS} placeholder="All Subjects" />
                            <InlineSelect value={typeFilter}    onChange={setTypeFilter}    options={TYPES}    placeholder="All Types"    />
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                                <span className="material-symbols-rounded icon-sm">person_add</span> Add Teacher
                            </button>
                        </div>

                        <DataTable
                            title="All Teachers"
                            data={filtered}
                            columns={['Teacher','Subject','Type','Classes Assigned','Status','Actions']}
                            renderRow={t => (
                                <tr key={t.id}>
                                    <td>
                                        <div className="dt-cell-user">
                                            <div className="dt-avatar" style={{ background: avatarColor(t.name) }}>{initials(t.name)}</div>
                                            <div><div className="dt-name">{t.name}</div><div className="dt-sub">{t.id}</div></div>
                                        </div>
                                    </td>
                                    <td className="fw-600">{t.subject}</td>
                                    <td><span className={`tm-badge ${t.type==='Full-Time'?'fulltime':'parttime'}`}>{t.type}</span></td>
                                    <td>{t.classes.length > 0 ? t.classes.map((cls,i) => <span key={i} className="dt-chip">{cls}</span>) : <span className="dt-sub">None assigned</span>}</td>
                                    <td>
                                        <span className={`dt-status${t.status==='Active' ? ' dt-status-active' : ' dt-status-inactive'}`}>
                                            <span className={`dt-status-dot${t.status==='Active' ? ' dt-status-dot-active' : ' dt-status-dot-inactive'}`} />
                                            {t.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-primary btn-sm" onClick={() => setEditing(t)}>
                                            <span className="material-symbols-rounded icon-sm">edit</span> Edit
                                        </button>
                                    </td>
                                </tr>
                            )}
                            emptyIcon="school"
                            emptyTitle="No teachers found"
                            emptyDesc={search ? `No results for "${search}"` : 'No teachers match the selected filters.'}
                            onClearFilters={() => { setSearch(''); setSubjectFilter(''); setTypeFilter('') }}
                        />
                    </DashboardContent>
                </main>
            </div>

            {addOpen  && <TeacherModal config={config} onClose={() => setAddOpen(false)} onSave={handleAdd} />}
            {editing  && <TeacherModal config={config} teacher={editing} onClose={() => setEditing(null)} onSave={handleEdit} />}
        </>
    )
}
