import { useState, useRef, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { FilterBar } from '../../components/ui/FilterBar'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Teacher's own classes only ────────────────────────────────────────────────
const TEACHER_CLASSES = ['S1B', 'S2A', 'S3A', 'S3B', 'S4A']
const SUBJECTS        = ['Mathematics', 'Physics', 'Chemistry', 'English', 'History', 'Biology']

const STATUS_TABS = [
    { key: 'all',    label: 'All'    },
    { key: 'active', label: 'Active' },
    { key: 'past',   label: 'Past'   },
    { key: 'draft',  label: 'Draft'  },
]


const INITIAL_ASSIGNMENTS = [
    { id: 1, status: 'active', mode: 'paper',  title: 'Problem Set 4 – Quadratic Equations',       subject: 'Mathematics', classId: 'S3A', due: '2026-03-15', maxScore: 30,  submitted: 18,   total: 34,   file: null     },
    { id: 2, status: 'active', mode: 'paper',  title: 'CAT 2 Take-home – Trigonometry',             subject: 'Mathematics', classId: 'S3B', due: '2026-03-11', maxScore: 30,  submitted: 6,    total: 32,   file: null     },
    { id: 3, status: 'active', mode: 'online', title: 'Chapter 6 Quiz – Algebra',                   subject: 'Mathematics', classId: 'S3A', due: '2026-03-20', maxScore: 20,  submitted: 30,   total: 34,   questions: [] },
    { id: 4, status: 'active', mode: 'paper',  title: 'Lab Report – Projectile Motion Experiment',  subject: 'Physics',     classId: 'S4A', due: '2026-03-18', maxScore: 100, submitted: 30,   total: 30,   file: null     },
    { id: 5, status: 'past',   mode: 'paper',  title: 'Problem Set 3 – Linear Equations',           subject: 'Mathematics', classId: 'S3A', due: '2026-02-28', maxScore: 30,  submitted: 34,   total: 34,   file: null     },
    { id: 6, status: 'draft',  mode: 'paper',  title: 'Electricity and Magnetism – Extended Probs', subject: 'Physics',     classId: 'S4A', due: '2026-04-02', maxScore: 50,  submitted: null, total: null, file: null     },
    { id: 7, status: 'draft',  mode: 'online', title: 'Integration Basics Quiz',                    subject: 'Mathematics', classId: 'S4A', due: '2026-04-05', maxScore: 15,  submitted: null, total: null, questions: [] },
]

const EMPTY_FORM = {
    title: '', classId: '', subject: '', due: '',
    maxScore: '', instructions: '', status: 'draft', mode: 'paper',
}

const EMPTY_QUESTION = () => ({
    id:      Date.now() + Math.random(),
    text:    '',
    options: ['', '', '', ''],
    correct: 0,
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function submissionPill(a) {
    if (a.submitted === null) return { label: 'Not published', bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    const pct = a.total ? (a.submitted / a.total) * 100 : 0
    if (pct === 100) return { label: `${a.submitted}/${a.total} submitted`, bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' }
    if (pct >= 50)   return { label: `${a.submitted}/${a.total} submitted`, bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)'  }
    return                  { label: `${a.submitted}/${a.total} submitted`, bg: 'rgba(239,68,68,0.1)',   color: 'var(--destructive)' }
}

// ── Assignment Card ───────────────────────────────────────────────────────────
// ── Styled form select (replaces native <select>) ────────────────────────────
function FormSelect({ label, value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    const selected = options.find(o => o.value === value)
    return (
        <div ref={ref} className="form-select-wrap">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`form-select-btn${selected ? ' has-value' : ''}`}
            >
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="form-select-menu">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`form-select-opt${value === opt.value ? ' active' : ''}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function AssignmentCard({ a, onEdit, onDelete, onPublish }) {
    const pill   = submissionPill(a)
    const isPast = a.status === 'past'

    const statusStyle = {
        active: { bg: 'rgba(16,185,129,0.1)',  color: 'var(--success)'       },
        draft:  { bg: 'rgba(245,158,11,0.1)',  color: 'var(--warning)'       },
        past:   { bg: 'var(--muted)',           color: 'var(--muted-foreground)' },
    }[a.status]

    return (
        <div className="card asgn-card">
            <div className={`asgn-icon ${a.mode === 'online' ? 'online' : 'paper'}`}>
                <span className="material-symbols-rounded">
                    {a.mode === 'online' ? 'quiz' : 'assignment'}
                </span>
            </div>

            <div className="asgn-body">
                <div className="asgn-header">
                    <div className="asgn-title">{a.title}</div>
                    <span className="asgn-sub-pill" style={{ background: pill.bg, color: pill.color }}>
                        {pill.label}
                    </span>
                </div>

                <div className="asgn-meta">
                    <span className="asgn-meta-text">{a.subject} · {a.classId}</span>
                    <span className="asgn-meta-text">Due {a.due}</span>
                    <span className="asgn-meta-text">Max: {a.maxScore}</span>
                    <span className="asgn-chip" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                    <span className="asgn-chip" style={{
                        background: a.mode === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color:      a.mode === 'online' ? 'var(--success)'        : '#6366f1',
                    }}>
                        {a.mode === 'online' ? 'Online' : 'Paper'}
                    </span>
                    {a.file && (
                        <span className="asgn-attachment">
                            <span className="material-symbols-rounded">attach_file</span>
                            {a.file}
                        </span>
                    )}
                </div>

                <div className="asgn-actions">
                    {a.status === 'draft' && (
                        <button className="btn btn-sm btn-primary" onClick={() => onPublish(a.id)}>
                            <span className="material-symbols-rounded icon-sm">publish</span> Publish
                        </button>
                    )}
                    {!isPast && (
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(a)} title="Edit">
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                    )}
                    <button className="btn btn-outline btn-sm btn-destructive-outline" onClick={() => onDelete(a.id)} title="Delete">
                        <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── File Upload Field ─────────────────────────────────────────────────────────
function FileUpload({ value, onChange }) {
    const inputRef = useRef()
    return (
        <div>
            <div
                onClick={() => inputRef.current.click()}
                className="file-upload-area"
                style={{ background: value ? 'rgba(59,130,246,0.04)' : 'transparent' }}
            >
                <span className="material-symbols-rounded file-upload-icon"
                    style={{ color: value ? '#3b82f6' : 'var(--muted-foreground)' }}>
                    {value ? 'attach_file' : 'upload_file'}
                </span>
                {value ? (
                    <div>
                        <div className="file-upload-selected-name">{value}</div>
                        <div className="file-upload-selected-hint">Click to change file</div>
                    </div>
                ) : (
                    <div>
                        <div className="file-upload-title">Upload quiz paper</div>
                        <div className="file-upload-hint">PDF, DOC, DOCX, JPG, PNG</div>
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={e => onChange(e.target.files[0]?.name || null)}
            />
            {value && (
                <button onClick={() => onChange(null)} className="file-upload-remove">
                    <span className="material-symbols-rounded">close</span>
                    Remove file
                </button>
            )}
        </div>
    )
}

// ── Quiz Question Builder ─────────────────────────────────────────────────────
function QuizBuilder({ questions, onChange }) {
    function updateQuestion(id, field, value) {
        onChange(questions.map(q => q.id === id ? { ...q, [field]: value } : q))
    }
    function updateOption(id, idx, value) {
        onChange(questions.map(q => {
            if (q.id !== id) return q
            const opts = [...q.options]
            opts[idx] = value
            return { ...q, options: opts }
        }))
    }
    function removeQuestion(id) { onChange(questions.filter(q => q.id !== id)) }
    function addQuestion()      { onChange([...questions, EMPTY_QUESTION()])   }

    return (
        <div>
            {questions.length === 0 && (
                <div className="quiz-q-empty">
                    No questions yet. Click "Add Question" to start building your quiz.
                </div>
            )}

            {questions.map((q, qi) => (
                <div key={q.id} className="quiz-q">
                    <div className="quiz-q-header">
                        <span className="quiz-q-num">{qi + 1}</span>
                        <input
                            className="form-control flex-1"
                            placeholder={`Question ${qi + 1}…`}
                            value={q.text}
                            onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                        />
                        <button onClick={() => removeQuestion(q.id)} className="quiz-q-delete">
                            <span className="material-symbols-rounded">delete</span>
                        </button>
                    </div>

                    <div className="quiz-q-options">
                        {q.options.map((opt, oi) => (
                            <div key={oi} className={`quiz-q-option${q.correct === oi ? ' correct' : ''}`}>
                                <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    checked={q.correct === oi}
                                    onChange={() => updateQuestion(q.id, 'correct', oi)}
                                />
                                <input
                                    className="quiz-q-option-input"
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                    value={opt}
                                    onChange={e => updateOption(q.id, oi, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="quiz-q-help">
                        <span className="material-symbols-rounded">check_circle</span>
                        {' '}Select the radio button next to the correct answer — highlighted in green.
                    </div>
                </div>
            ))}

            <button className="btn btn-outline btn-sm w-full" onClick={addQuestion}>
                <span className="material-symbols-rounded icon-sm">add</span>
                Add Question
            </button>
        </div>
    )
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────
function AssignmentModal({ initial, onClose, onSave }) {
    const [form,      setForm]      = useState(initial ? { ...initial } : { ...EMPTY_FORM })
    const [questions, setQuestions] = useState(initial?.questions || [])
    const [file,      setFile]      = useState(initial?.file || null)

    function handle(e) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    function handleSave() {
        if (!form.title || !form.classId || !form.subject || !form.due || !form.maxScore) return
        if (form.mode === 'online' && questions.length === 0) return
        onSave({
            ...form,
            questions: form.mode === 'online' ? questions : [],
            file:      form.mode === 'paper'  ? file      : null,
            maxScore:  form.mode === 'online' ? questions.length : form.maxScore,
        })
        onClose()
    }

    const isValid = form.title && form.classId && form.subject && form.due && form.maxScore &&
        (form.mode === 'paper' || questions.length > 0)

    return (
        <Modal
            title={initial ? 'Edit Assignment' : 'New Assignment'}
            icon="assignment"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">
                        {!isValid && '* Fill in all required fields'}
                        {form.mode === 'online' && questions.length === 0 && ' · Add at least one question'}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={handleSave}>
                        <span className="material-symbols-rounded icon-sm">
                            {form.status === 'draft' ? 'save' : 'publish'}
                        </span>
                        {form.status === 'draft' ? 'Save as Draft' : 'Publish'}
                    </button>
                </div>
            }
        >
            {/* Mode toggle */}
            <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    { key: 'paper',  icon: 'assignment',   label: 'Paper Assignment', sub: 'Manual grading' },
                    { key: 'online', icon: 'quiz',         label: 'Online Quiz',      sub: 'Auto-marked'    },
                ].map(m => (
                    <button
                        key={m.key}
                        onClick={() => setForm(prev => ({ ...prev, mode: m.key }))}
                        className={`mode-toggle-btn${form.mode === m.key ? ' active' : ''}`}
                        style={{
                            border: `2px solid ${form.mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                            background: form.mode === m.key ? 'var(--primary-light, #e8f2ff)' : 'var(--card)',
                        }}
                    >
                        <div className="mode-toggle-btn-header">
                            <span className="material-symbols-rounded mode-toggle-btn-icon">{m.icon}</span>
                            <span className="mode-toggle-btn-label">{m.label}</span>
                        </div>
                        <div className="mode-toggle-btn-sub">{m.sub}</div>
                    </button>
                ))}
            </div>

            {/* Section label */}
            <div className="section-label-sm">Assignment Details</div>

            {/* Base fields */}
            <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group col-full">
                    <label className="form-label">Title *</label>
                    <input className="form-control" name="title" value={form.title} onChange={handle}
                        placeholder={form.mode === 'online' ? 'e.g. Chapter 6 Quiz – Algebra' : 'e.g. Problem Set 4 – Quadratic Equations'} />
                </div>
                <div className="form-group">
                    <label className="form-label">Class *</label>
                    <FormSelect
                        value={form.classId}
                        onChange={v => setForm(p => ({ ...p, classId: v }))}
                        placeholder="— Select class —"
                        options={TEACHER_CLASSES.map(c => ({ value: c, label: c }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Subject *</label>
                    <FormSelect
                        value={form.subject}
                        onChange={v => setForm(p => ({ ...p, subject: v }))}
                        placeholder="— Select subject —"
                        options={SUBJECTS.map(s => ({ value: s, label: s }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Due Date *</label>
                    <div className="input-icon-wrap">
                        <span className="material-symbols-rounded input-icon">calendar_today</span>
                        <input className="form-control input-icon-field" type="date" name="due" value={form.due} onChange={handle} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">
                        Max Score {form.mode === 'online' ? <span className="label-muted">(auto from questions)</span> : '*'}
                    </label>
                    <input
                        className={`form-control${form.mode === 'online' ? ' input-muted' : ''}`}
                        type="number" min="1" name="maxScore"
                        value={form.mode === 'online' ? (questions.length || '') : form.maxScore}
                        onChange={handle}
                        readOnly={form.mode === 'online'}
                        placeholder="e.g. 30"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Status</label>
                    <FormSelect
                        value={form.status}
                        onChange={v => setForm(p => ({ ...p, status: v }))}
                        placeholder=""
                        options={[
                            { value: 'draft',  label: 'Save as draft' },
                            { value: 'active', label: 'Publish now'   },
                        ]}
                    />
                </div>
            </div>

            {/* Paper: instructions + file upload */}
            {form.mode === 'paper' && (
                <>
                    <div className="form-group mb-1">
                        <label className="form-label">Instructions</label>
                        <textarea className="form-control textarea-sm" name="instructions" value={form.instructions} onChange={handle}
                            placeholder="Describe the assignment and list submission requirements…" />
                    </div>
                    <div className="attach-label">
                        Attach Quiz Paper <span className="attach-label-opt">(optional)</span>
                    </div>
                    <FileUpload value={file} onChange={setFile} />
                </>
            )}

            {/* Online: quiz builder */}
            {form.mode === 'online' && (
                <>
                    <div className="quiz-section-header">
                        <div className="section-label-sm" style={{ marginBottom: 0 }}>Quiz Questions</div>
                        {questions.length > 0 && (
                            <span className="quiz-section-count">
                                {questions.length} question{questions.length !== 1 ? 's' : ''} · {questions.length} mark{questions.length !== 1 ? 's' : ''} total
                            </span>
                        )}
                    </div>
                    <QuizBuilder questions={questions} onChange={setQuestions} />
                </>
            )}
        </Modal>
    )
}

// ── Custom class filter dropdown ──────────────────────────────────────────────
function ClassDropdown({ value, onChange, options }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])
    const label = value === 'all' ? 'All Classes' : value
    return (
        <div ref={ref} className="class-dd-wrap">
            <button className="btn btn-outline" style={{ fontSize: '0.82rem', gap: '0.4rem', minWidth: 120 }} onClick={() => setOpen(o => !o)}>
                <span className="material-symbols-rounded icon-md">class</span>
                {label}
                <span className="material-symbols-rounded icon-md ml-auto">
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {open && (
                <div className="class-dd-menu">
                    {[{ key: 'all', label: 'All Classes' }, ...options.map(o => ({ key: o, label: o }))].map(item => (
                        <button
                            key={item.key}
                            onClick={() => { onChange(item.key); setOpen(false) }}
                            className={`class-dd-opt${value === item.key ? ' active' : ''}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TeacherAssignments() {
    const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS)
    const [statusFilter, setStatusFilter] = useState('all')
    const [classFilter,  setClassFilter]  = useState('all')
    const [isOpen,   setIsOpen]   = useState(false)
    const [editing,  setEditing]  = useState(null)

    const statusTabs = STATUS_TABS.map(t => ({
        ...t,
        count: t.key === 'all' ? undefined : assignments.filter(a => a.status === t.key).length,
    }))


    const visible = assignments.filter(a => {
        if (statusFilter !== 'all' && a.status !== statusFilter) return false
        if (classFilter  !== 'all' && a.classId !== classFilter)  return false
        return true
    })

    function handleSave(data) {
        if (editing) {
            setAssignments(prev => prev.map(a => a.id === editing.id ? { ...a, ...data } : a))
        } else {
            setAssignments(prev => [...prev, { ...data, id: Date.now(), submitted: null, total: null }])
        }
        setEditing(null)
    }

    function handleEdit(a)    { setEditing(a); setIsOpen(true)  }
    function handleDelete(id) { setAssignments(prev => prev.filter(a => a.id !== id)) }
    function handlePublish(id){ setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: 'active' } : a)) }
    function handleClose()    { setIsOpen(false); setEditing(null) }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>

            {isOpen && (
                <AssignmentModal initial={editing} onClose={handleClose} onSave={handleSave} />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Assignments"
                        subtitle="Create, manage and track student submissions"
                        {...teacherUser}
                    />

                    <DashboardContent>

                        {/* Stats */}
                        <div className="portal-stat-grid mb-1-5">
                            {[
                                { icon: 'assignment',   value: assignments.length,                                    label: 'Total This Term', colorClass: ''        },
                                { icon: 'check_circle', value: assignments.filter(a => a.status === 'active').length, label: 'Active',          colorClass: 'success' },
                                { icon: 'quiz',         value: assignments.filter(a => a.mode === 'online').length,   label: 'Online Quizzes',  colorClass: ''        },
                                { icon: 'draft',        value: assignments.filter(a => a.status === 'draft').length,  label: 'Drafts',          colorClass: 'warning' },
                            ].map((s, i) => (
                                <div key={i} className="stat-card">
                                    <div className="stat-header">
                                        <div className={`stat-icon ${s.colorClass}`}>
                                            <span className="material-symbols-rounded">{s.icon}</span>
                                        </div>
                                    </div>
                                    <div className="stat-value">{s.value}</div>
                                    <div className="stat-label">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="asgn-toolbar">
                            <FilterBar options={statusTabs} active={statusFilter} onChange={setStatusFilter} />
                            <div className="asgn-toolbar-right">
                                <ClassDropdown value={classFilter} onChange={setClassFilter} options={TEACHER_CLASSES} />
                                <button className="btn btn-primary whitespace-nowrap" onClick={() => { setEditing(null); setIsOpen(true) }}>
                                    <span className="material-symbols-rounded icon-sm">add</span>
                                    New Assignment
                                </button>
                            </div>
                        </div>

                        {/* Assignment list */}
                        {visible.length > 0 ? (
                            <div className="asgn-list-wrap">
                                <div className="asgn-list-header">
                                    <span className="asgn-list-count">
                                        {visible.length} assignment{visible.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="asgn-list-filter">
                                        {classFilter !== 'all' ? classFilter : 'All Classes'} · {statusFilter !== 'all' ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : 'All'}
                                    </span>
                                </div>
                                <div className="asgn-list-body">
                                    {visible.map(a => (
                                        <div key={a.id} className="asgn-list-item">
                                            <AssignmentCard
                                                a={a}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                onPublish={handlePublish}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <EmptyState
                                icon={statusFilter === 'draft' ? 'draft' : statusFilter === 'past' ? 'history_edu' : 'assignment'}
                                title={
                                    statusFilter === 'all' && classFilter === 'all'
                                        ? 'No assignments yet'
                                        : `No ${statusFilter === 'all' ? '' : statusFilter} assignments${classFilter !== 'all' ? ` for ${classFilter}` : ''}`
                                }
                                description={
                                    statusFilter !== 'all' || classFilter !== 'all'
                                        ? 'No assignments match your current filters. Try selecting a different status or class.'
                                        : "You haven't created any assignments yet. Click the button below to get started."
                                }
                                secondAction={statusFilter !== 'all' || classFilter !== 'all' ? {
                                    label: 'Clear Filters',
                                    icon:  'filter_alt_off',
                                    onClick: () => { setStatusFilter('all'); setClassFilter('all') },
                                } : undefined}
                                action={statusFilter === 'all' && classFilter === 'all' ? {
                                    label: 'New Assignment',
                                    icon:  'add',
                                    onClick: () => { setEditing(null); setIsOpen(true) },
                                } : undefined}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
