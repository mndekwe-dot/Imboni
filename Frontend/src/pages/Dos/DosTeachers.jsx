import { useState, useRef, useEffect } from 'react'
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
        <div ref={ref} style={{ position:'relative' }}>
            <button type="button" onClick={() => setOpen(o => !o)}
                style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', fontSize:'0.82rem', cursor:'pointer', color: value ? 'var(--foreground)' : 'var(--muted-foreground)', whiteSpace:'nowrap' }}>
                {label}
                <span className="material-symbols-rounded" style={{ fontSize:'1rem', color:'var(--muted-foreground)' }}>{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:300, minWidth:160, overflow:'hidden' }}>
                    {[placeholder, ...options].map(opt => (
                        <button key={opt} type="button"
                            onClick={() => { onChange(opt === placeholder ? '' : opt); setOpen(false) }}
                            style={{ display:'block', width:'100%', textAlign:'left', padding:'0.5rem 0.875rem', border:'none', cursor:'pointer', fontSize:'0.85rem', fontWeight: value === opt ? 600 : 400, background: value === opt ? 'var(--primary)' : 'transparent', color: value === opt ? 'white' : 'var(--foreground)' }}
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
        <div ref={ref} style={{ position:'relative' }}>
            <button type="button" onClick={() => setOpen(o => !o)}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--card)', fontSize:'0.875rem', cursor:'pointer', color: selected ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded" style={{ fontSize:'1.1rem', color:'var(--muted-foreground)' }}>{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:300, overflow:'hidden' }}>
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            style={{ display:'block', width:'100%', textAlign:'left', padding:'0.55rem 0.875rem', border:'none', cursor:'pointer', fontSize:'0.875rem', fontWeight: value === opt.value ? 600 : 400, background: value === opt.value ? 'var(--primary)' : 'transparent', color: value === opt.value ? 'white' : 'var(--foreground)' }}
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
                <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', width:'100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={() => { onSave(form); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">{isEdit ? 'save' : 'person_add'}</span>
                        {isEdit ? 'Save Changes' : 'Add Teacher'}
                    </button>
                </div>
            }
        >
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
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
                <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', width:'100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => { onSave([...selected].sort()); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">save</span>
                        Save Assignments
                    </button>
                </div>
            }
        >
            <div style={{ marginBottom:'1rem' }}>
                <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{teacher.name}</div>
                <div style={{ fontSize:'0.82rem', color:'var(--muted-foreground)' }}>{teacher.subject} · {teacher.id}</div>
            </div>
            <div style={{ fontSize:'0.78rem', color:'var(--muted-foreground)', marginBottom:'0.75rem' }}>
                Select the classes this teacher will be assigned to:
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px,1fr))', gap:'0.5rem' }}>
                {ALL_CLASSES.map(cls => {
                    const active = selected.has(cls)
                    return (
                        <button key={cls} type="button" onClick={() => toggle(cls)}
                            style={{ padding:'0.6rem', borderRadius:8, border:`2px solid ${active ? 'var(--primary)' : 'var(--border)'}`, background: active ? 'var(--primary)' : 'var(--card)', color: active ? 'white' : 'var(--foreground)', fontWeight: active ? 700 : 500, fontSize:'0.875rem', cursor:'pointer', transition:'all 0.15s' }}>
                            {cls}
                        </button>
                    )
                })}
            </div>
            <div style={{ marginTop:'1rem', fontSize:'0.8rem', color:'var(--muted-foreground)' }}>
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
                        {/* Stats */}
                        <div className="portal-stat-grid" style={{ margin:0 }}>
                            {teacherStats.map((s,i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Toolbar */}
                        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap', background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'0.75rem 1rem', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                            {/* Search */}
                            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'var(--muted)', border:'1px solid var(--border)', borderRadius:8, padding:'0.4rem 0.75rem', flex:1, minWidth:180 }}>
                                <span className="material-symbols-rounded" style={{ fontSize:'1rem', color:'var(--muted-foreground)' }}>search</span>
                                <input type="text" placeholder="Search by name or subject..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    style={{ border:'none', background:'transparent', outline:'none', fontSize:'0.875rem', width:'100%', color:'var(--foreground)' }} />
                                {search && (
                                    <button onClick={() => setSearch('')} style={{ border:'none', background:'none', cursor:'pointer', padding:0, display:'flex', color:'var(--muted-foreground)' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize:'1rem' }}>close</span>
                                    </button>
                                )}
                            </div>
                            <InlineSelect value={subjectFilter} onChange={setSubjectFilter} options={SUBJECTS} placeholder="All Subjects" />
                            <InlineSelect value={typeFilter}    onChange={setTypeFilter}    options={TYPES}    placeholder="All Types"    />
                            <div style={{ flex:1 }} />
                            <button className="btn btn-primary" style={{ whiteSpace:'nowrap' }} onClick={() => setAddOpen(true)}>
                                <span className="material-symbols-rounded icon-sm">person_add</span>
                                Add Teacher
                            </button>
                        </div>

                        {/* Table or EmptyState */}
                        {filtered.length === 0 ? (
                            <EmptyState icon="school" title="No teachers found"
                                description={search ? `No teachers match "${search}".` : 'No teachers match the selected filters.'}
                                action={{ label:'Clear Filters', icon:'close', onClick:() => { setSearch(''); setSubjectFilter(''); setTypeFilter('') } }}
                            />
                        ) : (
                            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
                                    <div style={{ fontWeight:700, fontSize:'0.95rem' }}>All Teachers</div>
                                    <span style={{ fontSize:'0.82rem', color:'var(--muted-foreground)' }}>{filtered.length} teacher{filtered.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="tm-table-wrap">
                                    <table className="tm-table">
                                        <thead>
                                            <tr>
                                                <th>Teacher</th>
                                                <th>Subject</th>
                                                <th>Type</th>
                                                <th>Classes Assigned</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(t => (
                                                <tr key={t.id}>
                                                    <td>
                                                        <div className="tm-teacher-cell">
                                                            <div style={{ width:36, height:36, borderRadius:'50%', background:avatarColor(t.name), color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.8rem', flexShrink:0 }}>
                                                                {initials(t.name)}
                                                            </div>
                                                            <div>
                                                                <div className="tm-name">{t.name}</div>
                                                                <div className="tm-id">{t.id}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight:500 }}>{t.subject}</td>
                                                    <td>
                                                        <span className={`tm-badge ${t.type === 'Full-Time' ? 'fulltime' : 'parttime'}`}>{t.type}</span>
                                                    </td>
                                                    <td>
                                                        {t.classes.length > 0
                                                            ? t.classes.map((cls,i) => <span key={i} className="tm-chip">{cls}</span>)
                                                            : <span style={{ fontSize:'0.8rem', color:'var(--muted-foreground)' }}>None assigned</span>
                                                        }
                                                    </td>
                                                    <td>
                                                        <span style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', fontSize:'0.82rem', fontWeight:600, color: t.status === 'Active' ? 'var(--success)' : 'var(--muted-foreground)' }}>
                                                            <span style={{ width:7, height:7, borderRadius:'50%', background: t.status === 'Active' ? 'var(--success)' : 'var(--border)', display:'inline-block' }} />
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display:'flex', gap:'0.4rem' }}>
                                                            <button className="btn btn-outline btn-sm" onClick={() => setEditing(t)}>
                                                                <span className="material-symbols-rounded icon-sm">edit</span> Edit
                                                            </button>
                                                            <button className="btn btn-primary btn-sm" onClick={() => setAssigning(t)}>
                                                                <span className="material-symbols-rounded icon-sm">class</span> Assign
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>

            {/* Modals */}
            {addOpen  && <TeacherModal onClose={() => setAddOpen(false)}  onSave={handleAdd}  />}
            {editing  && <TeacherModal teacher={editing} onClose={() => setEditing(null)}  onSave={handleEdit}  />}
            {assigning && <AssignModal teacher={assigning} onClose={() => setAssigning(null)} onSave={handleAssign} />}
        </>
    )
}
