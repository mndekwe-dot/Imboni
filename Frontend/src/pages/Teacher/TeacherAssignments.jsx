import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
import { formatDateTime } from '../../utils/date'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
    { key: 'all',    labelKey: 'common.all'    },
    { key: 'active', labelKey: 'common.active' },
    { key: 'draft',  labelKey: 'common.draft'  },
    { key: 'closed', labelKey: 'common.closed' },
]

const QUESTION_TYPES = [
    { value: 'mcq',          labelKey: 'teacher.assignments.qTypeMcq',         icon: 'radio_button_checked' },
    { value: 'true_false',   labelKey: 'teacher.assignments.qTypeTrueFalse',   icon: 'check_circle'         },
    { value: 'short_answer', labelKey: 'teacher.assignments.qTypeShortAnswer', icon: 'short_text'           },
    { value: 'fill_blank',   labelKey: 'teacher.assignments.qTypeFillBlank',   icon: 'text_fields'          },
]

// Backend status codes mapped to their label key. The status is data; the
// word shown for it is not, so it is never derived from the code itself.
const STATUS_LABEL_KEYS = {
    active: 'common.active',
    draft:  'common.draft',
    closed: 'common.closed',
}

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

function submissionPill(a, t) {
    if (a.submitted === null || a.submitted === undefined || a.mode === 'paper')
        return { label: t('teacher.assignments.notTracked'), bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    if (a.status === 'draft')
        return { label: t('common.draft'), bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    const label = t('teacher.assignments.submittedOf', { submitted: a.submitted, total: a.total })
    const pct = a.total ? (a.submitted / a.total) * 100 : 0
    if (pct === 100) return { label, bg: 'rgba(16,185,129,0.12)', color: 'var(--success)'     }
    if (pct >= 50)   return { label, bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)'      }
    return                  { label, bg: 'rgba(239,68,68,0.1)',   color: 'var(--destructive)' }
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
    const { t } = useTranslation()
    const qType = QUESTION_TYPES.find(qt => qt.value === q.type)

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
        <div className="quiz-q u-relative">
            {/* Question header row */}
            <div className="quiz-q-header top">
                <span className="quiz-q-num">{qi + 1}</span>

                {/* Type selector */}
                <div className="quiz-q-type-col">
                    <div className="quiz-q-type-row">
                        {QUESTION_TYPES.map(qt => (
                            <button key={qt.value} type="button"
                                onClick={() => {
                                    const updated = { ...q, type: qt.value }
                                    if (qt.value === 'true_false') { updated.options = []; updated.correct = 0 }
                                    else if (qt.value === 'mcq' && q.options.length === 0) { updated.options = ['', '', '', '']; updated.correct = 0 }
                                    else if (qt.value === 'short_answer' || qt.value === 'fill_blank') { updated.options = []; updated.correct = '' }
                                    onChange(updated)
                                }}
                                className={`quiz-q-type-btn${q.type === qt.value ? ' active' : ''}`}>
                                <span className="material-symbols-rounded">{qt.icon}</span>
                                {t(qt.labelKey)}
                            </button>
                        ))}
                    </div>

                    {/* Question text */}
                    {q.type === 'fill_blank' ? (
                        <div>
                            <input
                                className="form-control"
                                placeholder={t('teacher.assignments.fillBlankPlaceholder', { n: qi + 1 })}
                                value={q.text}
                                onChange={e => set('text', e.target.value)}
                            />
                            <div className="quiz-q-hint">
                                {t('teacher.assignments.fillBlankHint')}
                            </div>
                        </div>
                    ) : (
                        <input
                            className="form-control"
                            placeholder={t('teacher.assignments.questionPlaceholder', { n: qi + 1 })}
                            value={q.text}
                            onChange={e => set('text', e.target.value)}
                        />
                    )}
                </div>

                {/* Move + delete */}
                <div className="quiz-q-tools">
                    {!isFirst && (
                        <button type="button" className="quiz-q-delete quiz-q-move" onClick={onMoveUp} title={t('common.moveUp')}>
                            <span className="material-symbols-rounded">arrow_upward</span>
                        </button>
                    )}
                    {!isLast && (
                        <button type="button" className="quiz-q-delete quiz-q-move" onClick={onMoveDown} title={t('common.moveDown')}>
                            <span className="material-symbols-rounded">arrow_downward</span>
                        </button>
                    )}
                    <button type="button" className="quiz-q-delete" onClick={onRemove} title={t('teacher.assignments.deleteQuestion')}>
                        <span className="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>

            {/* Image attachment */}
            <div className="quiz-q-image-row">
                <input ref={imgRef} type="file" accept="image/*" className="quiz-q-file-input" onChange={handleImage} />
                {q.image ? (
                    <div className="u-row-sm">
                        <img src={q.image} alt="question" className="quiz-q-image" />
                        <button type="button" className="quiz-q-delete quiz-q-move" onClick={() => set('image', '')} title={t('common.removeImage')}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                ) : (
                    <button type="button" onClick={() => imgRef.current.click()} className="quiz-q-add-image">
                        <span className="material-symbols-rounded">add_photo_alternate</span>
                        {t('common.addImage')}
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
                                    placeholder={t('teacher.assignments.optionLetter', { letter: String.fromCharCode(65 + oi) })}
                                    value={opt} onChange={e => setOption(oi, e.target.value)} />
                                {q.options.length > 2 && (
                                    <button type="button" className="quiz-q-delete quiz-q-delete-sm" onClick={() => removeOption(oi)}>
                                        <span className="material-symbols-rounded">remove</span>
                                    </button>
                                )}
                            </div>
                        ))}
                        {q.options.length < 6 && (
                            <button type="button" onClick={addOption} className="quiz-q-add-option">
                                <span className="material-symbols-rounded">add</span>
                                {t('teacher.assignments.addOption')}
                            </button>
                        )}
                        <div className="quiz-q-help">
                            <span className="material-symbols-rounded">check_circle</span>
                            {' '}{t('teacher.assignments.mcqHelp')}
                        </div>
                    </>
                )}

                {q.type === 'true_false' && (
                    <>
                        {['True', 'False'].map((label, oi) => (
                            <div key={oi} className={`quiz-q-option${q.correct === oi ? ' correct' : ''}`}>
                                <input type="radio" name={`correct-${q.id}`}
                                    checked={q.correct === oi} onChange={() => set('correct', oi)} />
                                <span className="quiz-q-tf-label">{label}</span>
                            </div>
                        ))}
                        <div className="quiz-q-help">
                            <span className="material-symbols-rounded">check_circle</span>
                            {' '}{t('teacher.assignments.trueFalseHelp')}
                        </div>
                    </>
                )}

                {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                    <div className="quiz-q-answer">
                        <label className="form-label">
                            {q.type === 'fill_blank'
                                ? t('teacher.assignments.expectedAnswer')
                                : t('teacher.assignments.modelAnswer')}{' '}
                            <span className="label-muted">{t('teacher.assignments.autoGradingHint')}</span>
                        </label>
                        <input className="form-control"
                            placeholder={q.type === 'fill_blank'
                                ? t('teacher.assignments.egParis')
                                : t('teacher.assignments.egLaw')}
                            value={q.correct || ''}
                            onChange={e => set('correct', e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Points + explanation row */}
            <div className="quiz-q-foot">
                <div className="quiz-q-points">
                    <label className="quiz-q-points-label">{t('teacher.assignments.pointsLabel')}</label>
                    <input type="number" min="1" max="100"
                        className="form-control quiz-q-points-input"
                        value={q.points} onChange={e => set('points', Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="quiz-q-expl">
                    <input className="form-control quiz-q-expl-input"
                        placeholder={t('teacher.assignments.explanationPlaceholder')}
                        value={q.explanation} onChange={e => set('explanation', e.target.value)} />
                </div>
                <button type="button"
                    onClick={() => onSaveToBank(q)}
                    title={t('teacher.assignments.saveToBankTitle')}
                    className="quiz-q-bank-btn">
                    <span className="material-symbols-rounded">bookmark_add</span>
                    {t('teacher.assignments.saveToBank')}
                </button>
            </div>
        </div>
    )
}

// ── Quiz Builder ──────────────────────────────────────────────────────────────

function QuizBuilder({ questions, onChange, onOpenBank }) {
    const { t } = useTranslation()
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
            alert(t('teacher.assignments.savedToBank'))
        } catch { alert(t('teacher.assignments.saveQuestionFailed')) }
    }

    const totalPoints = calcMaxScore(questions)

    return (
        <div>
            {questions.length === 0 ? (
                <div className="quiz-q-empty">{t('teacher.assignments.noQuestions')}</div>
            ) : (
                <>
                    <div className="u-flex u-justify-end u-mb-xs">
                        <span className="quiz-section-count">
                            {t('teacher.assignments.questionCount', { count: questions.length })} ·{' '}
                            {t('teacher.assignments.markCount', { count: totalPoints })}
                        </span>
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
            <div className="quiz-add-row">
                {QUESTION_TYPES.map(qt => (
                    <button key={qt.value} type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onChange([...questions, newQuestion(qt.value)])}>
                        <span className="material-symbols-rounded icon-sm">{qt.icon}</span>
                        + {t(qt.labelKey)}
                    </button>
                ))}
                <button type="button" className="btn btn-outline btn-sm u-ml-auto" onClick={onOpenBank}>
                    <span className="material-symbols-rounded icon-sm">library_books</span>
                    {t('teacher.assignments.importFromBank')}
                </button>
            </div>
        </div>
    )
}

// ── Question Bank Modal ───────────────────────────────────────────────────────

function QuestionBankModal({ onClose, onImport }) {
    const { t } = useTranslation()
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

    const typeLabelKeys = {
        mcq:          'teacher.assignments.typeShortMcq',
        true_false:   'teacher.assignments.typeShortTrueFalse',
        short_answer: 'teacher.assignments.typeShortShort',
        fill_blank:   'teacher.assignments.typeShortFill',
    }

    return (
        <Modal title={t('teacher.assignments.bankTitle')} icon="library_books" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">{t('teacher.assignments.selectedCount', { count: selected.size })}</span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" disabled={selected.size === 0} onClick={handleImport}>
                        <span className="material-symbols-rounded icon-sm">add</span>
                        {t('teacher.assignments.importSelected')}
                    </button>
                </div>
            }>
            <div className="bank-filter-row">
                <input className="form-control bank-search-input" placeholder={t('teacher.assignments.searchQuestions')}
                    value={search} onChange={e => setSearch(e.target.value)} />
                <select className="form-control bank-select-scope" value={scope} onChange={e => setScope(e.target.value)}
                    aria-label={t('teacher.assignments.questionScope')}>
                    <option value="">{t('teacher.assignments.allQuestions')}</option>
                    <option value="mine">{t('teacher.assignments.myQuestions')}</option>
                    <option value="shared">{t('teacher.assignments.sharedWithMe')}</option>
                </select>
                <select className="form-control bank-select-type" value={typeF} onChange={e => setTypeF(e.target.value)}>
                    <option value="">{t('teacher.assignments.allTypes')}</option>
                    {QUESTION_TYPES.map(qt => <option key={qt.value} value={qt.value}>{t(qt.labelKey)}</option>)}
                </select>
            </div>
            {loading ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : filtered.length === 0 ? (
                <p className="u-muted">{search || typeF
                    ? t('teacher.assignments.noMatchingQuestions')
                    : t('teacher.assignments.noSavedQuestions')}</p>
            ) : (
                <div className="bank-list">
                    {filtered.map(q => (
                        <div key={q.id} onClick={() => toggle(q.id)}
                            className={`bank-item${selected.has(q.id) ? ' selected' : ''}`}>
                            <input type="checkbox" readOnly checked={selected.has(q.id)} className="bank-item-check" />
                            <div className="bank-item-body">
                                <div className="bank-item-text">{q.text || t('teacher.assignments.noText')}</div>
                                <div className="bank-item-meta">
                                    {typeLabelKeys[q.question_type] ? t(typeLabelKeys[q.question_type]) : q.question_type}
                                    {' · '}{t('teacher.assignments.pointCount', { count: q.points })}
                                    {q.subject_name ? ` · ${q.subject_name}` : ''}
                                    {q.is_mine === false && q.teacher_name
                                        ? ' · ' + t('teacher.assignments.sharedBy', { name: q.teacher_name })
                                        : ''}
                                    {q.is_mine !== false && q.is_shared
                                        ? ' · ' + t('teacher.assignments.shared')
                                        : ''}
                                </div>
                            </div>
                            {q.is_mine !== false && (
                                <button type="button"
                                    onClick={e => { e.stopPropagation(); toggleShare(q) }}
                                    title={q.is_shared
                                        ? t('teacher.assignments.stopSharing')
                                        : t('teacher.assignments.startSharing')}
                                    className={`bank-item-icon-btn${q.is_shared ? ' shared' : ''}`}>
                                    <span className="material-symbols-rounded">
                                        {q.is_shared ? 'group' : 'group_off'}
                                    </span>
                                </button>
                            )}
                            {q.is_mine !== false && (
                                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(q.id) }}
                                    className="bank-item-icon-btn">
                                    <span className="material-symbols-rounded">delete</span>
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

// Deterministic shuffle. Math.random() during render re-ordered the questions
// on every keystroke; seeding from the assignment id keeps the order stable
// across re-renders while still differing per assignment.
function seededShuffle(items, seed) {
    let h = 2166136261
    for (const ch of String(seed)) {
        h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    }
    const next = () => {
        h = Math.imul(h ^ (h >>> 15), h | 1)
        h ^= h + Math.imul(h ^ (h >>> 7), h | 61)
        return ((h ^ (h >>> 14)) >>> 0) / 4294967296
    }
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

function PreviewModal({ assignment, questions, onClose }) {
    const { t } = useTranslation()
    const [answers,  setAnswers]  = useState({})
    const [revealed, setRevealed] = useState(false)
    const displayQ = useMemo(
        () => (assignment.shuffle_questions
            ? seededShuffle(questions, assignment.id ?? 'preview')
            : questions),
        [assignment.shuffle_questions, assignment.id, questions],
    )

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
        <Modal title={t('teacher.assignments.previewTitle', { title: assignment.title })} icon="preview" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">
                        {t('teacher.assignments.previewHint')}
                    </span>
                    <button className="btn btn-outline" onClick={() => setRevealed(r => !r)}>
                        <span className="material-symbols-rounded icon-sm">{revealed ? 'visibility_off' : 'visibility'}</span>
                        {revealed ? t('teacher.assignments.hideAnswers') : t('teacher.assignments.revealAnswers')}
                    </button>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                </div>
            }>
            {/* Quiz header */}
            <div className="preview-head">
                <div className="preview-title">{assignment.title}</div>
                {assignment.instructions && (
                    <div className="preview-instructions">{assignment.instructions}</div>
                )}
                <div className="preview-meta">
                    <span><strong>{calcMaxScore(questions)}</strong> {t('teacher.assignments.marksTotal')}</span>
                    <span><strong>{questions.length}</strong> {t('teacher.assignments.questionsWord')}</span>
                    {assignment.time_limit_minutes && <span><strong>{assignment.time_limit_minutes}</strong> {t('teacher.assignments.minLimit')}</span>}
                    {assignment.shuffle_questions && <span>{t('teacher.assignments.shuffled')}</span>}
                </div>
            </div>

            {/* Questions */}
            <div className="u-stack-1">
                {displayQ.map((q, qi) => {
                    const studentAns = answers[q.id]
                    const isCorrect = revealed && studentAns !== undefined && studentAns !== '' && (() => {
                        if (q.type === 'mcq' || q.type === 'true_false') return parseInt(studentAns) === parseInt(q.correct)
                        return String(studentAns).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase()
                    })()

                    return (
                        <div key={q.id} className="preview-q"
                            style={{ '--preview-q-border': revealed && studentAns !== undefined ? (isCorrect ? 'var(--success)' : '#dc2626') : 'var(--border)' }}>
                            <div className="preview-q-head">
                                <span className="preview-q-title">{qi + 1}. {q.text || t('teacher.assignments.emptyQuestion')}</span>
                                <span className="preview-q-points">{t('teacher.assignments.pointCount', { count: q.points })}</span>
                            </div>
                            {q.image && <img src={q.image} alt="question" className="preview-q-image" />}

                            {(q.type === 'mcq') && (
                                <div className="preview-opts">
                                    {q.options.map((opt, oi) => (
                                        <label key={oi} className={`preview-opt${revealed && oi === parseInt(q.correct) ? ' correct' : ''}`}>
                                            <input type="radio" name={`prev-${q.id}`}
                                                checked={answers[q.id] === oi}
                                                onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                                            {opt || t('teacher.assignments.optionLetter', { letter: String.fromCharCode(65 + oi) })}
                                            {revealed && oi === parseInt(q.correct) && <span className="material-symbols-rounded preview-check">check</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {q.type === 'true_false' && (
                                <div className="preview-tf">
                                    {['True', 'False'].map((label, oi) => (
                                        <label key={oi} className={`preview-opt-tf${revealed && oi === parseInt(q.correct) ? ' correct' : ''}`}>
                                            <input type="radio" name={`prev-${q.id}`}
                                                checked={answers[q.id] === oi}
                                                onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                                            {label}
                                            {revealed && oi === parseInt(q.correct) && <span className="material-symbols-rounded preview-check">check</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                                <div>
                                    <input className="form-control" placeholder={t('teacher.assignments.studentAnswerPlaceholder')}
                                        value={answers[q.id] || ''}
                                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                                    {revealed && q.correct && (
                                        <div className="preview-model-answer">
                                            {t('teacher.assignments.modelAnswerLabel')} <strong>{q.correct}</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                            {revealed && q.explanation && (
                                <div className="preview-explanation">
                                    {q.explanation}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {revealed && Object.keys(answers).length > 0 && (
                <div className="preview-score">
                    {t('teacher.assignments.previewScore', { score: score(), max: calcMaxScore(questions) })}
                </div>
            )}
        </Modal>
    )
}

// ── Paper Grading Modal ───────────────────────────────────────────────────────

function GradeModal({ assignment, onClose }) {
    const { t } = useTranslation()
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
            .catch(() => setMessage({ type: 'error', text: t('teacher.assignments.loadRosterFailed') }))
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
                setMessage({ type: 'error', text: t('teacher.assignments.gradesRejected', {
                    saved: res.saved, rejected: res.errors.length, max: maxScore }) })
            } else {
                setMessage({ type: 'success', text: t('teacher.assignments.gradesSaved', { count: res.saved }) })
            }
        } catch {
            setMessage({ type: 'error', text: t('teacher.assignments.saveScoresFailed') })
        } finally {
            setSaving(false)
        }
    }

    const gradedCount = Object.values(scores).filter(v => v !== '').length

    return (
        <Modal title={t('teacher.assignments.gradeTitle', { title: assignment.title })} icon="edit_note" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint"
                        style={{ color: message?.type === 'error' ? '#dc2626' : message?.type === 'success' ? 'var(--success)' : undefined }}>
                        {message?.text || t('teacher.assignments.gradedSummary', {
                            graded: gradedCount, total: sheet?.students?.length ?? 0, max: maxScore })}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
                        <span className="material-symbols-rounded icon-sm">save</span>
                        {saving ? t('common.saving') : t('teacher.assignments.saveScores')}
                    </button>
                </div>
            }>
            {loading ? (
                <p className="u-muted">{t('teacher.assignments.loadingRoster')}</p>
            ) : !sheet?.students?.length ? (
                <p className="u-muted">{t('teacher.assignments.noStudentsIn', { class: assignment.class_name })}</p>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('common.student')}</th>
                                <th className="grade-score-col">{t('teacher.assignments.scoreOutOf', { max: maxScore })}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sheet.students.map(s => (
                                <tr key={s.student_id}>
                                    <td>
                                        <div className="cell-name">{s.full_name}</div>
                                        <div className="cell-sub">{s.student_code}</div>
                                    </td>
                                    <td>
                                        <input
                                            type="number" min="0" max={maxScore}
                                            className="form-control grade-input"
                                            aria-label={t('teacher.assignments.scoreFor', { name: s.full_name })}
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
    const { t } = useTranslation()
    const [subs,    setSubs]    = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getAssignmentSubmissions(assignment.id)
            .then(data => setSubs(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [assignment.id])

    return (
        <Modal title={t('teacher.assignments.submissionsTitle', { title: assignment.title })} icon="fact_check" onClose={onClose} size="wide"
            footer={<div className="modal-footer-row"><button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button></div>}>
            {loading ? (
                <p className="u-muted">{t('teacher.assignments.loadingSubmissions')}</p>
            ) : subs.length === 0 ? (
                <p className="u-muted">{t('teacher.assignments.noSubmissions')}</p>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('common.student')}</th>
                                <th>{t('common.score')}</th>
                                <th>{t('common.percentage')}</th>
                                <th>{t('common.submitted')}</th>
                                <th>{t('common.late')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subs.map(s => (
                                <tr key={s.id}>
                                    <td>
                                        <div className="cell-name">{s.student_name}</div>
                                        <div className="cell-sub">{s.student_code}</div>
                                    </td>
                                    <td>{s.score} / {s.max_score}</td>
                                    <td>
                                        <span className={`sub-pct ${s.percentage >= 50 ? 'pass' : 'low'}`}>{s.percentage}%</span>
                                    </td>
                                    <td className="cell-date">{formatDateTime(s.submitted_at)}</td>
                                    <td>{s.is_late ? <span className="sub-late">{t('common.late')}</span> : '-'}</td>
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
    const { t } = useTranslation()
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
                title={initial ? t('teacher.assignments.editAssignment') : t('teacher.assignments.newAssignment')}
                icon="assignment"
                onClose={onClose}
                size="wide"
                footer={
                    <div className="modal-footer-row">
                        <span className={`modal-footer-hint${saveError ? ' has-error' : ''}`}>
                            {saveError
                                || (!isValid && t('teacher.assignments.fillRequired'))
                                || (form.mode === 'online' && questions.length === 0 && t('teacher.assignments.addOneQuestion'))}
                        </span>
                        {form.mode === 'online' && questions.length > 0 && (
                            <button className="btn btn-outline" type="button" onClick={() => setShowPreview(true)}>
                                <span className="material-symbols-rounded icon-sm">preview</span>
                                {t('teacher.assignments.preview')}
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                        <button className="btn btn-primary" disabled={!isValid || saving} onClick={handleSave}>
                            <span className="material-symbols-rounded icon-sm">
                                {form.status === 'draft' ? 'save' : 'publish'}
                            </span>
                            {saving
                                ? t('common.saving')
                                : form.status === 'draft'
                                    ? t('teacher.assignments.saveAsDraft')
                                    : t('common.publish')}
                        </button>
                    </div>
                }
            >
                {/* Mode toggle */}
                <div className="resp-grid-2 grid-gap-sm mb-1-5">
                    {[
                        { key: 'paper',  icon: 'assignment', label: t('teacher.assignments.modePaper'),  sub: t('teacher.assignments.modePaperSub')  },
                        { key: 'online', icon: 'quiz',       label: t('teacher.assignments.modeOnline'), sub: t('teacher.assignments.modeOnlineSub') },
                    ].map(m => (
                        <button key={m.key} onClick={() => setForm(p => ({ ...p, mode: m.key }))}
                            className={`mode-toggle-btn${form.mode === m.key ? ' active' : ''}`}>
                            <div className="mode-toggle-btn-header">
                                <span className="material-symbols-rounded mode-toggle-btn-icon">{m.icon}</span>
                                <span className="mode-toggle-btn-label">{m.label}</span>
                            </div>
                            <div className="mode-toggle-btn-sub">{m.sub}</div>
                        </button>
                    ))}
                </div>

                <div className="section-label-sm">{t('teacher.assignments.detailsLabel')}</div>

                <div className="resp-grid-2 grid-gap-sm mb-1">
                    <div className="form-group col-full">
                        <label className="form-label">{t('common.titleRequired')}</label>
                        <input className="form-control" name="title" value={form.title} onChange={handle}
                            placeholder={form.mode === 'online'
                                ? t('teacher.assignments.egQuizTitle')
                                : t('teacher.assignments.egPaperTitle')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('common.classRequired')}</label>
                        <FormSelect value={form.class_obj}
                            onChange={handleClassChange}
                            placeholder={t('teacher.assignments.selectClass')} options={classOptions} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('common.subjectRequired')}</label>
                        <FormSelect value={form.subject}
                            onChange={v => setForm(p => ({ ...p, subject: v }))}
                            placeholder={form.class_obj
                                ? t('teacher.assignments.selectSubject')
                                : t('teacher.assignments.selectClassFirst')}
                            disabled={!form.class_obj || subjectOptions.length === 0}
                            options={subjectOptions} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('teacher.assignments.dueDateRequired')}</label>
                        <input className="form-control input-icon-field" type="date" name="due_date" value={form.due_date} onChange={handle} />
                    </div>
                    {form.mode === 'paper' && (
                        <div className="form-group">
                            <label className="form-label">{t('teacher.assignments.maxScoreRequired')}</label>
                            <input className="form-control" type="number" min="1" name="max_score"
                                value={form.max_score} onChange={handle} placeholder={t('teacher.assignments.egThirty')} />
                        </div>
                    )}
                    {form.mode === 'online' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">{t('teacher.assignments.timeLimit')} <span className="label-muted">{t('teacher.assignments.minutesOptional')}</span></label>
                                <input className="form-control" type="number" min="1" name="time_limit_minutes"
                                    value={form.time_limit_minutes} onChange={handle} placeholder={t('teacher.assignments.egTimeLimit')} />
                            </div>
                            <div className="form-group shuffle-row">
                                <input type="checkbox" id="shuffle" name="shuffle_questions"
                                    checked={form.shuffle_questions} onChange={handle}
                                    className="checkbox-sm" />
                                <label htmlFor="shuffle" className="u-pointer u-sm">
                                    {t('teacher.assignments.shuffleLabel')}
                                </label>
                            </div>
                        </>
                    )}
                    <div className="form-group">
                        <label className="form-label">{t('common.status')}</label>
                        <FormSelect value={form.status}
                            onChange={v => setForm(p => ({ ...p, status: v }))}
                            placeholder=""
                            options={[
                                { value: 'draft',  label: t('teacher.assignments.saveAsDraft') },
                                { value: 'active', label: t('common.publishNow')              },
                            ]} />
                    </div>
                </div>

                {form.mode === 'paper' && (
                    <div className="form-group mb-1">
                        <label className="form-label">{t('teacher.assignments.instructions')}</label>
                        <textarea className="form-control textarea-sm" name="instructions" value={form.instructions} onChange={handle}
                            placeholder={t('teacher.assignments.describePlaceholder')} />
                    </div>
                )}

                {form.mode === 'online' && (
                    <>
                        <div className="quiz-section-header">
                            <div className="section-label-sm flush">{t('teacher.assignments.quizQuestions')}</div>
                        </div>
                        <QuizBuilder
                            questions={questions}
                            onChange={setQuestions}
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
    const { t } = useTranslation()
    const pill = submissionPill(a, t)
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
                    <span className="asgn-meta-text">{t('teacher.assignments.due', { date: a.due_date })}</span>
                    <span className="asgn-meta-text">{t('teacher.assignments.maxLabel', { score: a.max_score })}</span>
                    {a.time_limit_minutes && <span className="asgn-meta-text">{t('teacher.assignments.minutesShort', { count: a.time_limit_minutes })}</span>}
                    <span className="asgn-chip" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {STATUS_LABEL_KEYS[a.status] ? t(STATUS_LABEL_KEYS[a.status]) : a.status}
                    </span>
                    <span className="asgn-chip" style={{
                        background: a.mode === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color:      a.mode === 'online' ? 'var(--success)'        : '#6366f1',
                    }}>
                        {a.mode === 'online' ? t('teacher.assignments.online') : t('teacher.assignments.paper')}
                    </span>
                    {a.shuffle_questions && (
                        <span className="asgn-chip shuffled">
                            {t('teacher.assignments.shuffledChip')}
                        </span>
                    )}
                </div>
                <div className="asgn-actions">
                    {a.status === 'draft' && (
                        <button className="btn btn-sm btn-primary" onClick={() => onPublish(a.id)} disabled={publishing === a.id}>
                            <span className="material-symbols-rounded icon-sm">publish</span>
                            {publishing === a.id ? t('common.publishing') : t('common.publish')}
                        </button>
                    )}
                    {a.mode === 'online' && a.status === 'active' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onViewSubmissions(a)} title={t('teacher.assignments.viewSubmissions')}>
                            <span className="material-symbols-rounded icon-sm">fact_check</span>
                            {t('teacher.assignments.submissions')}
                        </button>
                    )}
                    {a.mode === 'paper' && a.status === 'active' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onGrade(a)} title={t('teacher.assignments.enterScores')}>
                            <span className="material-symbols-rounded icon-sm">edit_note</span>
                            {t('teacher.assignments.grade')}
                        </button>
                    )}
                    {a.status !== 'closed' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(a)} title={t('common.edit')}>
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => onDuplicate(a)} title={t('common.duplicate')}>
                        <span className="material-symbols-rounded icon-sm">content_copy</span>
                    </button>
                    <button className="btn btn-outline btn-sm btn-destructive-outline" onClick={() => onDelete(a.id)} title={t('common.delete')}>
                        <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Class filter dropdown ─────────────────────────────────────────────────────

function ClassDropdown({ value, onChange, options }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    return (
        <div ref={ref} className="class-dd-wrap">
            <button className="btn btn-outline class-dd-btn" onClick={() => setOpen(o => !o)}>
                <span className="material-symbols-rounded icon-md">class</span>
                {value === 'all' ? t('common.allClasses') : value}
                <span className="material-symbols-rounded icon-md ml-auto">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="class-dd-menu">
                    {[{ key: 'all', label: t('common.allClasses') }, ...options.map(o => ({ key: o, label: o }))].map(item => (
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
    const { t } = useTranslation()
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
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || t('roles.teacher')
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
            .catch(err => setLoadError(err?.message || t('common.loadFailed')))
            .finally(() => setLoading(false))
    }, [])

    const classNames = [...new Set(assignments.map(a => a.class_name).filter(Boolean))]
    const statusTabs = STATUS_TABS.map(tab => ({
        ...tab,
        label: t(tab.labelKey),
        count: tab.key === 'all' ? undefined : assignments.filter(a => a.status === tab.key).length,
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
            setSaveError(e?.response?.data ? JSON.stringify(e.response.data) : e?.message || t('common.saveFailed'))
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
                title:              t('teacher.assignments.copyOf', { title: a.title }),
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
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

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
                        title={t('nav.assignments')}
                        subtitle={t('teacher.assignments.subtitle')}
                        userName={fullName} userRole={t('roles.teacher')}
                        userInitials={initials} avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loadError && (
                            <div className="alert alert-danger u-mb">
                                <span className="material-symbols-rounded alert-icon">error</span>
                                {loadError}
                            </div>
                        )}

                        <div className="portal-stat-grid mb-1-5">
                            {[
                                { icon: 'assignment',   value: assignments.length,                                    label: t('teacher.assignments.statTotal'),         colorClass: ''        },
                                { icon: 'check_circle', value: assignments.filter(a => a.status === 'active').length, label: t('common.active'),                         colorClass: 'success' },
                                { icon: 'quiz',         value: assignments.filter(a => a.mode === 'online').length,   label: t('teacher.assignments.statOnlineQuizzes'), colorClass: ''        },
                                { icon: 'draft',        value: assignments.filter(a => a.status === 'draft').length,  label: t('teacher.assignments.statDrafts'),        colorClass: 'warning' },
                            ].map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="asgn-toolbar">
                            <FilterBar options={statusTabs} active={statusFilter} onChange={setStatusFilter} />
                            <div className="asgn-toolbar-right">
                                <ClassDropdown value={classFilter} onChange={setClassFilter} options={classNames} />
                                <button className="btn btn-primary whitespace-nowrap"
                                    onClick={() => { setEditing(null); setSaveError(null); setIsOpen(true) }}>
                                    <span className="material-symbols-rounded icon-sm">add</span>
                                    {t('teacher.assignments.newAssignment')}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <EmptyState icon="sync" title={t('teacher.assignments.loadingAssignments')} description={t('teacher.assignments.fetching')} />
                        ) : visible.length > 0 ? (
                            <div className="asgn-list-wrap">
                                <div className="asgn-list-header">
                                    <span className="asgn-list-count">{t('teacher.assignments.assignmentCount', { count: visible.length })}</span>
                                    <span className="asgn-list-filter">
                                        {classFilter !== 'all' ? classFilter : t('common.allClasses')}
                                        {' · '}
                                        {statusFilter !== 'all' ? t(STATUS_LABEL_KEYS[statusFilter]) : t('common.all')}
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
                                title={statusFilter === 'all' && classFilter === 'all'
                                    ? t('teacher.assignments.noAssignments')
                                    : t('teacher.assignments.noMatching')}
                                description={statusFilter !== 'all' || classFilter !== 'all'
                                    ? t('teacher.assignments.tryClearing')
                                    : t('teacher.assignments.getStarted')}
                                secondAction={statusFilter !== 'all' || classFilter !== 'all' ? {
                                    label: t('common.clearFilters'), icon: 'filter_alt_off',
                                    onClick: () => { setStatusFilter('all'); setClassFilter('all') },
                                } : undefined}
                                action={statusFilter === 'all' && classFilter === 'all' ? {
                                    label: t('teacher.assignments.newAssignment'), icon: 'add',
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
