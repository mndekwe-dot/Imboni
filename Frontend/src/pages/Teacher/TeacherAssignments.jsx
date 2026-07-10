import { useState, useRef, useEffect, useCallback } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { FilterBar } from '../../components/ui/FilterBar'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getTeacherMyClasses, getTeacherSubjects,
    getTeacherAssignments, createTeacherAssignment,
    updateTeacherAssignment, deleteTeacherAssignment,
    getAssignmentSubmissions, getAssignmentGradeSheet, saveAssignmentGrades,
    getQuestionBank, saveToQuestionBank, patchQuestionBank, deleteFromQuestionBank,
} from '../../api/teacher'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
    { key: 'all',    label: 'All'    },
    { key: 'active', label: 'Active' },
    { key: 'draft',  label: 'Draft'  },
    { key: 'closed', label: 'Closed' },
]

const QUESTION_TYPES = [
    { value: 'mcq',          label: 'Multiple Choice',   icon: 'radio_button_checked' },
    { value: 'true_false',   label: 'True / False',      icon: 'check_circle'         },
    { value: 'short_answer', label: 'Short Answer',      icon: 'short_text'           },
    { value: 'fill_blank',   label: 'Fill in the Blank', icon: 'text_fields'          },
]

const EMPTY_FORM = {
    title: '', class_obj: '', subject: '', due_date: '',
    max_score: '', instructions: '', status: 'draft', mode: 'paper',
    time_limit_minutes: '', shuffle_questions: false,
}

function newQuestion(type = 'mcq') {
    return {
        id:          String(Date.now() + Math.random()),
        type,
        text:        '',
        options:     type === 'mcq' ? ['', '', '', ''] : [],
        correct:     (type === 'short_answer' || type === 'fill_blank') ? '' : 0,
        points:      1,
        explanation: '',
        image:       '',
    }
}

function calcMaxScore(questions) {
    return questions.reduce((s, q) => s + (parseInt(q.points) || 1), 0)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function submissionPill(a) {
    if (a.submitted === null || a.submitted === undefined || a.mode === 'paper')
        return { label: 'Not tracked', bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    if (a.status === 'draft')
        return { label: 'Draft', bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    const pct = a.total ? (a.submitted / a.total) * 100 : 0
    if (pct === 100) return { label: `${a.submitted}/${a.total} submitted`, bg: 'rgba(16,185,129,0.12)', color: 'var(--success)'     }
    if (pct >= 50)   return { label: `${a.submitted}/${a.total} submitted`, bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)'      }
    return                  { label: `${a.submitted}/${a.total} submitted`, bg: 'rgba(239,68,68,0.1)',   color: 'var(--destructive)' }
}

// ── Styled form select ────────────────────────────────────────────────────────

function FormSelect({ value, onChange, options, placeholder, disabled }) {
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
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={`form-select-btn${selected ? ' has-value' : ''}`}
                style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="form-select-menu">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`form-select-opt${value === opt.value ? ' active' : ''}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Single Quiz Question Editor ───────────────────────────────────────────────

function QuestionEditor({ q, qi, onChange, onRemove, onSaveToBank, onMoveUp, onMoveDown, isFirst, isLast }) {
    const qType = QUESTION_TYPES.find(t => t.value === q.type)

    function set(field, value) { onChange({ ...q, [field]: value }) }

    function setOption(idx, value) {
        const opts = [...q.options]; opts[idx] = value; set('options', opts)
    }

    function addOption() { set('options', [...q.options, '']) }
    function removeOption(idx) {
        const opts = q.options.filter((_, i) => i !== idx)
        set('options', opts)
        if (q.correct >= opts.length) set('correct', Math.max(0, opts.length - 1))
    }

    function handleImage(e) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onloadend = () => set('image', reader.result)
        reader.readAsDataURL(file)
    }

    const imgRef = useRef()

    return (
        <div className="quiz-q" style={{ position: 'relative' }}>
            {/* Question header row */}
            <div className="quiz-q-header" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="quiz-q-num">{qi + 1}</span>

                {/* Type selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        {QUESTION_TYPES.map(t => (
                            <button key={t.value} type="button"
                                onClick={() => {
                                    const updated = { ...q, type: t.value }
                                    if (t.value === 'true_false') { updated.options = []; updated.correct = 0 }
                                    else if (t.value === 'mcq' && q.options.length === 0) { updated.options = ['', '', '', '']; updated.correct = 0 }
                                    else if (t.value === 'short_answer' || t.value === 'fill_blank') { updated.options = []; updated.correct = '' }
                                    onChange(updated)
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.73rem',
                                    border: `1px solid ${q.type === t.value ? 'var(--primary)' : 'var(--border)'}`,
                                    background: q.type === t.value ? 'var(--primary-light, #e8f2ff)' : 'transparent',
                                    color: q.type === t.value ? 'var(--primary)' : 'var(--muted-foreground)',
                                    cursor: 'pointer',
                                }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Question text */}
                    {q.type === 'fill_blank' ? (
                        <div>
                            <input
                                className="form-control"
                                placeholder={`Question ${qi + 1}… use ____ for the blank (e.g. "The capital of France is ____.") `}
                                value={q.text}
                                onChange={e => set('text', e.target.value)}
                            />
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                                Use ____ (four underscores) to mark the blank position.
                            </div>
                        </div>
                    ) : (
                        <input
                            className="form-control"
                            placeholder={`Question ${qi + 1}…`}
                            value={q.text}
                            onChange={e => set('text', e.target.value)}
                        />
                    )}
                </div>

                {/* Move + delete */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    {!isFirst && (
                        <button type="button" className="quiz-q-delete" onClick={onMoveUp} title="Move up">
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_upward</span>
                        </button>
                    )}
                    {!isLast && (
                        <button type="button" className="quiz-q-delete" onClick={onMoveDown} title="Move down">
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>arrow_downward</span>
                        </button>
                    )}
                    <button type="button" className="quiz-q-delete" onClick={onRemove} title="Delete question">
                        <span className="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>

            {/* Image attachment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.4rem 0' }}>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
                {q.image ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src={q.image} alt="question" style={{ maxHeight: 80, borderRadius: 6, border: '1px solid var(--border)' }} />
                        <button type="button" className="quiz-q-delete" onClick={() => set('image', '')} title="Remove image">
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={() => imgRef.current.click()}
                        style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '0.2rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add_photo_alternate</span>
                        Add image
                    </button>
                )}
            </div>

            {/* Answer options */}
            <div className="quiz-q-options">
                {q.type === 'mcq' && (
                    <>
                        {q.options.map((opt, oi) => (
                            <div key={oi} className={`quiz-q-option${q.correct === oi ? ' correct' : ''}`}>
                                <input type="radio" name={`correct-${q.id}`}
                                    checked={q.correct === oi} onChange={() => set('correct', oi)} />
                                <input className="quiz-q-option-input"
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                    value={opt} onChange={e => setOption(oi, e.target.value)} />
                                {q.options.length > 2 && (
                                    <button type="button" className="quiz-q-delete" onClick={() => removeOption(oi)}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>remove</span>
                                    </button>
                                )}
                            </div>
                        ))}
                        {q.options.length < 6 && (
                            <button type="button" onClick={addOption}
                                style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span>
                                Add option
                            </button>
                        )}
                        <div className="quiz-q-help">
                            <span className="material-symbols-rounded">check_circle</span>
                            {' '}Select the radio button next to the correct answer.
                        </div>
                    </>
                )}

                {q.type === 'true_false' && (
                    <>
                        {['True', 'False'].map((label, oi) => (
                            <div key={oi} className={`quiz-q-option${q.correct === oi ? ' correct' : ''}`}>
                                <input type="radio" name={`correct-${q.id}`}
                                    checked={q.correct === oi} onChange={() => set('correct', oi)} />
                                <span style={{ fontWeight: 500 }}>{label}</span>
                            </div>
                        ))}
                        <div className="quiz-q-help">
                            <span className="material-symbols-rounded">check_circle</span>
                            {' '}Select the correct answer (True or False).
                        </div>
                    </>
                )}

                {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                    <div style={{ marginTop: '0.4rem' }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                            {q.type === 'fill_blank' ? 'Expected answer (for the blank)' : 'Model answer'}{' '}
                            <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(used for auto-grading)</span>
                        </label>
                        <input className="form-control"
                            placeholder={q.type === 'fill_blank' ? 'e.g. Paris' : 'e.g. Newton\'s first law of motion'}
                            value={q.correct || ''}
                            onChange={e => set('correct', e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Points + explanation row */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Points:</label>
                    <input type="number" min="1" max="100"
                        className="form-control"
                        style={{ width: 70, padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
                        value={q.points} onChange={e => set('points', Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <input className="form-control"
                        placeholder="Explanation (shown to students after submission, optional)…"
                        style={{ fontSize: '0.82rem' }}
                        value={q.explanation} onChange={e => set('explanation', e.target.value)} />
                </div>
                <button type="button"
                    onClick={() => onSaveToBank(q)}
                    title="Save to question bank"
                    style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>bookmark_add</span>
                    Save to bank
                </button>
            </div>
        </div>
    )
}

// ── Quiz Builder ──────────────────────────────────────────────────────────────

function QuizBuilder({ questions, onChange, subjects, onOpenBank }) {
    function update(id, updated) { onChange(questions.map(q => q.id === id ? updated : q)) }
    function remove(id)          { onChange(questions.filter(q => q.id !== id)) }
    function moveUp(idx) {
        if (idx === 0) return
        const qs = [...questions]
        ;[qs[idx - 1], qs[idx]] = [qs[idx], qs[idx - 1]]
        onChange(qs)
    }
    function moveDown(idx) {
        if (idx === questions.length - 1) return
        const qs = [...questions]
        ;[qs[idx], qs[idx + 1]] = [qs[idx + 1], qs[idx]]
        onChange(qs)
    }

    async function saveToBank(q) {
        try {
            await saveToQuestionBank({
                question_type:  q.type,
                text:           q.text,
                options:        q.options,
                correct_answer: q.correct,
                explanation:    q.explanation,
                points:         q.points,
                image:          q.image,
            })
            alert('Question saved to bank.')
        } catch { alert('Failed to save question.') }
    }

    const totalPoints = calcMaxScore(questions)

    return (
        <div>
            {questions.length === 0 ? (
                <div className="quiz-q-empty">No questions yet. Add a question type below or import from your bank.</div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
                        <span className="quiz-section-count">{questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} mark{totalPoints !== 1 ? 's' : ''} total</span>
                    </div>
                    {questions.map((q, qi) => (
                        <QuestionEditor key={q.id} q={q} qi={qi}
                            onChange={updated => update(q.id, updated)}
                            onRemove={() => remove(q.id)}
                            onSaveToBank={saveToBank}
                            onMoveUp={() => moveUp(qi)}
                            onMoveDown={() => moveDown(qi)}
                            isFirst={qi === 0}
                            isLast={qi === questions.length - 1}
                        />
                    ))}
                </>
            )}

            {/* Add buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {QUESTION_TYPES.map(t => (
                    <button key={t.value} type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onChange([...questions, newQuestion(t.value)])}>
                        <span className="material-symbols-rounded icon-sm">{t.icon}</span>
                        + {t.label}
                    </button>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={onOpenBank}
                    style={{ marginLeft: 'auto' }}>
                    <span className="material-symbols-rounded icon-sm">library_books</span>
                    Import from Bank
                </button>
            </div>
        </div>
    )
}

// ── Question Bank Modal ───────────────────────────────────────────────────────

function QuestionBankModal({ onClose, onImport }) {
    const [bank,    setBank]    = useState([])
    const [loading, setLoading] = useState(true)
    const [search,  setSearch]  = useState('')
    const [typeF,   setTypeF]   = useState('')
    const [scope,   setScope]   = useState('')   // '' | 'mine' | 'shared'
    const [selected, setSelected] = useState(new Set())

    useEffect(() => {
        getQuestionBank(scope ? { scope } : undefined)
            .then(data => setBank(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [scope])

    const filtered = bank.filter(q => {
        if (typeF && q.question_type !== typeF) return false
        if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    async function toggleShare(q) {
        const updated = await patchQuestionBank(q.id, { is_shared: !q.is_shared }).catch(() => null)
        if (updated) setBank(prev => prev.map(b => b.id === q.id ? { ...b, is_shared: updated.is_shared } : b))
    }

    function toggle(id) {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    async function handleDelete(id) {
        await deleteFromQuestionBank(id).catch(() => {})
        setBank(prev => prev.filter(q => q.id !== id))
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    }

    function handleImport() {
        const toImport = filtered.filter(q => selected.has(q.id)).map(q => ({
            id:          String(Date.now() + Math.random()),
            type:        q.question_type,
            text:        q.text,
            options:     q.options || [],
            correct:     q.correct_answer ?? (q.question_type === 'mcq' || q.question_type === 'true_false' ? 0 : ''),
            points:      q.points || 1,
            explanation: q.explanation || '',
            image:       q.image || '',
        }))
        onImport(toImport)
        onClose()
    }

    const typeLabel = { mcq: 'MCQ', true_false: 'T/F', short_answer: 'Short', fill_blank: 'Fill' }

    return (
        <Modal title="Question Bank" icon="library_books" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">{selected.size} question{selected.size !== 1 ? 's' : ''} selected</span>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={selected.size === 0} onClick={handleImport}>
                        <span className="material-symbols-rounded icon-sm">add</span>
                        Import Selected
                    </button>
                </div>
            }>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <input className="form-control" placeholder="Search questions…" style={{ flex: 1, minWidth: 180 }}
                    value={search} onChange={e => setSearch(e.target.value)} />
                <select className="form-control" style={{ width: 150 }} value={scope} onChange={e => setScope(e.target.value)}
                    aria-label="Question scope">
                    <option value="">All questions</option>
                    <option value="mine">My questions</option>
                    <option value="shared">Shared with me</option>
                </select>
                <select className="form-control" style={{ width: 160 }} value={typeF} onChange={e => setTypeF(e.target.value)}>
                    <option value="">All types</option>
                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>
            {loading ? (
                <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
            ) : filtered.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)' }}>No saved questions{search || typeF ? ' matching your filters' : ' yet'}.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 400, overflowY: 'auto' }}>
                    {filtered.map(q => (
                        <div key={q.id} onClick={() => toggle(q.id)}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                                padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                                border: `1px solid ${selected.has(q.id) ? 'var(--primary)' : 'var(--border)'}`,
                                background: selected.has(q.id) ? 'var(--primary-light, #e8f2ff)' : 'var(--card)',
                            }}>
                            <input type="checkbox" readOnly checked={selected.has(q.id)}
                                style={{ width: '1rem', height: '1rem', marginTop: '0.1rem', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{q.text || '(no text)'}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                                    {typeLabel[q.question_type] || q.question_type} · {q.points} pt{q.points !== 1 ? 's' : ''}
                                    {q.subject_name ? ` · ${q.subject_name}` : ''}
                                    {q.is_mine === false && q.teacher_name ? ` · Shared by ${q.teacher_name}` : ''}
                                    {q.is_mine !== false && q.is_shared ? ' · Shared' : ''}
                                </div>
                            </div>
                            {q.is_mine !== false && (
                                <button type="button"
                                    onClick={e => { e.stopPropagation(); toggleShare(q) }}
                                    title={q.is_shared ? 'Stop sharing with other teachers' : 'Share with other teachers'}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: q.is_shared ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                                        {q.is_shared ? 'group' : 'group_off'}
                                    </span>
                                </button>
                            )}
                            {q.is_mine !== false && (
                                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(q.id) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    )
}

// ── Teacher Preview Modal ─────────────────────────────────────────────────────

function PreviewModal({ assignment, questions, onClose }) {
    const [answers,  setAnswers]  = useState({})
    const [revealed, setRevealed] = useState(false)
    const displayQ = assignment.shuffle_questions
        ? [...questions].sort(() => Math.random() - 0.5)
        : questions

    function score() {
        return displayQ.reduce((total, q) => {
            const a = answers[q.id]
            if (a === undefined || a === '' || a === null) return total
            const pts = parseInt(q.points) || 1
            let correct = false
            if (q.type === 'mcq' || q.type === 'true_false') correct = parseInt(a) === parseInt(q.correct)
            else correct = String(a).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase()
            return total + (correct ? pts : 0)
        }, 0)
    }

    return (
        <Modal title={`Preview: ${assignment.title}`} icon="preview" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint" style={{ color: 'var(--muted-foreground)' }}>
                        This is how students will see the quiz. Correct answers are hidden.
                    </span>
                    <button className="btn btn-outline" onClick={() => setRevealed(r => !r)}>
                        <span className="material-symbols-rounded icon-sm">{revealed ? 'visibility_off' : 'visibility'}</span>
                        {revealed ? 'Hide' : 'Reveal'} answers
                    </button>
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                </div>
            }>
            {/* Quiz header */}
            <div style={{ background: 'var(--muted)', borderRadius: 10, padding: '0.875rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{assignment.title}</div>
                {assignment.instructions && (
                    <div style={{ fontSize: '0.83rem', color: 'var(--muted-foreground)', whiteSpace: 'pre-wrap' }}>{assignment.instructions}</div>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                    <span><strong>{calcMaxScore(questions)}</strong> marks total</span>
                    <span><strong>{questions.length}</strong> questions</span>
                    {assignment.time_limit_minutes && <span><strong>{assignment.time_limit_minutes}</strong> min limit</span>}
                    {assignment.shuffle_questions && <span>Questions are shuffled</span>}
                </div>
            </div>

            {/* Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {displayQ.map((q, qi) => {
                    const studentAns = answers[q.id]
                    const isCorrect = revealed && studentAns !== undefined && studentAns !== '' && (() => {
                        if (q.type === 'mcq' || q.type === 'true_false') return parseInt(studentAns) === parseInt(q.correct)
                        return String(studentAns).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase()
                    })()

                    return (
                        <div key={q.id} style={{
                            border: `1px solid ${revealed && studentAns !== undefined ? (isCorrect ? 'var(--success)' : '#dc2626') : 'var(--border)'}`,
                            borderRadius: 10, padding: '0.875rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{qi + 1}. {q.text || '(empty question)'}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                            </div>
                            {q.image && <img src={q.image} alt="question" style={{ maxHeight: 120, borderRadius: 6, marginBottom: '0.5rem', display: 'block' }} />}

                            {(q.type === 'mcq') && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {q.options.map((opt, oi) => (
                                        <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                                            color: revealed && oi === parseInt(q.correct) ? 'var(--success)' : 'inherit',
                                            fontWeight: revealed && oi === parseInt(q.correct) ? 600 : 400 }}>
                                            <input type="radio" name={`prev-${q.id}`}
                                                checked={answers[q.id] === oi}
                                                onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                                            {opt || `Option ${String.fromCharCode(65 + oi)}`}
                                            {revealed && oi === parseInt(q.correct) && <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', color: 'var(--success)' }}>check</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {q.type === 'true_false' && (
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {['True', 'False'].map((label, oi) => (
                                        <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                                            color: revealed && oi === parseInt(q.correct) ? 'var(--success)' : 'inherit',
                                            fontWeight: revealed && oi === parseInt(q.correct) ? 600 : 400 }}>
                                            <input type="radio" name={`prev-${q.id}`}
                                                checked={answers[q.id] === oi}
                                                onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                                            {label}
                                            {revealed && oi === parseInt(q.correct) && <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', color: 'var(--success)' }}>check</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                                <div>
                                    <input className="form-control" placeholder="Student types answer here…"
                                        value={answers[q.id] || ''}
                                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                                    {revealed && q.correct && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                                            Model answer: <strong>{q.correct}</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                            {revealed && q.explanation && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '0.4rem 0.6rem', borderRadius: 6 }}>
                                    {q.explanation}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {revealed && Object.keys(answers).length > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--muted)', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem' }}>
                    Preview score: {score()} / {calcMaxScore(questions)}
                </div>
            )}
        </Modal>
    )
}

// ── Paper Grading Modal ───────────────────────────────────────────────────────

function GradeModal({ assignment, onClose }) {
    const [sheet,   setSheet]   = useState(null)
    const [scores,  setScores]  = useState({})
    const [loading, setLoading] = useState(true)
    const [saving,  setSaving]  = useState(false)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        getAssignmentGradeSheet(assignment.id)
            .then(data => {
                setSheet(data)
                const init = {}
                for (const s of data.students || []) {
                    if (s.score !== null && s.score !== undefined) init[s.student_id] = String(s.score)
                }
                setScores(init)
            })
            .catch(() => setMessage({ type: 'error', text: 'Failed to load the class roster.' }))
            .finally(() => setLoading(false))
    }, [assignment.id])

    const maxScore = sheet?.max_score || assignment.max_score

    function setScore(studentId, value) {
        setScores(prev => ({ ...prev, [studentId]: value }))
    }

    async function handleSave() {
        setSaving(true); setMessage(null)
        try {
            const records = Object.entries(scores)
                .filter(([, v]) => v !== '')
                .map(([student_id, score]) => ({ student_id, score }))
            const res = await saveAssignmentGrades(assignment.id, records)
            if (res.errors?.length) {
                setMessage({ type: 'error', text: `${res.saved} saved, ${res.errors.length} rejected (check scores are 0–${maxScore}).` })
            } else {
                setMessage({ type: 'success', text: `Saved ${res.saved} score${res.saved !== 1 ? 's' : ''}.` })
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save scores.' })
        } finally {
            setSaving(false)
        }
    }

    const gradedCount = Object.values(scores).filter(v => v !== '').length

    return (
        <Modal title={`Grade — ${assignment.title}`} icon="edit_note" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint"
                        style={{ color: message?.type === 'error' ? '#dc2626' : message?.type === 'success' ? 'var(--success)' : undefined }}>
                        {message?.text || `${gradedCount}/${sheet?.students?.length ?? 0} graded · out of ${maxScore}`}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
                        <span className="material-symbols-rounded icon-sm">save</span>
                        {saving ? 'Saving…' : 'Save Scores'}
                    </button>
                </div>
            }>
            {loading ? (
                <p style={{ color: 'var(--muted-foreground)' }}>Loading roster…</p>
            ) : !sheet?.students?.length ? (
                <p style={{ color: 'var(--muted-foreground)' }}>No students found in {assignment.class_name}.</p>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th style={{ width: 140 }}>Score (/{maxScore})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sheet.students.map(s => (
                                <tr key={s.student_id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{s.full_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{s.student_code}</div>
                                    </td>
                                    <td>
                                        <input
                                            type="number" min="0" max={maxScore}
                                            className="form-control"
                                            style={{ width: 110, padding: '0.3rem 0.5rem' }}
                                            aria-label={`Score for ${s.full_name}`}
                                            value={scores[s.student_id] ?? ''}
                                            onChange={e => setScore(s.student_id, e.target.value)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    )
}

// ── Submissions Modal ─────────────────────────────────────────────────────────

function SubmissionsModal({ assignment, onClose }) {
    const [subs,    setSubs]    = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getAssignmentSubmissions(assignment.id)
            .then(data => setSubs(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [assignment.id])

    return (
        <Modal title={`Submissions — ${assignment.title}`} icon="fact_check" onClose={onClose} size="wide"
            footer={<div className="modal-footer-row"><button className="btn btn-outline" onClick={onClose}>Close</button></div>}>
            {loading ? (
                <p style={{ color: 'var(--muted-foreground)' }}>Loading submissions…</p>
            ) : subs.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)' }}>No submissions yet.</p>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Submitted</th>
                                <th>Late</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subs.map(s => (
                                <tr key={s.id}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{s.student_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{s.student_code}</div>
                                    </td>
                                    <td>{s.score} / {s.max_score}</td>
                                    <td>
                                        <span style={{
                                            fontWeight: 600,
                                            color: s.percentage >= 50 ? 'var(--success)' : '#dc2626'
                                        }}>{s.percentage}%</span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>{new Date(s.submitted_at).toLocaleString()}</td>
                                    <td>{s.is_late ? <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>Late</span> : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    )
}

// ── Assignment Modal ──────────────────────────────────────────────────────────

function AssignmentModal({ initial, onClose, onSave, teacherClasses, classSubjectMap, saving, saveError }) {
    const [form, setForm] = useState(initial
        ? {
            title:               initial.title,
            class_obj:           String(initial.class_id),
            subject:             String(initial.subject_id),
            due_date:            initial.due_date,
            max_score:           String(initial.max_score),
            instructions:        initial.instructions || '',
            status:              initial.status,
            mode:                initial.mode,
            time_limit_minutes:  initial.time_limit_minutes ? String(initial.time_limit_minutes) : '',
            shuffle_questions:   initial.shuffle_questions || false,
        }
        : { ...EMPTY_FORM }
    )
    const [questions,    setQuestions]    = useState(initial?.questions?.length ? initial.questions : [])
    const [showBank,     setShowBank]     = useState(false)
    const [showPreview,  setShowPreview]  = useState(false)

    function handle(e) {
        const { name, value, type, checked } = e.target
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    // When class changes, reset subject if it's no longer valid for the new class
    function handleClassChange(v) {
        setForm(prev => {
            const validSubjectIds = (classSubjectMap || [])
                .filter(cs => String(cs.class_id) === String(v))
                .map(cs => String(cs.subject_id))
            return {
                ...prev,
                class_obj: v,
                subject: validSubjectIds.includes(String(prev.subject)) ? prev.subject : '',
            }
        })
    }

    function handleSave() {
        if (!form.title || !form.class_obj || !form.subject || !form.due_date) return
        if (form.mode === 'paper' && !form.max_score) return
        if (form.mode === 'online' && questions.length === 0) return
        const ms = form.mode === 'online' ? calcMaxScore(questions) : parseInt(form.max_score)
        onSave({
            title:              form.title,
            class_obj:          form.class_obj,
            subject:            form.subject,
            due_date:           form.due_date,
            max_score:          ms,
            instructions:       form.instructions,
            status:             form.status,
            mode:               form.mode,
            questions:          form.mode === 'online' ? questions : [],
            time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes) : null,
            shuffle_questions:  form.mode === 'online' ? form.shuffle_questions : false,
        })
    }

    const isValid = form.title && form.class_obj && form.subject && form.due_date &&
        (form.mode === 'paper' ? !!form.max_score : questions.length > 0)

    // Class dropdown: unique classes this teacher teaches
    const classOptions = teacherClasses.map(c => ({ value: String(c.class_id), label: c.class_name }))

    // Subject dropdown: only subjects this teacher teaches in the selected class
    const subjectOptions = form.class_obj
        ? (classSubjectMap || [])
            .filter(cs => String(cs.class_id) === String(form.class_obj))
            .map(cs => ({ value: String(cs.subject_id), label: cs.subject_name }))
        : []

    return (
        <>
            {showBank && (
                <QuestionBankModal
                    onClose={() => setShowBank(false)}
                    onImport={qs => setQuestions(prev => [...prev, ...qs])}
                />
            )}
            {showPreview && form.mode === 'online' && (
                <PreviewModal
                    assignment={form}
                    questions={questions}
                    onClose={() => setShowPreview(false)}
                />
            )}
            <Modal
                title={initial ? 'Edit Assignment' : 'New Assignment'}
                icon="assignment"
                onClose={onClose}
                size="wide"
                footer={
                    <div className="modal-footer-row">
                        <span className="modal-footer-hint" style={{ color: saveError ? '#dc2626' : undefined }}>
                            {saveError || (!isValid && '* Fill in all required fields') || (form.mode === 'online' && questions.length === 0 && '* Add at least one question')}
                        </span>
                        {form.mode === 'online' && questions.length > 0 && (
                            <button className="btn btn-outline" type="button" onClick={() => setShowPreview(true)}>
                                <span className="material-symbols-rounded icon-sm">preview</span>
                                Preview
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" disabled={!isValid || saving} onClick={handleSave}>
                            <span className="material-symbols-rounded icon-sm">
                                {form.status === 'draft' ? 'save' : 'publish'}
                            </span>
                            {saving ? 'Saving…' : form.status === 'draft' ? 'Save as Draft' : 'Publish'}
                        </button>
                    </div>
                }
            >
                {/* Mode toggle */}
                <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                        { key: 'paper',  icon: 'assignment', label: 'Paper Assignment', sub: 'Manual grading' },
                        { key: 'online', icon: 'quiz',        label: 'Online Quiz',      sub: 'Auto-marked'   },
                    ].map(m => (
                        <button key={m.key} onClick={() => setForm(p => ({ ...p, mode: m.key }))}
                            className={`mode-toggle-btn${form.mode === m.key ? ' active' : ''}`}
                            style={{
                                border:     `2px solid ${form.mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                                background: form.mode === m.key ? 'var(--primary-light, #e8f2ff)' : 'var(--card)',
                            }}>
                            <div className="mode-toggle-btn-header">
                                <span className="material-symbols-rounded mode-toggle-btn-icon">{m.icon}</span>
                                <span className="mode-toggle-btn-label">{m.label}</span>
                            </div>
                            <div className="mode-toggle-btn-sub">{m.sub}</div>
                        </button>
                    ))}
                </div>

                <div className="section-label-sm">Assignment Details</div>

                <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="form-group col-full">
                        <label className="form-label">Title *</label>
                        <input className="form-control" name="title" value={form.title} onChange={handle}
                            placeholder={form.mode === 'online' ? 'e.g. Chapter 6 Quiz' : 'e.g. Problem Set 4'} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Class *</label>
                        <FormSelect value={form.class_obj}
                            onChange={handleClassChange}
                            placeholder="— Select class —" options={classOptions} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Subject *</label>
                        <FormSelect value={form.subject}
                            onChange={v => setForm(p => ({ ...p, subject: v }))}
                            placeholder={form.class_obj ? '— Select subject —' : '— Select a class first —'}
                            disabled={!form.class_obj || subjectOptions.length === 0}
                            options={subjectOptions} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Due Date *</label>
                        <input className="form-control input-icon-field" type="date" name="due_date" value={form.due_date} onChange={handle} />
                    </div>
                    {form.mode === 'paper' && (
                        <div className="form-group">
                            <label className="form-label">Max Score *</label>
                            <input className="form-control" type="number" min="1" name="max_score"
                                value={form.max_score} onChange={handle} placeholder="e.g. 30" />
                        </div>
                    )}
                    {form.mode === 'online' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Time Limit <span className="label-muted">(minutes, optional)</span></label>
                                <input className="form-control" type="number" min="1" name="time_limit_minutes"
                                    value={form.time_limit_minutes} onChange={handle} placeholder="e.g. 30 (leave blank for unlimited)" />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.6rem' }}>
                                <input type="checkbox" id="shuffle" name="shuffle_questions"
                                    checked={form.shuffle_questions} onChange={handle}
                                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }} />
                                <label htmlFor="shuffle" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                                    Shuffle question order per student
                                </label>
                            </div>
                        </>
                    )}
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <FormSelect value={form.status}
                            onChange={v => setForm(p => ({ ...p, status: v }))}
                            placeholder=""
                            options={[
                                { value: 'draft',  label: 'Save as draft' },
                                { value: 'active', label: 'Publish now'   },
                            ]} />
                    </div>
                </div>

                {form.mode === 'paper' && (
                    <div className="form-group mb-1">
                        <label className="form-label">Instructions</label>
                        <textarea className="form-control textarea-sm" name="instructions" value={form.instructions} onChange={handle}
                            placeholder="Describe the assignment…" />
                    </div>
                )}

                {form.mode === 'online' && (
                    <>
                        <div className="quiz-section-header">
                            <div className="section-label-sm" style={{ marginBottom: 0 }}>Quiz Questions</div>
                        </div>
                        <QuizBuilder
                            questions={questions}
                            onChange={setQuestions}
                            subjects={subjects}
                            onOpenBank={() => setShowBank(true)}
                        />
                    </>
                )}
            </Modal>
        </>
    )
}

// ── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({ a, onEdit, onDelete, onPublish, onDuplicate, onViewSubmissions, onGrade, publishing }) {
    const pill = submissionPill(a)
    const statusStyle = {
        active: { bg: 'rgba(16,185,129,0.1)',  color: 'var(--success)'          },
        draft:  { bg: 'rgba(245,158,11,0.1)',  color: 'var(--warning)'          },
        closed: { bg: 'var(--muted)',           color: 'var(--muted-foreground)' },
    }[a.status] || { bg: 'var(--muted)', color: 'var(--muted-foreground)' }

    return (
        <div className="card asgn-card">
            <div className={`asgn-icon ${a.mode === 'online' ? 'online' : 'paper'}`}>
                <span className="material-symbols-rounded">{a.mode === 'online' ? 'quiz' : 'assignment'}</span>
            </div>
            <div className="asgn-body">
                <div className="asgn-header">
                    <div className="asgn-title">{a.title}</div>
                    {a.mode === 'online' && a.status === 'active' && (
                        <span className="asgn-sub-pill" style={{ background: pill.bg, color: pill.color }}>{pill.label}</span>
                    )}
                </div>
                <div className="asgn-meta">
                    <span className="asgn-meta-text">{a.subject_name} · {a.class_name}</span>
                    <span className="asgn-meta-text">Due {a.due_date}</span>
                    <span className="asgn-meta-text">Max: {a.max_score}</span>
                    {a.time_limit_minutes && <span className="asgn-meta-text">{a.time_limit_minutes} min</span>}
                    <span className="asgn-chip" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                    <span className="asgn-chip" style={{
                        background: a.mode === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color:      a.mode === 'online' ? 'var(--success)'        : '#6366f1',
                    }}>
                        {a.mode === 'online' ? 'Online' : 'Paper'}
                    </span>
                    {a.shuffle_questions && (
                        <span className="asgn-chip" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                            Shuffled
                        </span>
                    )}
                </div>
                <div className="asgn-actions">
                    {a.status === 'draft' && (
                        <button className="btn btn-sm btn-primary" onClick={() => onPublish(a.id)} disabled={publishing === a.id}>
                            <span className="material-symbols-rounded icon-sm">publish</span>
                            {publishing === a.id ? 'Publishing…' : 'Publish'}
                        </button>
                    )}
                    {a.mode === 'online' && a.status === 'active' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onViewSubmissions(a)} title="View submissions">
                            <span className="material-symbols-rounded icon-sm">fact_check</span>
                            Submissions
                        </button>
                    )}
                    {a.mode === 'paper' && a.status === 'active' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onGrade(a)} title="Enter scores">
                            <span className="material-symbols-rounded icon-sm">edit_note</span>
                            Grade
                        </button>
                    )}
                    {a.status !== 'closed' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(a)} title="Edit">
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => onDuplicate(a)} title="Duplicate">
                        <span className="material-symbols-rounded icon-sm">content_copy</span>
                    </button>
                    <button className="btn btn-outline btn-sm btn-destructive-outline" onClick={() => onDelete(a.id)} title="Delete">
                        <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Class filter dropdown ─────────────────────────────────────────────────────

function ClassDropdown({ value, onChange, options }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    return (
        <div ref={ref} className="class-dd-wrap">
            <button className="btn btn-outline" style={{ fontSize: '0.82rem', gap: '0.4rem', minWidth: 120 }} onClick={() => setOpen(o => !o)}>
                <span className="material-symbols-rounded icon-md">class</span>
                {value === 'all' ? 'All Classes' : value}
                <span className="material-symbols-rounded icon-md ml-auto">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="class-dd-menu">
                    {[{ key: 'all', label: 'All Classes' }, ...options.map(o => ({ key: o, label: o }))].map(item => (
                        <button key={item.key} onClick={() => { onChange(item.key); setOpen(false) }}
                            className={`class-dd-opt${value === item.key ? ' active' : ''}`}>
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
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [myClasses,       setMyClasses]       = useState([])
    const [classSubjectMap, setClassSubjectMap] = useState([])  // full list: [{class_id, class_name, subject_id, subject_name}]
    const [subjects,        setSubjects]        = useState([])
    const [assignments,     setAssignments]     = useState([])
    const [loading,      setLoading]      = useState(true)
    const [loadError,    setLoadError]    = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [classFilter,  setClassFilter]  = useState('all')
    const [isOpen,       setIsOpen]       = useState(false)
    const [editing,      setEditing]      = useState(null)
    const [saving,       setSaving]       = useState(false)
    const [saveError,    setSaveError]    = useState(null)
    const [publishing,   setPublishing]   = useState(null)
    const [viewSubs,     setViewSubs]     = useState(null)   // assignment to view submissions for
    const [grading,      setGrading]      = useState(null)   // paper assignment being graded

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        Promise.all([getTeacherMyClasses(), getTeacherSubjects(), getTeacherAssignments()])
            .then(([classList, subjectList, asgList]) => {
                const rawList = Array.isArray(classList) ? classList : []
                setClassSubjectMap(rawList)  // keep full list for subject filtering
                const seen = new Set()
                const unique = rawList.filter(c => {
                    if (seen.has(c.class_id)) return false
                    seen.add(c.class_id); return true
                })
                setMyClasses(unique)
                setSubjects(Array.isArray(subjectList) ? subjectList : [])
                setAssignments(Array.isArray(asgList) ? asgList : [])
            })
            .catch(err => setLoadError(err?.message || 'Failed to load.'))
            .finally(() => setLoading(false))
    }, [])

    const classNames = [...new Set(assignments.map(a => a.class_name).filter(Boolean))]
    const statusTabs = STATUS_TABS.map(t => ({
        ...t,
        count: t.key === 'all' ? undefined : assignments.filter(a => a.status === t.key).length,
    }))

    const visible = assignments.filter(a => {
        if (statusFilter !== 'all' && a.status !== statusFilter)   return false
        if (classFilter  !== 'all' && a.class_name !== classFilter) return false
        return true
    })

    async function handleSave(data) {
        setSaving(true); setSaveError(null)
        try {
            if (editing) {
                const updated = await updateTeacherAssignment(editing.id, data)
                setAssignments(prev => prev.map(a => a.id === editing.id ? updated : a))
            } else {
                const created = await createTeacherAssignment(data)
                setAssignments(prev => [created, ...prev])
            }
            setIsOpen(false); setEditing(null)
        } catch (e) {
            setSaveError(e?.response?.data ? JSON.stringify(e.response.data) : e?.message || 'Failed to save.')
        } finally {
            setSaving(false)
        }
    }

    async function handlePublish(id) {
        setPublishing(id)
        try {
            const updated = await updateTeacherAssignment(id, { status: 'active' })
            setAssignments(prev => prev.map(a => a.id === id ? updated : a))
        } catch { /* leave as draft */ }
        finally { setPublishing(null) }
    }

    async function handleDelete(id) {
        try {
            await deleteTeacherAssignment(id)
            setAssignments(prev => prev.filter(a => a.id !== id))
        } catch { /* silent */ }
    }

    async function handleDuplicate(a) {
        try {
            const created = await createTeacherAssignment({
                title:              `Copy of ${a.title}`,
                class_obj:          a.class_id,
                subject:            a.subject_id,
                mode:               a.mode,
                status:             'draft',
                due_date:           a.due_date,
                max_score:          a.max_score,
                instructions:       a.instructions || '',
                questions:          a.questions || [],
                time_limit_minutes: a.time_limit_minutes || null,
                shuffle_questions:  a.shuffle_questions || false,
            })
            setAssignments(prev => [created, ...prev])
        } catch { /* silent */ }
    }

    function handleEdit(a)  { setEditing(a); setSaveError(null); setIsOpen(true) }
    function handleClose()  { setIsOpen(false); setEditing(null); setSaveError(null) }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>

            {isOpen && (
                <AssignmentModal
                    initial={editing}
                    onClose={handleClose}
                    onSave={handleSave}
                    teacherClasses={myClasses}
                    classSubjectMap={classSubjectMap}
                    saving={saving}
                    saveError={saveError}
                />
            )}

            {viewSubs && (
                <SubmissionsModal assignment={viewSubs} onClose={() => setViewSubs(null)} />
            )}

            {grading && (
                <GradeModal assignment={grading} onClose={() => setGrading(null)} />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Assignments"
                        subtitle="Create, manage and track student assignments"
                        userName={fullName} userRole="Teacher"
                        userInitials={initials} avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loadError && (
                            <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.4rem' }}>error</span>
                                {loadError}
                            </div>
                        )}

                        <div className="portal-stat-grid mb-1-5">
                            {[
                                { icon: 'assignment',   value: assignments.length,                                    label: 'Total',          colorClass: ''        },
                                { icon: 'check_circle', value: assignments.filter(a => a.status === 'active').length, label: 'Active',         colorClass: 'success' },
                                { icon: 'quiz',         value: assignments.filter(a => a.mode === 'online').length,   label: 'Online Quizzes', colorClass: ''        },
                                { icon: 'draft',        value: assignments.filter(a => a.status === 'draft').length,  label: 'Drafts',         colorClass: 'warning' },
                            ].map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="asgn-toolbar">
                            <FilterBar options={statusTabs} active={statusFilter} onChange={setStatusFilter} />
                            <div className="asgn-toolbar-right">
                                <ClassDropdown value={classFilter} onChange={setClassFilter} options={classNames} />
                                <button className="btn btn-primary whitespace-nowrap"
                                    onClick={() => { setEditing(null); setSaveError(null); setIsOpen(true) }}>
                                    <span className="material-symbols-rounded icon-sm">add</span>
                                    New Assignment
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <EmptyState icon="sync" title="Loading assignments…" description="Fetching your assignments." />
                        ) : visible.length > 0 ? (
                            <div className="asgn-list-wrap">
                                <div className="asgn-list-header">
                                    <span className="asgn-list-count">{visible.length} assignment{visible.length !== 1 ? 's' : ''}</span>
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
                                                onDuplicate={handleDuplicate}
                                                onViewSubmissions={setViewSubs}
                                                onGrade={setGrading}
                                                publishing={publishing}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <EmptyState
                                icon={statusFilter === 'draft' ? 'draft' : 'assignment'}
                                title={statusFilter === 'all' && classFilter === 'all' ? 'No assignments yet' : 'No matching assignments'}
                                description={statusFilter !== 'all' || classFilter !== 'all'
                                    ? 'Try clearing the filters.'
                                    : "Click 'New Assignment' to get started."}
                                secondAction={statusFilter !== 'all' || classFilter !== 'all' ? {
                                    label: 'Clear Filters', icon: 'filter_alt_off',
                                    onClick: () => { setStatusFilter('all'); setClassFilter('all') },
                                } : undefined}
                                action={statusFilter === 'all' && classFilter === 'all' ? {
                                    label: 'New Assignment', icon: 'add',
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
