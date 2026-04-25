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
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: '1px solid var(--border)', background: 'var(--card)',
                    fontSize: '0.875rem', color: selected ? 'var(--foreground)' : 'var(--muted-foreground)',
                    transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded" style={{ fontSize: '1.1rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 300, overflow: 'hidden',
                }}>
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '0.55rem 0.875rem', border: 'none', cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: value === opt.value ? 600 : 400,
                                background: value === opt.value ? 'var(--primary)' : 'transparent',
                                color: value === opt.value ? 'white' : 'var(--foreground)',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--muted)' }}
                            onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent' }}
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
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            {/* Icon */}
            <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: a.mode === 'online' ? 'rgba(16,185,129,0.1)' : 'var(--primary-light, #e8f2ff)',
                color: a.mode === 'online' ? 'var(--success)' : 'var(--primary)',
            }}>
                <span className="material-symbols-rounded">
                    {a.mode === 'online' ? 'quiz' : 'assignment'}
                </span>
            </div>

            {/* Content — full remaining width */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row + submission pill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>{a.title}</div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: pill.bg, color: pill.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {pill.label}
                    </span>
                </div>

                {/* Metadata chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{a.subject} · {a.classId}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Due {a.due}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Max: {a.maxScore}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, ...statusStyle }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                    <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: a.mode === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color:      a.mode === 'online' ? 'var(--success)'        : '#6366f1',
                    }}>
                        {a.mode === 'online' ? 'Online' : 'Paper'}
                    </span>
                    {a.file && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.8rem' }}>attach_file</span>
                            {a.file}
                        </span>
                    )}
                </div>

                {/* Actions row — right aligned */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
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
                    <button
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--destructive)', borderColor: 'var(--destructive)' }}
                        onClick={() => onDelete(a.id)} title="Delete"
                    >
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
                style={{
                    border: '2px dashed var(--border)', borderRadius: 10,
                    padding: '1.25rem', textAlign: 'center', cursor: 'pointer',
                    background: value ? 'rgba(59,130,246,0.04)' : 'transparent',
                    transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
                <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: value ? '#3b82f6' : 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>
                    {value ? 'attach_file' : 'upload_file'}
                </span>
                {value ? (
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#3b82f6' }}>{value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>Click to change file</div>
                    </div>
                ) : (
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Upload quiz paper</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>PDF, DOC, DOCX, JPG, PNG</div>
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
                <button
                    onClick={() => onChange(null)}
                    style={{ marginTop: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--destructive)', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                    <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>close</span>
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
                <div style={{
                    textAlign: 'center', padding: '1.5rem',
                    color: 'var(--muted-foreground)', fontSize: '0.85rem',
                    border: '1px dashed var(--border)', borderRadius: 10, marginBottom: '0.75rem',
                }}>
                    No questions yet. Click "Add Question" to start building your quiz.
                </div>
            )}

            {questions.map((q, qi) => (
                <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', marginBottom: '0.65rem', background: 'var(--card)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.72rem', fontWeight: 700,
                        }}>{qi + 1}</span>
                        <input
                            className="form-control"
                            placeholder={`Question ${qi + 1}…`}
                            value={q.text}
                            onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button onClick={() => removeQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', padding: 4 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>delete</span>
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {q.options.map((opt, oi) => (
                            <div key={oi} style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.4rem 0.6rem',
                                border: `1.5px solid ${q.correct === oi ? 'var(--success)' : 'var(--border)'}`,
                                borderRadius: 8,
                                background: q.correct === oi ? 'rgba(16,185,129,0.05)' : 'transparent',
                            }}>
                                <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    checked={q.correct === oi}
                                    onChange={() => updateQuestion(q.id, 'correct', oi)}
                                    style={{ accentColor: 'var(--success)', flexShrink: 0 }}
                                />
                                <input
                                    className="form-control"
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                    value={opt}
                                    onChange={e => updateOption(q.id, oi, e.target.value)}
                                    style={{ fontSize: '0.83rem', border: 'none', padding: '0.2rem 0', background: 'transparent', outline: 'none' }}
                                />
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.8rem', verticalAlign: 'middle', color: 'var(--success)' }}>check_circle</span>
                        {' '}Select the radio button next to the correct answer — highlighted in green.
                    </div>
                </div>
            ))}

            <button className="btn btn-outline btn-sm" onClick={addQuestion} style={{ width: '100%' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                    <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
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
                        style={{
                            padding: '0.875rem', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                            border: `2px solid ${form.mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                            background: form.mode === m.key ? 'var(--primary-light, #e8f2ff)' : 'var(--card)',
                            transition: 'all 0.15s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 3 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem', color: form.mode === m.key ? 'var(--primary)' : 'var(--muted-foreground)' }}>{m.icon}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: form.mode === m.key ? 'var(--primary)' : 'var(--foreground)' }}>{m.label}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', paddingLeft: '1.6rem' }}>{m.sub}</div>
                    </button>
                ))}
            </div>

            {/* Section label */}
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: '0.75rem' }}>
                Assignment Details
            </div>

            {/* Base fields */}
            <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
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
                    <div style={{ position: 'relative' }}>
                        <span className="material-symbols-rounded" style={{
                            position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                            fontSize: '1rem', color: 'var(--muted-foreground)', pointerEvents: 'none',
                        }}>calendar_today</span>
                        <input className="form-control" type="date" name="due" value={form.due} onChange={handle}
                            style={{ paddingLeft: '2rem' }} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">
                        Max Score {form.mode === 'online' ? <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>(auto from questions)</span> : '*'}
                    </label>
                    <input
                        className="form-control" type="number" min="1" name="maxScore"
                        value={form.mode === 'online' ? (questions.length || '') : form.maxScore}
                        onChange={handle}
                        readOnly={form.mode === 'online'}
                        placeholder="e.g. 30"
                        style={{ background: form.mode === 'online' ? 'var(--muted)' : undefined, cursor: form.mode === 'online' ? 'default' : undefined }}
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
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Instructions</label>
                        <textarea className="form-control" name="instructions" value={form.instructions} onChange={handle}
                            style={{ minHeight: 72, resize: 'vertical' }}
                            placeholder="Describe the assignment and list submission requirements…" />
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: '0.6rem' }}>
                        Attach Quiz Paper <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                    </div>
                    <FileUpload value={file} onChange={setFile} />
                </>
            )}

            {/* Online: quiz builder */}
            {form.mode === 'online' && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}>
                            Quiz Questions
                        </div>
                        {questions.length > 0 && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
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
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                className="btn btn-outline"
                style={{ fontSize: '0.82rem', gap: '0.4rem', minWidth: 120 }}
                onClick={() => setOpen(o => !o)}
            >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>class</span>
                {label}
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', marginLeft: 'auto' }}>
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 200, minWidth: 140, overflow: 'hidden',
                }}>
                    {[{ key: 'all', label: 'All Classes' }, ...options.map(o => ({ key: o, label: o }))].map(item => (
                        <button
                            key={item.key}
                            onClick={() => { onChange(item.key); setOpen(false) }}
                            style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '0.55rem 1rem', border: 'none', cursor: 'pointer',
                                fontSize: '0.85rem', fontWeight: value === item.key ? 600 : 400,
                                background: value === item.key ? 'var(--primary)' : 'transparent',
                                color: value === item.key ? 'white' : 'var(--foreground)',
                            }}
                            onMouseEnter={e => { if (value !== item.key) e.target.style.background = 'var(--muted)' }}
                            onMouseLeave={e => { if (value !== item.key) e.target.style.background = 'transparent' }}
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
                        <div className="portal-stat-grid" style={{ marginBottom: '1.5rem' }}>
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
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem',
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 16,
                            padding: '0.75rem 1rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                        }}>
                            {/* Left: status filter pills */}
                            <FilterBar options={statusTabs} active={statusFilter} onChange={setStatusFilter} />

                            {/* Right: class filter + new button always together */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <ClassDropdown
                                    value={classFilter}
                                    onChange={setClassFilter}
                                    options={TEACHER_CLASSES}
                                />
                                <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => { setEditing(null); setIsOpen(true) }}>
                                    <span className="material-symbols-rounded icon-sm">add</span>
                                    New Assignment
                                </button>
                            </div>
                        </div>

                        {/* Assignment list */}
                        {visible.length > 0 ? (
                            <div style={{
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                borderRadius: 16,
                                overflow: 'hidden',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                            }}>
                                <div style={{
                                    padding: '0.875rem 1.25rem',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                        {visible.length} assignment{visible.length !== 1 ? 's' : ''}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                                        {classFilter !== 'all' ? classFilter : 'All Classes'} · {statusFilter !== 'all' ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : 'All'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                    {visible.map((a, i) => (
                                        <div key={a.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none', padding: '0.25rem 0.5rem' }}>
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
