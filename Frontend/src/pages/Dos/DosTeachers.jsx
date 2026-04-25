import { useState, useRef, useEffect } from 'react'
import { DataTable } from '../../components/ui/DataTable'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Constants ─────────────────────────────────────────────────────────────────
const SUBJECTS    = ['Mathematics','English','Biology','Chemistry','Physics','History','Geography','Kinyarwanda','CRE','Art & Design']
const TYPES       = ['Full-Time','Part-Time']
const ALL_CLASSES = ['S1A','S1B','S2A','S2B','S3A','S3B','S4A','S4B','S5A','S5B','S6A','S6B']

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

// ── Add / Edit Teacher Modal ──────────────────────────────────────────────────
function TeacherModal({ teacher, onClose, onSave }) {
    const isEdit = !!teacher
    const [form, setForm] = useState(teacher ? { name: teacher.name, subject: teacher.subject, type: teacher.type, status: teacher.status } : { ...EMPTY_FORM })

    const isValid = form.name.trim() && form.subject && form.type

    return (
        <Modal title={isEdit ? 'Edit Teacher' : 'Add Teacher'} icon="person_add" onClose={onClose}
            footer={
                <div className="modal-confirm-actions" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={() => { onSave(form); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">{isEdit ? 'save' : 'person_add'}</span>
                        {isEdit ? 'Save Changes' : 'Add Teacher'}
                    </button>
                </div>
            }
        >
            <div className="settings-form">
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-control" placeholder="e.g. Jean-Pierre Habimana"
                        value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="resp-grid-2" style={{ gap:'0.75rem' }}>
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
                            options={[{ value:'Active', label:'Active' }, { value:'Inactive', label:'Inactive' }]} />
                    </div>
                )}
            </div>
        </Modal>
    )
}

// ── Assign Classes Modal ──────────────────────────────────────────────────────
function AssignModal({ teacher, onClose, onSave }) {
    const [selected, setSelected] = useState(new Set(teacher.classes))
    function toggle(cls) {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(cls) ? next.delete(cls) : next.add(cls)
            return next
        })
    }
    return (
        <Modal title="Assign Classes" icon="class" onClose={onClose}
            footer={
                <div className="modal-confirm-actions" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => { onSave([...selected].sort()); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">save</span>
                        Save Assignments
                    </button>
                </div>
            }
        >
            <div className="teacher-modal-header">
                <div className="teacher-modal-name">{teacher.name}</div>
                <div className="teacher-modal-meta">{teacher.subject} · {teacher.id}</div>
            </div>
            <div className="teacher-assign-note">Select the classes this teacher will be assigned to:</div>
            <div className="assign-class-grid">
                {ALL_CLASSES.map(cls => {
                    const active = selected.has(cls)
                    return (
                        <button key={cls} type="button" onClick={() => toggle(cls)}
                            className={`assign-class-btn${active ? ' active' : ''}`}>
                            {cls}
                        </button>
                    )
                })}
            </div>
            <div className="teacher-assign-hint">
                {selected.size} class{selected.size !== 1 ? 'es' : ''} selected
            </div>
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DosTeachers() {
    const [teachers,     setTeachers]     = useState(INITIAL_TEACHERS)
    const [search,       setSearch]       = useState('')
    const [subjectFilter,setSubjectFilter]= useState('')
    const [typeFilter,   setTypeFilter]   = useState('')
    const [addOpen,      setAddOpen]      = useState(false)
    const [editing,      setEditing]      = useState(null)
    const [assigning,    setAssigning]    = useState(null)
    let nextId = useRef(teachers.length + 1)

    const teacherStats = [
        { colorClass: 'info',    icon: 'school',   trend: '+3 this term', value: teachers.length,                                   label: 'Total Teachers'        },
        { colorClass: 'success', icon: 'badge',    trend: `${Math.round(teachers.filter(t=>t.type==='Full-Time').length/teachers.length*100)}% of staff`, value: teachers.filter(t=>t.type==='Full-Time').length,  label: 'Full-Time' },
        { colorClass: 'warning', icon: 'schedule', trend: `${Math.round(teachers.filter(t=>t.type==='Part-Time').length/teachers.length*100)}% of staff`, value: teachers.filter(t=>t.type==='Part-Time').length,  label: 'Part-Time' },
        { colorClass: 'info',    icon: 'groups',   trend: 'Optimal',      value: '1:15',                                            label: 'Student-Teacher Ratio' },
    ]

    function handleAdd(form) {
        const id = `TST-${String(nextId.current++).padStart(3,'0')}`
        setTeachers(prev => [...prev, { id, ...form, classes: [] }])
    }
    function handleEdit(form) {
        setTeachers(prev => prev.map(t => t.id === editing.id ? { ...t, ...form } : t))
    }
    function handleAssign(classes) {
        setTeachers(prev => prev.map(t => t.id === assigning.id ? { ...t, classes } : t))
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
                                        <div className="dt-actions">
                                            <button className="btn btn-outline btn-sm" onClick={() => setEditing(t)}><span className="material-symbols-rounded icon-sm">edit</span> Edit</button>
                                            <button className="btn btn-primary btn-sm" onClick={() => setAssigning(t)}><span className="material-symbols-rounded icon-sm">class</span> Assign</button>
                                        </div>
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

            {addOpen   && <TeacherModal onClose={() => setAddOpen(false)}   onSave={handleAdd}    />}
            {editing   && <TeacherModal teacher={editing}   onClose={() => setEditing(null)}   onSave={handleEdit}   />}
            {assigning && <AssignModal  teacher={assigning} onClose={() => setAssigning(null)} onSave={handleAssign} />}
        </>
    )
}
